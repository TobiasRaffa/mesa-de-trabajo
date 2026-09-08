// Reglas de las miniaturas, sin nada de red.
//
// Están separadas del cliente de Drive para poder probarlas: son decisiones,
// no llamadas.

/**
 * Tamaños que la aplicación sirve. Es una lista cerrada a propósito: si se
 * aceptara cualquier número, alguien podría pedir imágenes enormes y hacer
 * trabajar al servidor de gusto.
 */
export const TAMANOS = [220, 400, 800, 1200] as const;
export const TAMANO_POR_DEFECTO = 400;

export type Tamano = (typeof TAMANOS)[number];

/** Convierte lo que haya pedido el navegador en un tamaño permitido. */
export function tamanoPermitido(valor: string | number | null | undefined): Tamano {
  const n = Number(valor);
  return (TAMANOS as readonly number[]).includes(n) ? (n as Tamano) : TAMANO_POR_DEFECTO;
}

/**
 * Ajusta el tamaño en la dirección que da Google.
 *
 * Las direcciones terminan en `=s220` (a veces `=s220-c` si viene recortada).
 * Se reemplaza ese sufijo en lugar de agregar otro, porque dos sufijos dan una
 * dirección inválida.
 */
export function urlConTamano(link: string, px: number): string {
  return link.replace(/=s\d+(-c)?$/, "") + `=s${px}`;
}
