// Hace cuánto que una cosa está quieta de nuestro lado, y cuándo eso alarma.
//
// **No es un plazo.** El plazo es del cliente y lo mide `plazos`; nosotros no
// tenemos ninguno. Esto mide otra cosa: cuánto hace que algo no se mueve
// estando en nuestra cancha, que es lo único que avisa de un trabajo
// olvidado. Un trabajo puede estar lejísimos de vencer y llevar una semana
// parado sobre un escritorio.
//
// **Y es una sola regla, en un solo lugar.** Estaba escrita en tres pantallas
// —el tablero, la ventana de un trabajo y el árbol— con los mismos dos
// números copiados. Tres copias de un umbral es una manera lenta de que un día
// el mismo archivo se vea naranja en una pantalla y rojo en la de al lado, y
// que nadie sepa cuál tiene razón.

/** Desde acá avisa: todavía se llega, pero hay que mirarlo. */
export const AVISA_DESDE = 2;

/** Desde acá alarma: esto se está quedando quieto. */
export const ALARMA_DESDE = 3;

export type Espera = "al_dia" | "avisa" | "alarma";

/**
 * Cómo va algo que hace tantos días que tenemos.
 *
 * Son días y no un porcentaje de nada, porque no hay de qué sacar un
 * porcentaje: acá no se mide contra un plazo, se mide contra el olvido.
 */
export function comoVaLaEspera(dias: number | null): Espera {
  if (dias === null || dias < AVISA_DESDE) return "al_dia";
  return dias >= ALARMA_DESDE ? "alarma" : "avisa";
}

/**
 * Lo más viejo de un conjunto.
 *
 * **Es lo que hace que el problema se vea desde afuera.** Una carpeta con
 * cinco piezas al día y una parada hace cinco días tiene un problema, y si el
 * número de la carpeta promediara o contara solo lo suyo, ese problema viviría
 * en el último escalón: justamente el que nadie abre.
 *
 * Por eso manda el peor y no el promedio. Y `null` —nada de nuestro lado— no
 * es un cero: es que no hay nada que contar, y contarlo como cero pondría «al
 * día» sobre una carpeta que no tiene nada.
 */
export function masVieja(dias: Array<number | null>): number | null {
  const hay = dias.filter((d): d is number => d !== null);
  return hay.length > 0 ? Math.max(...hay) : null;
}
