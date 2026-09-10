// Quién del equipo lleva cada cosa.
//
// Se hereda igual que el tiempo de revisión: cliente → carpeta → archivo, y lo
// de arriba borra lo de abajo. Asignarle un cliente entero a alguien es lo que
// se hace al empezar; después se corrige una carpeta o un archivo suelto.
//
// **«Nadie» es una respuesta, no la falta de una.** Una carpeta puesta en «sin
// asignar» no vuelve a heredar el responsable del cliente: alguien decidió que
// esa carpeta no la lleva nadie. Por eso se guarda `null` y no se borra la
// entrada.

import { almacenHeredable, heredado } from "@/lib/almacenHeredable";

const esTexto = (v: unknown): v is string => typeof v === "string" && v.length > 0;

const almacen = almacenHeredable<string>("responsables", esTexto);

/** Lo puesto a mano. `null` es «nadie»; la ausencia es «hereda». */
export async function responsablesDe(
  ids: string[]
): Promise<Record<string, string | null>> {
  return almacen.leerVarios(ids);
}

export async function responsableDe(id: string): Promise<string | null | undefined> {
  return almacen.leerUno(id);
}

export async function ponerResponsable(
  id: string,
  personaId: string | null,
  debajo: string[] = []
): Promise<void> {
  await almacen.poner(id, personaId, debajo);
}

/** Quién lleva algo, mirando su nivel y después los de arriba. */
export function responsableQueCorre(
  delArchivo: string | null | undefined,
  deLaCarpeta: string | null | undefined,
  delCliente: string | null | undefined
): string | null {
  return heredado(delArchivo, deLaCarpeta, delCliente) ?? null;
}
