// Quién de la agencia está usando la aplicación.
//
// **Es la única función de toda la aplicación que contesta esa pregunta.** Todo
// lo que queda anotado —quién mandó un mensaje, quién entregó, quién reabrió—
// pasa por acá. Durante mucho tiempo contestó «no sé» y todo quedó firmado «El
// equipo»; ahora lee la galleta que dejó la puerta y contesta el nombre. No
// hubo que tocar nada de lo que anota: ese era el punto de que esto existiera
// vacío.
//
// Hubo por un rato un desplegable al pie de la barra para elegir quién sos, y
// se sacó: elegirse a uno mismo de una lista no es una sesión. Si alguien se
// olvida de cambiarlo, lo que queda anotado es mentira, y una anotación que a
// veces miente es peor que no tenerla. Mejor decir «El equipo» hasta que se
// pueda decir la verdad.
//
// **Sigue pudiendo contestar «no sé»**, y hay un caso real: la llave del equipo.
// Mientras nadie tenga contraseña cargada alguien tiene que poder entrar a
// ponerlas, y esa sesión no es de nadie en particular. Lo que haga queda
// firmado «El equipo», que es la verdad.

import { cookies } from "next/headers";
import { GALLETA_DE_GESTION, personaDeLaGalleta, SIN_PERSONA } from "@/lib/contrasena";
import { personaPorId, type Persona } from "@/lib/equipo";

/** Cómo se firma lo que no lo manda una persona identificada. */
export const LA_AGENCIA = "El equipo";

/**
 * Quién está usando esto, o `null` si no se sabe.
 *
 * Devuelve la persona entera y no su identificador: quien pregunta casi siempre
 * quiere el nombre o el correo, y hacerle buscar la persona después sería
 * repartir la misma búsqueda por toda la aplicación.
 *
 * `null` con la llave del equipo —el arranque, antes de que nadie tenga
 * contraseña— y `null` también si la persona se dio de baja mientras tenía la
 * sesión abierta: la galleta sigue firmada pero ya no hay a quién nombrar.
 */
export async function quienSoy(): Promise<Persona | null> {
  const galleta = (await cookies()).get(GALLETA_DE_GESTION)?.value;
  const id = personaDeLaGalleta(galleta);
  if (!id || id === SIN_PERSONA) return null;
  return personaPorId(id);
}

/**
 * El nombre con el que queda firmado lo que se hace.
 *
 * **Todo lo que la agencia hace y queda anotado pasa por acá**: los mensajes
 * al cliente, las entregas, las reaperturas, las revisiones adicionales.
 */
export async function firmaDeAgencia(): Promise<string> {
  return (await quienSoy())?.nombre ?? LA_AGENCIA;
}
