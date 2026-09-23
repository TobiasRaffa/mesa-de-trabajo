// Cómo viene una cuenta, en números.
//
// Lo que se pregunta al presupuestar o al discutir con un cliente: cuántas
// piezas, cuántas vueltas por pieza, cuántas revisiones de más, cuánto tarda
// en decidir. Sale de la misma historia que ve el árbol; acá se cuenta.

import { esCarpetaReservada } from "@/lib/ajustes";
import { sigueEnJuego } from "@/dominio/pieza";
import { subcarpetasDe } from "@/lib/google";
import { estadosDe, type EstadoDePieza } from "@/lib/piezas";
import { trabajosDeLaCarpeta } from "@/lib/trabajos";
import { conSusArchivos } from "@/lib/versiones";

export type Estadisticas = {
  piezas: number;
  aprobadas: number;
  enJuego: number;
  /** Cuántas vueltas por pieza, en promedio. Una pieza sin vueltas tiene 1. */
  vueltasPromedio: number;
  /** Cuántas piezas necesitaron más de dos vueltas. */
  conMasDeDosVueltas: number;
  /** Revisiones adicionales habilitadas, en total. */
  revisionesExtra: number;
  /**
   * Cuántos días tarda el cliente en decidir, en promedio, desde que se le
   * entrega hasta que aprueba o pide cambios. `null` si nunca decidió.
   */
  diasParaDecidir: number | null;
};

/** Hasta dónde se baja. La misma que el tablero. */
const HONDURA = 3;

export async function estadisticasDe(clienteId: string): Promise<Estadisticas> {
  const piezas: Array<{ vueltas: number; estado: EstadoDePieza }> = [];
  await juntar(clienteId, 0, piezas);
  return contar(piezas);
}

async function juntar(
  carpetaId: string,
  hondura: number,
  salida: Array<{ vueltas: number; estado: EstadoDePieza }>
): Promise<void> {
  if (hondura >= HONDURA) return;

  const carpetas = (await subcarpetasDe(carpetaId).catch(() => [])).filter(
    (c) => !esCarpetaReservada(c.name)
  );

  for (const carpeta of carpetas) {
    try {
      const agrupadas = (await trabajosDeLaCarpeta(carpeta.id)).agrupadas;
      const conArchivos = conSusArchivos(carpeta.id, agrupadas);
      const estados = await estadosDe(carpeta.id, conArchivos);
      agrupadas.forEach((pieza, i) => {
        salida.push({ vueltas: pieza.versiones.length, estado: estados[conArchivos[i].id] });
      });
    } catch {
      // Una carpeta ilegible no anula la cuenta de las demás.
    }
    await juntar(carpeta.id, hondura + 1, salida);
  }
}

/** Puro, para poder probarlo con piezas inventadas. */
export function contar(
  piezas: Array<{ vueltas: number; estado: EstadoDePieza }>
): Estadisticas {
  const decisiones: number[] = [];
  for (const { estado } of piezas) {
    for (const dias of diasHastaDecidir(estado)) decisiones.push(dias);
  }

  const promedio = (xs: number[]) =>
    xs.length === 0 ? 0 : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

  return {
    piezas: piezas.length,
    aprobadas: piezas.filter((p) => p.estado.estado === "final").length,
    enJuego: piezas.filter((p) => sigueEnJuego(p.estado.estado)).length,
    vueltasPromedio: promedio(piezas.map((p) => Math.max(1, p.vueltas))),
    conMasDeDosVueltas: piezas.filter((p) => p.vueltas > 2).length,
    revisionesExtra: piezas.reduce((n, p) => n + p.estado.rondasExtra, 0),
    diasParaDecidir: decisiones.length === 0 ? null : promedio(decisiones),
  };
}

/**
 * Cuántos días pasaron entre cada entrega y la decisión que le siguió.
 *
 * Se mira la historia en orden: una «entregada» abre el reloj; la primera
 * «aprobada» o «cambios pedidos» que viene después lo cierra. Una entrega
 * sin decisión todavía no cuenta.
 */
function diasHastaDecidir(estado: EstadoDePieza): number[] {
  const salida: number[] = [];
  let desde: number | null = null;
  const DIA = 24 * 60 * 60 * 1000;

  for (const hito of estado.historia) {
    const momento = new Date(hito.cuando).getTime();
    if (Number.isNaN(momento)) continue;

    if (hito.que === "entregada" || hito.que === "reabierta_por_agencia") {
      desde = momento;
    } else if (desde !== null && (hito.que === "aprobada" || hito.que === "cambios_pedidos")) {
      salida.push(Math.max(0, (momento - desde) / DIA));
      desde = null;
    }
  }
  return salida;
}
