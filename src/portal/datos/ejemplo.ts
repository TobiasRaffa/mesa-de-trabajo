// Datos de ejemplo para ver las pantallas antes de que exista la base.
//
// Las imágenes son reales: salen de la carpeta de prueba de Drive, a través de
// la misma ruta que va a usar el portal de verdad. Lo inventado son los
// nombres, los comentarios, los estados, las versiones y las fechas.
//
// Este archivo se borra el día que las pantallas lean de la base de datos.

import type { Estado } from "@/dominio/pieza";
import { listarCarpeta } from "@/lib/google";
import { calcularVencimiento } from "@/lib/fechas";

/** Una vuelta anterior de la misma pieza, para poder compararlas. */
export type VersionEjemplo = {
  numero: number;
  driveFileId: string;
  modificado?: string;
  entregadaEl: Date;
};

export type PiezaEjemplo = {
  id: string;
  nombre: string;
  driveFileId: string;
  modificado?: string;
  estado: Estado;
  ronda: number;
  /** De la más vieja a la más nueva. La última es la que se está mirando. */
  versiones: VersionEjemplo[];
  /** Cuándo sale publicada. Solo en entregas con vista de calendario. */
  publicaEl?: Date;
};

export type ComentarioEjemplo = {
  quien: string;
  cuando: string;
  texto: string;
};

export type EntregaEjemplo = {
  id: string;
  cliente: string;
  proyecto: string;
  /** Cómo se le muestra al cliente: una lista, o ubicada en el mes. */
  vista: "lista" | "calendario";
  plazoDias: number;
  enviada: Date;
  vence: Date;
  rondasIncluidas: number;
  rondasExtra: number;
  piezas: PiezaEjemplo[];
  comentarios: ComentarioEjemplo[];
};

const DIA = 24 * 60 * 60 * 1000;

const GUION: Array<{ nombre: string; estado: Estado; ronda: number; diaDelMes: number }> = [
  { nombre: "Apertura de temporada", estado: "final", ronda: 1, diaDelMes: 2 },
  { nombre: "Carta de otoño", estado: "entregada", ronda: 0, diaDelMes: 5 },
  { nombre: "Otoño en taza", estado: "cambios_marcados", ronda: 1, diaDelMes: 11 },
  { nombre: "Cierre de mes", estado: "entregada", ronda: 0, diaDelMes: 18 },
];

export async function entregaDeEjemplo(): Promise<EntregaEjemplo> {
  const carpeta = process.env.DRIVE_TEST_FOLDER;
  const archivos = carpeta ? await listarCarpeta(carpeta) : [];
  const ahora = new Date();

  const piezas: PiezaEjemplo[] = archivos.slice(0, GUION.length).map((archivo, i) => {
    const guion = GUION[i];

    // Las vueltas anteriores usan las otras imágenes de la carpeta, para que
    // comparar versiones muestre dos cosas distintas y no la misma dos veces.
    const versiones: VersionEjemplo[] = [];
    for (let vuelta = 0; vuelta <= guion.ronda; vuelta++) {
      const deLaVuelta = archivos[(i + vuelta) % archivos.length];
      versiones.push({
        numero: vuelta + 1,
        driveFileId: deLaVuelta.id,
        modificado: deLaVuelta.modifiedTime,
        entregadaEl: new Date(ahora.getTime() - (guion.ronda - vuelta + 2) * DIA),
      });
    }

    const ultima = versiones[versiones.length - 1];

    return {
      id: archivo.id,
      nombre: `${String(i + 1).padStart(2, "0")} · ${guion.nombre}`,
      driveFileId: ultima.driveFileId,
      modificado: ultima.modificado,
      estado: guion.estado,
      ronda: guion.ronda,
      versiones,
      publicaEl: new Date(ahora.getFullYear(), ahora.getMonth(), guion.diaDelMes),
    };
  });

  // Enviada hace dos días, con cuatro de plazo: quedan dos.
  const enviada = new Date(ahora.getTime() - 2 * DIA);

  return {
    id: "ejemplo-campana-temporada",
    cliente: "Café Otoño",
    proyecto: "Grilla de este mes",
    vista: "calendario",
    plazoDias: 4,
    enviada,
    vence: calcularVencimiento(enviada, 4),
    rondasIncluidas: 2,
    rondasExtra: 0,
    piezas,
    comentarios: [
      {
        quien: "Laura",
        cuando: "hoy 11:20",
        texto: "Me encanta el color, pero el sol pisa la bajada. ¿Se puede correr un poco?",
      },
      {
        quien: "Diego",
        cuando: "hoy 11:24",
        texto: "La fecha tiene que decir «desde el 12/3», así lo pusimos en el local.",
      },
    ],
  };
}
