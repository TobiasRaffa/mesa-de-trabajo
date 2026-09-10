// Cuánto tiempo tiene el cliente para revisar.
//
// Se cuenta en **días**, no en fechas. Una fecha hay que volver a poner en
// cada tanda; «tres días» se pone una vez y sirve siempre. La fecha en que
// vence cada pieza sale sola: el día que se subió el archivo, más los días.
//
// **Se hereda de arriba hacia abajo, y lo de abajo manda.**
//
//     Cliente ─────────► 3 días
//       └ Carpeta ─────► hereda 3, salvo que se le ponga otro
//           └ Archivo ─► hereda el de su carpeta, salvo que se le ponga otro
//
// Cambiar el del cliente vuelve a poner a todos en esa cifra: es lo que se
// espera de «el plazo de este cliente es de cinco días». Cambiar el de una
// carpeta alcanza a sus archivos y no a las otras carpetas. Cambiar el de un
// archivo alcanza solo a ese.
//
// Que lo de arriba borre lo de abajo es deliberado: si no, poner cinco días
// en el cliente dejaría carpetas con tres y nadie sabría por qué.
//
// Y sigue valiendo la regla del principio: **el plazo avisa, no decide.** Que
// se cumpla no aprueba nada ni cierra nada. No hay un evento de vencimiento en
// el dominio y no lo va a haber.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { diasValidos } from "@/lib/dias";

// Se reexportan para que quien ya lee de acá no tenga que cambiar de puerta.
export { DIAS_POSIBLES, DIAS_POR_OMISION, diasValidos, plazoQueCorre } from "@/lib/dias";

const CARPETA_DE_DATOS = path.join(process.cwd(), "datos");
const ARCHIVO = path.join(CARPETA_DE_DATOS, "plazos.json");

type Guardado = Record<string, number>;

async function leerTodo(): Promise<Guardado> {
  try {
    const datos = JSON.parse(await readFile(ARCHIVO, "utf8")) as unknown;
    if (!datos || typeof datos !== "object") return {};
    const salida: Guardado = {};
    for (const [id, dias] of Object.entries(datos as Record<string, unknown>)) {
      if (diasValidos(dias)) salida[id] = dias;
    }
    return salida;
  } catch {
    return {};
  }
}

async function escribir(datos: Guardado): Promise<void> {
  await mkdir(CARPETA_DE_DATOS, { recursive: true });
  const temporal = `${ARCHIVO}.${process.pid}.tmp`;
  await writeFile(temporal, JSON.stringify(datos, null, 2), "utf8");
  await rename(temporal, ARCHIVO);
}

/** Lo puesto a mano en cada cosa. Sin entrada significa «lo que herede». */
export async function plazosDe(ids: string[]): Promise<Record<string, number>> {
  const todo = await leerTodo();
  const salida: Record<string, number> = {};
  for (const id of ids) if (todo[id] !== undefined) salida[id] = todo[id];
  return salida;
}

export async function plazoDe(id: string): Promise<number | undefined> {
  return (await leerTodo())[id];
}

/**
 * Pone los días en un lugar y borra lo que haya debajo.
 *
 * Borrar lo de abajo es la parte importante: sin eso, cambiar el plazo del
 * cliente dejaría carpetas con el valor viejo y nadie sabría de dónde salió.
 */
export async function ponerPlazo(
  id: string,
  dias: number,
  debajo: string[] = []
): Promise<void> {
  if (!diasValidos(dias)) return;

  const todo = await leerTodo();
  todo[id] = dias;
  for (const hijo of debajo) delete todo[hijo];
  await escribir(todo);
}
