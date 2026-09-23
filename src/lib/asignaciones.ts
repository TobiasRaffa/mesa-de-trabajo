// De qué trabajo es cada vuelta, según lo decidió alguien de la agencia.
//
// Una V2, V3 o más **no se suma sola** a ningún trabajo: el nombre sugiere,
// una persona decide. Lo decidido queda acá, por el id de Drive del archivo, y
// no en el nombre: el archivo se queda llamándose como lo llamó el equipo, y
// si después lo renombran sigue siendo la misma vuelta del mismo trabajo.
//
// La regla de cómo se arman los trabajos con esto está en `armarTrabajos`
// (`@/lib/versiones`); acá solo se guarda y se lee.

import { coleccion } from "@/lib/almacen";
import type { Asignacion } from "@/lib/versiones";

type Guardada = {
  carpetaId: string;
  archivo: string;
  /** La identidad del trabajo, sin la carpeta. `null`: es un trabajo propio. */
  pieza: string | null;
  raices?: string[];
  version?: number;
  por: string;
  cuando: string;
};

const esGuardada = (v: unknown): v is Guardada => {
  const g = v as Guardada;
  return (
    Boolean(g) &&
    typeof g === "object" &&
    typeof g.carpetaId === "string" &&
    typeof g.archivo === "string" &&
    (g.pieza === null || typeof g.pieza === "string") &&
    (g.raices === undefined ||
      (Array.isArray(g.raices) && g.raices.every((r) => typeof r === "string"))) &&
    (g.version === undefined || (Number.isInteger(g.version) && g.version >= 1))
  );
};

const almacen = coleccion<Guardada>("asignaciones", esGuardada);

/** El documento va por carpeta y archivo: así se leen las de una carpeta de una vez. */
const clave = (carpetaId: string, archivo: string) => `${carpetaId}::${archivo}`;

/** Las asignaciones de una carpeta, por id de archivo. */
export async function asignacionesDe(carpetaId: string): Promise<Map<string, Asignacion>> {
  const salida = new Map<string, Asignacion>();
  for (const g of Object.values(await almacen.losQueEmpiezanCon(`${carpetaId}::`))) {
    salida.set(
      g.archivo,
      g.pieza === null
        ? { pieza: null }
        : { pieza: g.pieza, raices: g.raices ?? [], version: g.version }
    );
  }
  return salida;
}

/** Anota de qué trabajo es una vuelta, o que es un trabajo propio. */
export async function asignarVuelta(
  carpetaId: string,
  archivo: string,
  asignacion: Asignacion,
  por: string
): Promise<void> {
  await almacen.guardar(clave(carpetaId, archivo), {
    carpetaId,
    archivo,
    ...(asignacion.pieza === null
      ? { pieza: null }
      : { pieza: asignacion.pieza, raices: asignacion.raices, version: asignacion.version }),
    por,
    cuando: new Date().toISOString(),
  });
}
