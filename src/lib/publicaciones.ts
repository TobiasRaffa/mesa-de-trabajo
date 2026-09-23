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

import { coleccion } from "@/lib/almacen";
import { diaEnBuenosAires } from "@/lib/fechas";

/** `AAAA-MM-DD`. */
export type DiaSuelto = string;

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

/**
 * Arma un día a partir de una fecha, **en el huso de Buenos Aires** y no en
 * el del servidor: en internet el servidor vive en tiempo universal, y la
 * misma fecha era «ayer» a partir de las nueve de la noche.
 */
export function diaDe(fecha: Date): DiaSuelto {
  return diaEnBuenosAires(fecha);
}

/**
 * Convierte un día en una fecha del calendario local.
 *
 * Se arma con el constructor de tres números y no parseando el texto: Date
 * interpreta `"2026-09-12"` como medianoche **UTC**, que en Buenos Aires es el
 * 11 a las 21. La pieza aparecería un día antes.
 */
export function fechaDeDia(dia: DiaSuelto): Date {
  // El mediodía de Buenos Aires, a propósito. Un instante que viaja del
  // servidor al navegador se muestra en el huso del navegador: la medianoche
  // caía en el día anterior apenas el servidor estuviera en tiempo universal.
  // Al mediodía, cualquier pantalla de este lado del mundo lee el mismo día.
  return new Date(`${dia}T12:00:00-03:00`);
}

const almacen = coleccion<DiaSuelto>("publicaciones", esDiaValido);

export async function publicacionesDe(archivos: string[]): Promise<Record<string, DiaSuelto>> {
  const todo = await almacen.todo();
  const salida: Record<string, DiaSuelto> = {};
  for (const id of archivos) if (todo[id]) salida[id] = todo[id];
  return salida;
}

/**
 * Pasa la fecha de una pieza a su nombre nuevo.
 *
 * **La fecha va por la identidad de la pieza, y la identidad puede cambiar**:
 * sale del nombre de la vuelta más baja, así que borrar `stickers.pdf` y dejar
 * `V2 stickers.jpg` la muda de `::stickers.pdf` a `::stickers.jpg`. La ficha se
 * muda en `estadosDe`; sin esto la fecha quedaba bajo el nombre viejo y la
 * pieza caía en «sin fecha», del calendario de la agencia y del del cliente.
 *
 * No pisa una fecha que el nombre nuevo ya tenga, salvo con `pisar`: es cuando
 * lo que había bajo el nombre nuevo era de un archivo que ya no existe.
 */
export async function mudarPublicacion(
  viejo: string,
  nuevo: string,
  { pisar = false }: { pisar?: boolean } = {}
): Promise<void> {
  const dia = await almacen.uno(viejo);
  if (dia === undefined) return;
  await almacen.cambiar(nuevo, (actual) => (pisar ? dia : (actual ?? dia)));
  await almacen.borrar(viejo);
}

/**
 * Guarda de una sola vez las fechas de una carpeta.
 *
 * Es una sola operación y no una por pieza porque así se guarda el calendario:
 * se acomodan varias piezas y recién ahí se aprieta guardar. Media docena de
 * escrituras sueltas podrían dejar el guardado a mitad de camino si algo falla
 * en el medio.
 *
 * Un archivo con `null` pierde su fecha: es cómo se saca una pieza del
 * calendario y vuelve al montón de las que todavía no tienen día.
 */
export async function guardarPublicaciones(
  cambios: Record<string, DiaSuelto | null>
): Promise<void> {
  const aGuardar: Record<string, DiaSuelto | undefined> = {};
  for (const [archivo, dia] of Object.entries(cambios)) {
    if (dia === null) aGuardar[archivo] = undefined;
    else if (esDiaValido(dia)) aGuardar[archivo] = dia;
  }
  await almacen.guardarVarios(aGuardar);
}
