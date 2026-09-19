// Cuándo entró cada cliente a su portal por última vez.
//
// Es lo que contesta «¿vio el link?». Sin esto, después de mandar una entrega
// no había forma de distinguir «no lo abrió» de «lo abrió y no decidió», y las
// dos piden mensajes distintos.
//
// Se anota al abrir el portal con la clave puesta, no al pegarle al link: un
// link abierto por error o por un robot de vista previa no es una visita.

import { coleccion } from "@/lib/almacen";

type Visita = { ultima: string };

const esVisita = (v: unknown): v is Visita =>
  Boolean(v) && typeof v === "object" && typeof (v as Visita).ultima === "string";

const almacen = coleccion<Visita>("visitas", esVisita);

/**
 * Cada cuánto se vuelve a escribir. El portal se recarga a cada rato —cada
 * acción vuelve a pedir la página— y anotar cada una sería una escritura por
 * clic para decir lo mismo.
 */
const CADA_MS = 10 * 60 * 1000;

export async function anotarVisita(clienteId: string, ahora = new Date()): Promise<void> {
  try {
    const guardada = await almacen.uno(clienteId);
    if (guardada && ahora.getTime() - new Date(guardada.ultima).getTime() < CADA_MS) return;
    await almacen.guardar(clienteId, { ultima: ahora.toISOString() });
  } catch {
    // Anotar una visita nunca puede impedir la visita.
  }
}

/** La última visita de cada cliente pedido, ISO. Sin entrada, nunca entró. */
export async function ultimasVisitas(ids: string[]): Promise<Record<string, string>> {
  const todo = await almacen.todo();
  const salida: Record<string, string> = {};
  for (const id of ids) if (todo[id]) salida[id] = todo[id].ultima;
  return salida;
}
