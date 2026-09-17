// Quién de la agencia está usando la aplicación, y qué le toca ver.
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
//
// **Y ahora contesta además qué puede ver.** Se calcula cada vez a partir del
// rol guardado y no se lleva adentro de la galleta: si viajara en la galleta,
// quitarle el acceso a alguien no haría efecto hasta que volviera a entrar, y
// «le saqué el acceso» tiene que querer decir ahora.

import { cookies } from "next/headers";
import { GALLETA_DE_GESTION, personaDeLaGalleta, SIN_PERSONA } from "@/lib/contrasena";
import { personaPorId, seccionesDePersona, type Persona } from "@/lib/equipo";
import { seccionesDe, type Seccion } from "@/dominio/roles";

/** Cómo se firma lo que no lo manda una persona identificada. */
export const LA_AGENCIA = "El equipo";

export type Sesion = {
  /** Quién es. `null` con la llave del equipo, que no es de nadie. */
  persona: Persona | null;
  /** Qué partes de la gestión le tocan. */
  secciones: Seccion[];
};

/**
 * Qué hay detrás de una galleta cualquiera.
 *
 * Recibe el valor en vez de leerlo porque **la puerta no puede leer galletas
 * como las lee una pantalla**: `proxy.ts` corre antes de que exista un pedido
 * con `cookies()`, y tiene las suyas en la mano. Que las dos respuestas salgan
 * de la misma función es justamente lo que evita que la puerta y las pantallas
 * terminen opinando distinto sobre quién sos.
 */
export async function quienLleva(galleta: string | undefined): Promise<Sesion | null> {
  const id = personaDeLaGalleta(galleta);
  if (!id) return null;

  // La llave del equipo, el arranque: no es nadie, pero tiene que poder cargar
  // a la primera persona, y eso vive en Admin.
  if (id === SIN_PERSONA) return { persona: null, secciones: seccionesDe("admin") };

  const persona = await personaPorId(id);
  // La galleta sigue firmada pero la persona ya no está: se la dio de baja
  // mientras tenía la sesión abierta. No es nadie, y no ve nada.
  if (!persona) return null;

  return { persona, secciones: seccionesDePersona(persona) };
}

/** Lo mismo, desde una pantalla o una acción. */
export async function miSesion(): Promise<Sesion | null> {
  return quienLleva((await cookies()).get(GALLETA_DE_GESTION)?.value);
}

/**
 * Quién está usando esto, o `null` si no se sabe.
 *
 * Devuelve la persona entera y no su identificador: quien pregunta casi siempre
 * quiere el nombre o el correo, y hacerle buscar la persona después sería
 * repartir la misma búsqueda por toda la aplicación.
 */
export async function quienSoy(): Promise<Persona | null> {
  return (await miSesion())?.persona ?? null;
}

/**
 * Si quien está usando esto puede entrar a una sección.
 *
 * **Es el segundo cerrojo de las acciones de servidor.** El primero es la
 * puerta: una acción se manda a la dirección de la pantalla que la dibujó, así
 * que un POST de una acción de Admin llega a `/gestion/admin` y se rebota como
 * cualquier otra cosa. Pero eso depende de en qué pantalla se dibujó el
 * formulario, que es una decisión de quien arma la pantalla y puede cambiar
 * mañana sin que nadie se acuerde de esto. Una acción es un endpoint público:
 * la que cambia quién entra a qué tiene que preguntarlo ella misma.
 */
export async function puedoVer(seccion: Seccion): Promise<boolean> {
  return (await miSesion())?.secciones.includes(seccion) ?? false;
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
