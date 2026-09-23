// Los trabajos de una carpeta: **la única forma de preguntarlo.**
//
// Un trabajo son sus archivos de Drive —el original y sus vueltas— y cuáles
// vueltas son de cuál lo decide una persona (`@/lib/asignaciones`). Si cada
// pantalla armara los trabajos por su cuenta, alcanzaría con que una se
// olvide de las asignaciones para que gestión y el portal hablen de trabajos
// distintos, y la identidad de una pieza —de la que cuelga todo lo anotado—
// dependería de qué pantalla la miró. Hay un guardián en `cimientos.test.ts`.

import { archivosAnotadosDe, piezasDeLaCarpeta } from "@/lib/piezas";
import { asignacionesDe } from "@/lib/asignaciones";
import { armarTrabajos, esVueltaSuelta, nombreDePieza, type Asignacion } from "@/lib/versiones";

export async function trabajosDeLaCarpeta(carpetaId: string) {
  const [archivos, anotados, decididas] = await Promise.all([
    piezasDeLaCarpeta(carpetaId),
    archivosAnotadosDe(carpetaId),
    asignacionesDe(carpetaId),
  ]);

  // **Lo que ya estaba sumado a un trabajo, sigue ahí.** Antes las vueltas se
  // sumaban solas por el nombre; esas vueltas están anotadas en su pieza, y
  // estar anotada es estar asignada. Sin esto, todas las V2 que ya existían
  // quedarían pendientes de un día para el otro.
  // Solo las vueltas: un original anotado en su pieza no está «asignado» a
  // nada, la funda.
  const vueltas = new Set(archivos.filter((a) => esVueltaSuelta(a.name)).map((a) => a.id));
  const asignaciones = new Map<string, Asignacion>();
  for (const [pieza, suyos] of Object.entries(anotados)) {
    for (const archivo of suyos) {
      if (vueltas.has(archivo) && !asignaciones.has(archivo)) {
        asignaciones.set(archivo, { pieza: nombreDePieza(pieza), raices: suyos });
      }
    }
  }
  // Lo que decidió una persona manda sobre lo anotado.
  for (const [archivo, asignacion] of decididas) asignaciones.set(archivo, asignacion);

  return { archivos, ...armarTrabajos(archivos, asignaciones) };
}
