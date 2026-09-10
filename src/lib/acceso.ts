// Cómo entra un cliente al portal.
//
// Son **dos factores**, y ninguno sirve solo:
//
//   1. **El link.** 96 bits al azar en la dirección. Adivinarlo probando no es
//      una estrategia. Hay uno por cliente —que muestra todas sus carpetas— y
//      uno por carpeta —que muestra esa sola—. Uno de cada, estable: el link se
//      manda una vez y se guarda; si cambiara, el que el cliente tiene dejaría
//      de servir.
//
//   2. **El tag.** Una palabra que elige la agencia y le pasa al cliente por
//      otro lado. Es lo que hace que un link reenviado sin querer no alcance.
//
// **El tag no viaja en la dirección**, ni siquiera después de acertarlo. Si
// estuviera en la URL, la llave quedaría escrita en la puerta: se copia al
// mandar el link, aparece en el historial y viaja en la cabecera `Referer` de
// cualquier cosa que se abra desde adentro.
//
// Lo que queda después de acertar es una galleta firmada por el servidor. No
// guarda el tag, guarda «este navegador ya acertó el de este link»: leerla no
// sirve para entrar a otro lado, y fabricarla necesita la llave del servidor.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { documento } from "@/lib/almacen";
import { ajustesDe } from "@/lib/ajustesDeCarpeta";
import { clientesHabilitados, type Cliente } from "@/lib/clientes";
import { subcarpetasDe } from "@/lib/google";

const esTexto = (v: unknown): v is string => typeof v === "string" && v.length >= 32;

const guardado = documento<string>("secreto", esTexto, "");

let enMemoria: string | null = null;

/**
 * La llave con la que se firman las galletas.
 *
 * Se genera sola la primera vez. Borrarla no rompe nada: lo único que pasa es
 * que todos los clientes tienen que volver a poner su clave.
 *
 * En internet conviene ponerla como variable de entorno: si la aplicación
 * corre en más de una máquina, cada una generaría la suya y las sesiones se
 * caerían al saltar de una a otra.
 */
async function secreto(): Promise<string> {
  if (enMemoria) return enMemoria;

  const delEntorno = process.env.SECRETO_DE_SESION?.trim();
  if (delEntorno && delEntorno.length >= 32) {
    enMemoria = delEntorno;
    return delEntorno;
  }

  const anotado = await guardado.leer();
  if (anotado) {
    enMemoria = anotado;
    return anotado;
  }

  const nuevo = randomBytes(32).toString("base64url");
  await guardado.escribir(nuevo);
  enMemoria = nuevo;
  return nuevo;
}

/**
 * Deja un tag comparable: sin acentos, sin mayúsculas, sin espacios de más.
 *
 * Lo escribe una persona a mano, en un teléfono, probablemente apurada.
 * «Café Otoño», «cafe otono» y «  CAFÉ  OTOÑO » tienen que ser el mismo tag,
 * porque para quien lo escribe lo son.
 */
export function normalizarTag(tag: string): string {
  // El rango de acentos se arma desde un texto con escapes y no se escribe
  // tal cual: escrito, es invisible en el fuente y cualquier herramienta que
  // toque el archivo se lo puede comer sin que nada avise. Ya paso una vez.
  const ACENTOS = new RegExp("[\u0300-\u036f]", "g");
  return tag
    .normalize("NFD")
    .replace(ACENTOS, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


// ---------------------------------------------------------------------------

export type Puerta =
  | { tipo: "cliente"; cliente: Cliente }
  | { tipo: "carpeta"; cliente: Cliente; carpetaId: string; carpetaNombre: string };

/**
 * A dónde lleva un link, o `null` si no lleva a ningún lado.
 *
 * Un link que no existe y un cliente apagado dan lo mismo: `null`. Distinguir
 * los dos casos le diría a quien prueba links si acertó a medias.
 */
export async function puertaDe(token: string): Promise<Puerta | null> {
  if (!token) return null;

  let clientes: Cliente[];
  try {
    clientes = await clientesHabilitados();
  } catch {
    return null;
  }

  const porCliente = clientes.find((c) => c.token === token);
  if (porCliente) return { tipo: "cliente", cliente: porCliente };

  // No es de ningún cliente: puede ser el de una carpeta suelta.
  for (const cliente of clientes) {
    try {
      const carpetas = await subcarpetasDe(cliente.id);
      for (const carpeta of carpetas) {
        const ajustes = await ajustesDe(carpeta.id);
        if (ajustes.token === token && ajustes.visible) {
          return {
            tipo: "carpeta",
            cliente,
            carpetaId: carpeta.id,
            carpetaNombre: carpeta.name,
          };
        }
      }
    } catch {
      // Un cliente que Drive no contesta no puede tumbar la búsqueda entera.
    }
  }

  return null;
}

// ---------------------------------------------------------------------------

/** El nombre de la galleta de este link. No dice de quién es. */
export async function nombreDeGalleta(token: string): Promise<string> {
  const firma = createHmac("sha256", await secreto()).update(`nombre:${token}`).digest("base64url");
  return `mdt_${firma.slice(0, 20)}`;
}

export async function valorDeGalleta(token: string): Promise<string> {
  return createHmac("sha256", await secreto()).update(`entro:${token}`).digest("base64url");
}

/**
 * Compara en tiempo constante.
 *
 * Comparar con `===` tarda distinto según cuántos caracteres coinciden, y esa
 * diferencia se puede medir para ir adivinando la firma de a un carácter.
 */
export async function galletaValida(token: string, valor: string | undefined): Promise<boolean> {
  if (!valor) return false;
  const esperado = await valorDeGalleta(token);
  const a = Buffer.from(esperado);
  const b = Buffer.from(valor);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------

/**
 * Cuántas veces se erró el tag de cada link, para no dejar probar de a mil.
 *
 * Vive en memoria a propósito: es un freno, no un registro. Se pierde al
 * reiniciar y no pasa nada —el link sigue siendo lo caro de adivinar—.
 */
const intentos = new Map<string, { cuantos: number; hasta: number }>();

const TOPE = 8;
const ESPERA_MS = 10 * 60 * 1000;

export function estaFrenado(token: string): boolean {
  const registro = intentos.get(token);
  if (!registro) return false;
  if (registro.hasta < Date.now()) {
    intentos.delete(token);
    return false;
  }
  return registro.cuantos >= TOPE;
}

export function anotarIntentoFallido(token: string): void {
  const ahora = Date.now();
  const registro = intentos.get(token);
  if (!registro || registro.hasta < ahora) {
    intentos.set(token, { cuantos: 1, hasta: ahora + ESPERA_MS });
    return;
  }
  registro.cuantos += 1;
  registro.hasta = ahora + ESPERA_MS;
}

export function olvidarIntentos(token: string): void {
  intentos.delete(token);
}

// ---------------------------------------------------------------------------

/**
 * **Quién entró.** La única fuente de verdad sobre eso en toda la aplicación.
 *
 * Devuelve el cliente cuya puerta abrió este navegador, o `null` si no abrió
 * ninguna. Todo lo que muestre o toque datos de un cliente sale de acá: si
 * alguien escribe una pantalla nueva y no la llama, no autentica a nadie, y
 * eso es exactamente el error que ya cometimos tres veces.
 *
 * Sirve tanto el link del cliente como el de cualquiera de sus carpetas: las
 * dos puertas llevan al mismo cliente. Se prueban primero los del cliente
 * porque son una firma cada uno y no tocan Drive; recién si ninguno acierta se
 * miran los de carpeta.
 */
export async function clienteQueEntro(
  galletas: { get(nombre: string): { value: string } | undefined }
): Promise<Cliente | null> {
  let clientes: Cliente[];
  try {
    clientes = await clientesHabilitados();
  } catch {
    // Si no se puede saber quién es cliente, no entró nadie. El lado seguro.
    return null;
  }

  for (const cliente of clientes) {
    const valor = galletas.get(await nombreDeGalleta(cliente.token))?.value;
    if (await galletaValida(cliente.token, valor)) return cliente;
  }

  for (const cliente of clientes) {
    try {
      for (const carpeta of await subcarpetasDe(cliente.id)) {
        const { token } = await ajustesDe(carpeta.id);
        if (!token) continue;
        const valor = galletas.get(await nombreDeGalleta(token))?.value;
        if (await galletaValida(token, valor)) return cliente;
      }
    } catch {
      // Un cliente que Drive no contesta no puede tumbar la búsqueda entera.
    }
  }

  return null;
}

/**
 * Si este navegador entró a algo de **este** cliente.
 *
 * Es `clienteQueEntro` y una comparación. Escrito aparte se le habría ido la
 * mano a alguno de los dos con el tiempo, y el que se quedara viejo sería el
 * que autoriza.
 */
export async function entroAlCliente(
  clienteId: string,
  galletas: { get(nombre: string): { value: string } | undefined }
): Promise<boolean> {
  return (await clienteQueEntro(galletas))?.id === clienteId;
}
