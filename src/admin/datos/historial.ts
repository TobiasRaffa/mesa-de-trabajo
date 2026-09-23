// Todo lo que le pasó a cada pieza de un cliente, en filas.
//
// Es lo que se lleva a una planilla: para cobrar vueltas de más, para discutir
// con un cliente qué se aprobó cuándo, o para mirar de lejos cómo viene una
// cuenta. La aplicación guarda la historia pieza por pieza; acá se aplana.
//
// Recorre las carpetas de trabajo hasta la misma hondura que el tablero, y
// deja afuera las reservadas: «Entregas finales» no es trabajo y «Facturas»
// no se revisa.

import { esCarpetaReservada } from "@/lib/ajustes";
import { subcarpetasDe } from "@/lib/google";
import { EN_PALABRAS, estadosDe } from "@/lib/piezas";
import { trabajosDeLaCarpeta } from "@/lib/trabajos";
import { conSusArchivos } from "@/lib/versiones";

export type FilaDeHistorial = {
  carpeta: string;
  pieza: string;
  /** La vuelta más alta que hay en Drive. */
  vueltas: number;
  estado: string;
  /** ISO. */
  cuando: string;
  que: string;
  quien: string;
  detalle: string;
};

/** Hasta dónde se baja. La misma que el tablero. */
const HONDURA = 3;

export async function historialDelCliente(clienteId: string): Promise<FilaDeHistorial[]> {
  const filas: FilaDeHistorial[] = [];
  await recorrer(clienteId, [], 0, filas);
  return filas.sort((a, b) => a.cuando.localeCompare(b.cuando));
}

async function recorrer(
  carpetaId: string,
  camino: string[],
  hondura: number,
  filas: FilaDeHistorial[]
): Promise<void> {
  if (hondura >= HONDURA) return;

  // **La carpeta del cliente no se perdona.** Si esa no se puede leer —llave
  // vencida, carpeta sin compartir— no hay historial, y tragarse el error
  // bajaba una planilla con solo los títulos como si estuviera todo bien. Que
  // llegue a la ruta, que contesta que no se pudo. Más abajo sí se sigue: una
  // subcarpeta rota no se lleva puestas a las demás.
  const lista =
    hondura === 0
      ? await subcarpetasDe(carpetaId)
      : await subcarpetasDe(carpetaId).catch(() => []);
  const carpetas = lista.filter((c) => !esCarpetaReservada(c.name));

  for (const carpeta of carpetas) {
    const suCamino = [...camino, carpeta.name];
    const nombre = suCamino.join(" / ");

    try {
      const agrupadas = (await trabajosDeLaCarpeta(carpeta.id)).agrupadas;
      const conArchivos = conSusArchivos(carpeta.id, agrupadas);
      const estados = await estadosDe(carpeta.id, conArchivos);

      agrupadas.forEach((pieza, i) => {
        const estado = estados[conArchivos[i].id];
        for (const hito of estado.historia) {
          filas.push({
            carpeta: nombre,
            pieza: pieza.titulo,
            vueltas: conArchivos[i].version,
            estado: estado.estado,
            cuando: hito.cuando,
            que: EN_PALABRAS[hito.que] ?? hito.que,
            quien: hito.quien,
            detalle: hito.detalle ?? "",
          });
        }
      });
    } catch {
      // Una carpeta que no se puede leer no se lleva puestas a las demás.
    }

    await recorrer(carpeta.id, suCamino, hondura + 1, filas);
  }
}

/**
 * Las filas como CSV, con la primera línea de títulos.
 *
 * Con punto y coma, que es lo que Excel en castellano espera al abrir un CSV
 * con doble clic; con coma, todo cae en una sola columna. Y con la marca de
 * orden de bytes al principio, porque sin ella Excel lee los acentos como
 * basura.
 */
export function comoCsv(filas: FilaDeHistorial[]): string {
  const celda = (v: string | number) => {
    // **Lo que arranca con `=`, `+`, `-` o `@` sale con un apóstrofo delante.**
    // Dos de estas columnas —«Quién» y «Detalle»— llevan texto escrito por el
    // cliente, y este archivo está pensado para abrirse con doble clic en
    // Excel: una celda que empieza con `=` es una fórmula y se evalúa sola en
    // la máquina de quien lo abre. El apóstrofo le dice a la planilla que es
    // texto, y no se ve en la celda.
    const crudo = String(v);
    const texto = /^[=+\-@\t\r]/.test(crudo) ? `'${crudo}` : crudo;
    return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const lineas = [
    ["Carpeta", "Pieza", "Vueltas", "Estado", "Cuándo", "Qué pasó", "Quién", "Detalle"],
    ...filas.map((f) => [
      f.carpeta,
      f.pieza,
      f.vueltas,
      f.estado,
      f.cuando,
      f.que,
      f.quien,
      f.detalle,
    ]),
  ];
  return "﻿" + lineas.map((l) => l.map(celda).join(";")).join("\r\n") + "\r\n";
}
