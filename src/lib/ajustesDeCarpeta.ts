// Qué se muestra de cada carpeta, y cómo.
//
// La agencia arma carpetas en Drive —«Logos», «Calendario septiembre»,
// «Banners»— y decide dos cosas sobre cada una: **si el cliente la ve** y **si
// se mira como lista o como mes**. Eso no puede vivir en Drive, porque Drive
// no tiene dónde anotarlo.
//
// Este módulo es el lugar donde esa decisión se responde. Hoy contesta desde
// variables de entorno, que es lo único que hay sin base de datos. Cuando
// exista el panel de administración, se cambia el cuerpo de estas dos
// funciones por una consulta y **no se toca ninguna pantalla**: por eso están
// acá y no desparramadas en el portal.
//
// La regla por omisión es «se muestra, como lista». Una carpeta nueva en Drive
// aparece sola, sin configurar nada; ocultarla es la acción deliberada.

export type Vista = "lista" | "calendario";

export type AjustesDeCarpeta = {
  visible: boolean;
  vista: Vista;
};

/** Lee una lista de identificadores separados por coma. */
function lista(variable: string | undefined): string[] {
  return (variable ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function ajustesDe(carpetaId: string): AjustesDeCarpeta {
  return {
    visible: !lista(process.env.CARPETAS_OCULTAS).includes(carpetaId),
    vista: lista(process.env.CARPETAS_CALENDARIO).includes(carpetaId)
      ? "calendario"
      : "lista",
  };
}

/** Deja solo las carpetas que el cliente puede ver. */
export function soloLasVisibles<T extends { id: string }>(carpetas: T[]): T[] {
  return carpetas.filter((c) => ajustesDe(c.id).visible);
}
