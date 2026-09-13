// Quién de la agencia está usando la aplicación.
//
// **Hoy no lo sabe nadie, y eso está bien: todavía no hay login.** Esta es la
// única función de toda la aplicación que contesta esa pregunta, y contesta
// «no sé». Todo lo que queda anotado —quién mandó un mensaje, quién entregó,
// quién reabrió— pasa por acá, así que el día que exista el login **se cambia
// esto y nada más**.
//
// Hubo por un rato un desplegable al pie de la barra para elegir quién sos, y
// se sacó: elegirse a uno mismo de una lista no es una sesión. Si alguien se
// olvida de cambiarlo, lo que queda anotado es mentira, y una anotación que a
// veces miente es peor que no tenerla. Mejor decir «El equipo» hasta que se
// pueda decir la verdad.
//
// ---
//
// **Qué falta para terminarlo**, cuando llegue el momento —va junto con
// Supabase, que es donde van a vivir las contraseñas—:
//
//   1. Una pantalla de entrada que pida correo y contraseña. El correo ya
//      existe: es el de cada persona del equipo, que la agencia carga en
//      Admin → El equipo. Esa lista **es** la lista de usuarios; no hace falta
//      inventar otra.
//   2. Guardar la contraseña de cada persona —cifrada, nunca el texto— junto
//      a su ficha en el equipo.
//   3. Al entrar, dejar una galleta **firmada** con el identificador de esa
//      persona. Firmada, a diferencia de la de antes: cuando haya una puerta,
//      hacerse pasar por otro tiene que ser imposible, no solo incómodo.
//   4. Que `quienSoy()` lea esa galleta y devuelva la persona.
//
// El paso 4 es el único que toca este archivo, y los otros tres no tocan nada
// de lo que ya está escrito. Ese es el punto de que esto exista vacío.

import type { Persona } from "@/lib/equipo";

/** Cómo se firma lo que no lo manda una persona identificada. */
export const LA_AGENCIA = "El equipo";

/**
 * Quién está usando esto, o `null` si no se sabe.
 *
 * Hoy devuelve siempre `null` porque no hay login. Devuelve la persona entera
 * y no su identificador: quien pregunta casi siempre quiere el nombre o el
 * correo, y hacerle buscar la persona después sería repartir la misma búsqueda
 * por toda la aplicación.
 */
export async function quienSoy(): Promise<Persona | null> {
  // Cuando exista el login, acá se lee la galleta firmada y se devuelve la
  // persona con `personaPorId` de `@/lib/equipo`. Son dos líneas.
  return null;
}

/**
 * El nombre con el que queda firmado lo que se hace.
 *
 * **Todo lo que la agencia hace y queda anotado pasa por acá**: los mensajes
 * al cliente, las entregas, las reaperturas, las revisiones adicionales. Hoy
 * todas dicen «El equipo»; el día que haya login, todas dicen el nombre de
 * quien lo hizo, sin tocar ninguna de ellas.
 */
export async function firmaDeAgencia(): Promise<string> {
  return (await quienSoy())?.nombre ?? LA_AGENCIA;
}
