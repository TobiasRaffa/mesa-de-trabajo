// Los días de revisión, sin nada del sistema de archivos.
//
// Está separado de `plazos.ts` por una razón concreta: el desplegable de días
// vive en una pantalla del navegador, y `plazos.ts` lee y escribe archivos.
// Importarlo desde el navegador arrastraba `node:fs` al paquete del cliente y
// **rompía la compilación entera** —con un mensaje que no nombra al culpable—.
//
// La regla que deja: lo que una pantalla necesita saber va en un módulo que no
// toque el servidor.

/** Lo que se ofrece en el desplegable. */
export const DIAS_POSIBLES = Array.from({ length: 30 }, (_, i) => i + 1);

/**
 * Lo que se asume cuando nadie eligió nada.
 *
 * Tres días corridos: entra un fin de semana y sigue siendo esta semana. Es
 * corto a propósito —un plazo largo se olvida igual— y se cambia por cliente.
 */
export const DIAS_POR_OMISION = 3;

export function diasValidos(dias: unknown): dias is number {
  return typeof dias === "number" && Number.isInteger(dias) && dias >= 1 && dias <= 30;
}

/** El plazo que corre: el propio, si no el de arriba, si no el de más arriba. */
export function plazoQueCorre(
  delArchivo: number | undefined,
  deLaCarpeta: number | undefined,
  delCliente: number | undefined
): number {
  return delArchivo ?? deLaCarpeta ?? delCliente ?? DIAS_POR_OMISION;
}
