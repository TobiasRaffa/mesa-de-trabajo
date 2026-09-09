// Cuándo sale publicada cada pieza.
//
// Es el dato que le faltaba al calendario. Drive no lo sabe —un archivo tiene
// fecha de subida, no de publicación— y no se puede deducir del nombre sin
// inventar. Lo pone la agencia, arrastrando la pieza al día que corresponde.
//
// Se guarda por **archivo de Drive** y no por carpeta: dentro de una grilla
// mensual cada posteo sale un día distinto, que es justamente el punto.
//
// La fecha se guarda como `AAAA-MM-DD` y no como un instante. Un posteo sale
// «el 12», no «el 12 a las 03:00 UTC»: guardar una hora que nadie eligió es
// pedir que un cambio de horario lo mueva un día.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** `AAAA-MM-DD`. */
export type DiaSuelto = string;

const CARPETA_DE_DATOS = path.join(process.cwd(), "datos");
const ARCHIVO = path.join(CARPETA_DE_DATOS, "publicaciones.json");

const FORMA = /^\d{4}-\d{2}-\d{2}$/;

/** Si ese texto es un día con forma de día, y además existe en el calendario. */
export function esDiaValido(dia: unknown): dia is DiaSuelto {
  if (typeof dia !== "string" || !FORMA.test(dia)) return false;
  const [a, m, d] = dia.split("-").map(Number);
  // `new Date` acepta el 31 de febrero y lo corre al 3 de marzo. Se compara
  // contra lo que quedó para no guardar una fecha que no existe.
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return (
    fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d
  );
}

/** Arma un día a partir de una fecha, en el huso de acá. */
export function diaDe(fecha: Date): DiaSuelto {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Convierte un día en una fecha del calendario local.
 *
 * Se arma con el constructor de tres números y no parseando el texto: Date
 * interpreta `"2026-09-12"` como medianoche **UTC**, que en Buenos Aires es el
 * 11 a las 21. La pieza aparecería un día antes.
 */
export function fechaDeDia(dia: DiaSuelto): Date {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(a, m - 1, d);
}

type Guardado = Record<string, DiaSuelto>;

async function leerTodo(): Promise<Guardado> {
  try {
    const crudo = await readFile(ARCHIVO, "utf8");
    const datos = JSON.parse(crudo) as unknown;
    if (!datos || typeof datos !== "object") return {};

    const salida: Guardado = {};
    for (const [archivo, dia] of Object.entries(datos as Record<string, unknown>)) {
      // El archivo se puede editar a mano: se acepta solo lo que tiene forma.
      if (esDiaValido(dia)) salida[archivo] = dia;
    }
    return salida;
  } catch {
    return {};
  }
}

export async function publicacionesDe(archivos: string[]): Promise<Record<string, DiaSuelto>> {
  const todo = await leerTodo();
  const salida: Record<string, DiaSuelto> = {};
  for (const id of archivos) if (todo[id]) salida[id] = todo[id];
  return salida;
}

/**
 * Guarda de una sola vez las fechas de una carpeta.
 *
 * Es una sola operación y no una por pieza porque así se guarda el calendario:
 * se acomodan varias piezas y recién ahí se aprieta guardar. Media docena de
 * escrituras sueltas podrían dejar el archivo a mitad de camino si algo falla
 * en el medio.
 *
 * Un archivo con `null` pierde su fecha: es cómo se saca una pieza del
 * calendario y vuelve al montón de las que todavía no tienen día.
 */
export async function guardarPublicaciones(
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
