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

import { anotarError, frenado, olvidarErrores, type Limite } from "@/lib/frenos";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { documento } from "@/lib/almacen";
import { ajustesDe, carpetasConLink } from "@/lib/ajustes";
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

  // Un link de carpeta. El token dice qué carpeta; Drive confirma que esa
  // carpeta sigue colgando de un cliente habilitado, y nada más que eso.
  const carpetaId = (await carpetasConLink())[token];
  if (!carpetaId) return null;

  const ajustes = await ajustesDe(carpetaId);
  if (!ajustes.visible) return null;

  for (const cliente of clientes) {
    try {
      const carpeta = (await subcarpetasDe(cliente.id)).find((c) => c.id === carpetaId);
      if (carpeta) {
        return { tipo: "carpeta", cliente, carpetaId, carpetaNombre: carpeta.name };
      }
    } catch {
      // Un cliente cuya carpeta no se puede leer no invalida a los demás.
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
 * Cuántas veces se erró la clave de cada link, para no dejar probar de a mil.
 *
 * La cuenta vive en el almacén y no en memoria: en internet cada pedido puede
 * caer en otra máquina, y ocho intentos repartidos entre ocho máquinas con la
 * cuenta en cero no los frena nadie. Está explicado en `lib/frenos.ts`.
 *
 * Diez minutos, y no un minuto como la puerta de la agencia: del lado del
 * cliente el que erra ocho veces seguidas no es alguien que se equivocó, es
 * alguien probando. Y el cliente tiene la clave anotada donde la agencia se la
 * mandó, así que esperar no le cuesta lo que le costaría a quien la recuerda
 * de memoria.
 */
const LIMITE: Limite = { tope: 8, espera: 10 * 60 * 1000 };

const porLink = (token: string) => `portal:${token}`;

export const estaFrenado = (token: string): Promise<boolean> =>
  frenado(porLink(token), LIMITE);

export const anotarIntentoFallido = (token: string): Promise<void> =>
  anotarError(porLink(token), LIMITE);

export const olvidarIntentos = (token: string): Promise<void> =>
  olvidarErrores(porLink(token));

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
  return (await entradaDe(galletas))?.cliente ?? null;
}

/**
 * Por dónde entró este navegador: el cliente, y la carpeta si entró por el
 * link de una carpeta sola.
 *
 * **Un link de carpeta abre esa carpeta, no el cliente entero.** Es lo que
 * promete la pantalla que lo genera —«si querés mandarle esa carpeta sola»—,
 * y durante un tiempo fue mentira del lado de las acciones: la galleta decía
 * «entró a algo de este cliente» y con eso se aprobaba, se pedían cambios o
 * se escribía sobre cualquier carpeta del cliente, sabiendo su identificador.
 * Ahora la entrada dice de qué carpeta es, y quien hace algo con otra carpeta
 * se queda afuera.
 */
export type Entrada = {
  cliente: Cliente;
  /** La carpeta por la que entró, si fue por un link de carpeta. */
  carpeta?: string;
};

export async function entradaDe(
  galletas: { get(nombre: string): { value: string } | undefined }
): Promise<Entrada | null> {
  let clientes: Cliente[];
  try {
    clientes = await clientesHabilitados();
  } catch {
    // Si no se puede saber quiénes son los clientes, nadie entró.
    return null;
  }

  // Primero los links de cliente: una firma cada uno y no tocan Drive.
  for (const cliente of clientes) {
    const valor = galletas.get(await nombreDeGalleta(cliente.token))?.value;
    if (await galletaValida(cliente.token, valor)) return { cliente };
  }

  // Después los de carpeta: el token sale del almacén, y Drive solo confirma
  // la carpeta que la galleta nombra, en vez de recorrerlas todas.
  for (const [token, carpetaId] of Object.entries(await carpetasConLink())) {
    const valor = galletas.get(await nombreDeGalleta(token))?.value;
    if (!(await galletaValida(token, valor))) continue;

    for (const cliente of clientes) {
      try {
        const carpetas = await subcarpetasDe(cliente.id);
        if (carpetas.some((c) => c.id === carpetaId)) return { cliente, carpeta: carpetaId };
      } catch {
        // Un cliente cuya carpeta no se puede leer no invalida a los demás.
      }
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
