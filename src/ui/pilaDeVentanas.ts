// Quién manda cuando hay varias ventanas abiertas.
//
// Al ampliar una pieza quedan dos ventanas, una encima de la otra. Mientras
// cada una escuchaba el teclado por su cuenta, Escape las cerraba a las dos de
// golpe: se cerraba la imagen y, detrás, la pieza entera que se estaba
// revisando —con lo escrito a medias adentro—.
//
// La regla es una sola: **atiende la de más arriba**. Esto es la pila que lo
// decide, sin tocar el navegador, para poder probarla sin uno.

/** Una ventana abierta. El símbolo no se puede confundir con el de otra. */
export type Ficha = symbol;

const pila: Ficha[] = [];

/** Anota una ventana recién abierta y la deja arriba de todo. */
export function abrir(nombre = "ventana"): Ficha {
  const ficha = Symbol(nombre);
  pila.push(ficha);
  return ficha;
}

/**
 * Saca una ventana de la pila.
 *
 * Saca esa y no la última: si se cierra una del medio —algo que React puede
 * hacer al redibujar—, quitar la de arriba dejaría mandando a una ventana que
 * ya no está en pantalla.
 */
export function cerrar(ficha: Ficha): void {
  const donde = pila.indexOf(ficha);
  if (donde >= 0) pila.splice(donde, 1);
}

/** Si esta ventana es la que tiene que atender el teclado. */
export function esLaDeArriba(ficha: Ficha): boolean {
  return pila.length > 0 && pila[pila.length - 1] === ficha;
}

/** Cuántas hay abiertas. Existe para las pruebas. */
export function cuantasHay(): number {
  return pila.length;
}
