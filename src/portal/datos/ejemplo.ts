// Datos de ejemplo para ver las pantallas antes de que exista la base.
//
// Las imágenes son reales: salen de la carpeta de prueba de Drive, a través de
// la misma ruta que va a usar el portal de verdad. Lo único inventado son los
// nombres, los comentarios y los estados.
//
// Este archivo se borra el día que las pantallas lean de la base de datos.

import type { Estado } from "@/dominio/pieza";
import { listarCarpeta } from "@/lib/google";
import { calcularVencimiento } from "@/lib/fechas";

export type PiezaEjemplo = {
  id: string;
  nombre: string;
  driveFileId: string;
  modificado?: string;
  estado: Estado;
  ronda: number;
  version: number;
};

export type ComentarioEjemplo = {
  quien: string;
  cuando: string;
  texto: string;
};

export type EntregaEjemplo = {
  cliente: string;
  proyecto: string;
  plazoDias: number;
  enviada: Date;
  vence: Date;
  rondasIncluidas: number;
  rondasExtra: number;
  piezas: PiezaEjemplo[];
  comentarios: ComentarioEjemplo[];
};

const GUION: Array<{ nombre: string; estado: Estado; ronda: number; version: number }> = [
  { nombre: "01 · Apertura de temporada", estado: "final", ronda: 1, version: 2 },
  { nombre: "02 · Carta de otoño", estado: "entregada", ronda: 0, version: 1 },
  { nombre: "03 · Otoño en taza", estado: "cambios_marcados", ronda: 1, version: 3 },
  { nombre: "04 · Cierre de mes", estado: "entregada", ronda: 0, version: 1 },
];

export async function entregaDeEjemplo(): Promise<EntregaEjemplo> {
  const carpeta = process.env.DRIVE_TEST_FOLDER;
  const archivos = carpeta ? await listarCarpeta(carpeta) : [];

  const piezas: PiezaEjemplo[] = archivos.slice(0, GUION.length).map((archivo, i) => ({
    id: archivo.id,
    nombre: GUION[i].nombre,
    driveFileId: archivo.id,
    modificado: archivo.modifiedTime,
    estado: GUION[i].estado,
    ronda: GUION[i].ronda,
    version: GUION[i].version,
  }));

  // Enviada hace dos días, con cuatro de plazo: quedan dos.
  const enviada = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  return {
    cliente: "Café Otoño",
    proyecto: "Campaña de temporada",
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
