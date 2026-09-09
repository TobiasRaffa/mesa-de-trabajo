// Qué carpetas de trabajo existen de verdad, en todos los clientes.
//
// Existe para validar lo que llega de afuera. Las acciones de servidor y las
// rutas son endpoints públicos: cualquiera que sepa mandar el pedido llega. El
// identificador de carpeta que viene en un formulario o en una dirección no se
// puede creer, así que se compara contra esta lista antes de leer o escribir
// nada.
//
// Vive en `lib` y no en uno de los dos mundos porque los dos lo necesitan: el
// portal para no dejar espiar conversaciones ajenas, y administración para no
// guardar ajustes de carpetas inventadas.

import { clientesHabilitados } from "@/lib/clientes";
import { subcarpetasDe } from "@/lib/google";

/** Cuánto se recuerda la lista antes de volver a preguntarle a Drive. */
const RECUERDO_MS = 60 * 1000;

let cache: { ids: Set<string>; vence: number } | null = null;

export async function idsDeCarpetasReales(): Promise<Set<string>> {
  const ahora = Date.now();
  if (cache && cache.vence > ahora) return cache.ids;

  const clientes = await clientesHabilitados();
  // En paralelo: son pocas carpetas y esperar una por una haría que cada
  // guardado tarde la suma de todas.
  const porCliente = await Promise.all(clientes.map((c) => subcarpetasDe(c.id)));

  const ids = new Set(porCliente.flat().map((c) => c.id));
  cache = { ids, vence: ahora + RECUERDO_MS };
  return ids;
}

/**
 * Si ese identificador es una carpeta de trabajo de algún cliente habilitado.
 *
 * Ante la duda —Drive no contesta, no hay clientes— devuelve `false`. Nunca al
 * revés.
 */
export async function esCarpetaDelCliente(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    return (await idsDeCarpetasReales()).has(id);
  } catch {
    return false;
  }
}

/** Olvida la lista. Se llama al crear o habilitar algo, y en las pruebas. */
export function olvidarCarpetas(): void {
  cache = null;
}
