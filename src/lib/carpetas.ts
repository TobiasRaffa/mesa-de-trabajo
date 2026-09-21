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

import { clientesHabilitados, type Cliente } from "@/lib/clientes";
import { subcarpetasDe } from "@/lib/google";

/** Cuánto se recuerda la lista antes de volver a preguntarle a Drive. */
const RECUERDO_MS = 60 * 1000;

/**
 * De qué cliente es cada carpeta de trabajo.
 *
 * **Un mapa y no una lista, y esa es la diferencia que se nota.** Antes esto
 * guardaba solo los identificadores, así que la otra pregunta —«¿de quién es
 * esta carpeta?»— recorría los clientes de a uno pidiéndole a Drive las
 * subcarpetas de cada uno, y la hacía **por cada carpeta**: validar un
 * formulario con diez clientes y sesenta carpetas eran hasta seiscientas
 * llamadas encadenadas. Las dos preguntas salen de la misma vuelta a Drive, así
 * que las dos salen de acá.
 */
let cache: { de: Map<string, Cliente>; vence: number } | null = null;

async function mapaDeCarpetas(): Promise<Map<string, Cliente>> {
  const ahora = Date.now();
  if (cache && cache.vence > ahora) return cache.de;

  const clientes = await clientesHabilitados();
  // En paralelo: son pocas carpetas y esperar una por una haría que cada
  // guardado tarde la suma de todas.
  const porCliente = await Promise.all(clientes.map((c) => subcarpetasDe(c.id)));

  const de = new Map<string, Cliente>();
  clientes.forEach((cliente, i) => {
    for (const carpeta of porCliente[i]) de.set(carpeta.id, cliente);
  });

  cache = { de, vence: ahora + RECUERDO_MS };
  return de;
}

export async function idsDeCarpetasReales(): Promise<Set<string>> {
  return new Set((await mapaDeCarpetas()).keys());
}

/**
 * Todas las carpetas de trabajo con el cliente de cada una.
 *
 * **Sin recortar por alcance**, como todo lo de este módulo: quien la use tiene
 * que recortarla, y hay un guardián que verifica que se pida desde el único
 * lugar que lo hace. Existe para contestar de una sola vez lo que antes se
 * preguntaba carpeta por carpeta.
 */
export async function carpetasConSuCliente(): Promise<Map<string, Cliente>> {
  return mapaDeCarpetas();
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

/**
 * De qué cliente es una carpeta.
 *
 * **Se busca, no se recibe.** Las acciones del portal traían el cliente como
 * parámetro y le creían: con eso, un pedido armado a mano podía aprobar la
 * pieza de un cliente diciendo ser otro, y el archivo terminaba en la carpeta
 * «Entregas finales» **del otro** —o el mensaje, en su conversación—.
 *
 * La regla general: de lo que llega de afuera se acepta la referencia mínima
 * —esta carpeta, esta pieza— y todo lo demás se deduce del servidor.
 */
export async function clienteDeCarpeta(carpetaId: string): Promise<Cliente | null> {
  if (!carpetaId) return null;
  try {
    return (await mapaDeCarpetas()).get(carpetaId) ?? null;
  } catch {
    // Ante la duda, de nadie.
    return null;
  }
}
