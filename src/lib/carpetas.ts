// Qué carpetas existen de verdad adentro de la del cliente.
//
// Existe para validar lo que llega de afuera. Las acciones de servidor y las
// rutas son endpoints públicos: cualquiera que sepa mandar el pedido llega.
// El identificador de carpeta que viene en un formulario o en una dirección no
// se puede creer, así que se compara contra esta lista antes de leer o
// escribir nada.
//
// Vive en `lib` y no en uno de los dos mundos porque los dos lo necesitan: el
// portal para no dejar espiar conversaciones ajenas, y administración para no
// guardar ajustes de carpetas inventadas.

import { subcarpetasDe } from "@/lib/google";

/** Cuánto se recuerda la lista antes de volver a preguntarle a Drive. */
const RECUERDO_MS = 60 * 1000;

let cache: { ids: Set<string>; vence: number } | null = null;

export async function idsDeCarpetasReales(): Promise<Set<string>> {
  const raiz = process.env.DRIVE_CARPETA_CLIENTE;
  if (!raiz) return new Set();

  const ahora = Date.now();
  if (cache && cache.vence > ahora) return cache.ids;

  const subcarpetas = await subcarpetasDe(raiz);
  const ids = new Set(subcarpetas.map((c) => c.id));
  cache = { ids, vence: ahora + RECUERDO_MS };
  return ids;
}

/**
 * Si ese identificador es una carpeta de este cliente.
 *
 * Ante la duda —Drive no contesta, no hay carpeta configurada— devuelve
 * `false`. Nunca al revés.
 */
export async function esCarpetaDelCliente(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    return (await idsDeCarpetasReales()).has(id);
  } catch {
    return false;
  }
}

/** Olvida la lista. Existe para las pruebas y para después de crear carpetas. */
export function olvidarCarpetas(): void {
  cache = null;
}
