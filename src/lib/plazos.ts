// Hasta cuándo tiene el cliente para revisar.
//
// Se pone **en la carpeta**, que es como se trabaja: una tanda de doce posteos
// vence junta. Y se puede correr **una pieza sola** cuando hace falta, sin
// mover el resto —«esta la necesitamos el jueves, el resto la semana que
// viene»—.
//
// La regla es la de siempre en este proyecto: **el plazo avisa, no decide**.
// Que se cumpla no aprueba nada ni cierra nada. Dispara un aviso y sigue
// esperando a una persona. No existe un evento de vencimiento en el dominio, y
// no lo va a haber.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { esDiaValido, fechaDeDia, type DiaSuelto } from "@/lib/publicaciones";

const CARPETA_DE_DATOS = path.join(process.cwd(), "datos");
const ARCHIVO = path.join(CARPETA_DE_DATOS, "plazos.json");

type Guardado = Record<string, DiaSuelto>;

async function leerTodo(): Promise<Guardado> {
  try {
    const datos = JSON.parse(await readFile(ARCHIVO, "utf8")) as unknown;
    if (!datos || typeof datos !== "object") return {};
    const salida: Guardado = {};
    for (const [archivo, dia] of Object.entries(datos as Record<string, unknown>)) {
      if (esDiaValido(dia)) salida[archivo] = dia;
    }
    return salida;
  } catch {
    return {};
  }
}

/** El plazo propio de cada pieza, para las que tengan uno. */
export async function plazosDe(piezas: string[]): Promise<Record<string, DiaSuelto>> {
  const todo = await leerTodo();
  const salida: Record<string, DiaSuelto> = {};
  for (const id of piezas) if (todo[id]) salida[id] = todo[id];
  return salida;
}

export async function guardarPlazos(
  cambios: Record<string, DiaSuelto | null>
): Promise<void> {
  const todo = await leerTodo();
  for (const [archivo, dia] of Object.entries(cambios)) {
    if (dia === null) delete todo[archivo];
    else if (esDiaValido(dia)) todo[archivo] = dia;
  }

  await mkdir(CARPETA_DE_DATOS, { recursive: true });
  const temporal = `${ARCHIVO}.${process.pid}.tmp`;
  await writeFile(temporal, JSON.stringify(todo, null, 2), "utf8");
  await rename(temporal, ARCHIVO);
}

/** El plazo que corre para una pieza: el suyo si lo tiene, si no el de la carpeta. */
export function plazoQueCorre(
  deLaPieza: DiaSuelto | undefined,
  deLaCarpeta: string | undefined
): Date | null {
  const dia = deLaPieza ?? deLaCarpeta;
  return dia && esDiaValido(dia) ? fechaDeDia(dia) : null;
}
