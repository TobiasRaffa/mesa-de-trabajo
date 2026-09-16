// Cómo se escribe una fecha en las pantallas de gestión.
//
// Estaba copiado tres veces —el mismo `Intl.DateTimeFormat` con las mismas
// opciones— en la ficha de la pieza, en la configuración y en la historia. Tres
// copias de un formato es una manera lenta de que un día digan cosas distintas.

const conHora = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const soloDia = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

/** Un instante anotado por la aplicación, que siempre viene en ISO. */
export function enPalabrasLaFecha(iso: string): string {
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? "" : conHora.format(f);
}

/**
 * Un día suelto, de los que se escriben «2026-09-17».
 *
 * Se arma con los tres números y no con `new Date(dia)`: así, esa cadena se lee
 * como medianoche UTC, y en Buenos Aires eso es el día anterior a las nueve de
 * la noche. Un vencimiento corrido un día para atrás no se nota hasta que
 * alguien llega tarde.
 */
export function enPalabrasElDia(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  if (!a || !m || !d) return dia;
  return soloDia.format(new Date(a, m - 1, d));
}
