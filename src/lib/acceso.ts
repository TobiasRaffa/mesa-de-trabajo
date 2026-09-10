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
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ajustesDe } from "@/lib/ajustesDeCarpeta";
import { clientesHabilitados, type Cliente } from "@/lib/clientes";
import { subcarpetasDe } from "@/lib/google";

const CARPETA_DE_DATOS = path.join(process.cwd(), "datos");
const ARCHIVO_SECRETO = path.join(CARPETA_DE_DATOS, "secreto.txt");

let secretoEnMemoria: string | null = null;

/**
 * La llave con la que se firman las galletas.
 *
 * Se genera sola la primera vez y queda en `datos/`. Borrarla no rompe nada:
 * lo único que pasa es que todos los clientes tienen que volver a poner su tag.
 */
async function secreto(): Promise<string> {
  if (secretoEnMemoria) return secretoEnMemoria;
  try {
    const guardado = (await readFile(ARCHIVO_SECRETO, "utf8")).trim();
    if (guardado.length >= 32) {
      secretoEnMemoria = guardado;
      return guardado;
    }
  } catch {}

  const nuevo = randomBytes(32).toString("base64url");
  await mkdir(CARPETA_DE_DATOS, { recursive: true });
  await writeFile(ARCHIVO_SECRETO, nuevo, "utf8");
  secretoEnMemoria = nuevo;
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
