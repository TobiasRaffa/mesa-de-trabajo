// La contraseña que protege lo delicado de administración.
//
// Hoy protege una sola cosa: **ver o cambiar la clave de un cliente**. Es el
// dato con el que alguien entra a su portal, y estaba a la vista de cualquiera
// que abriera la pantalla.
//
// Durante un tiempo esto fue **una cortina y no una puerta**: protegía ver la
// clave de un cliente, y nada más. El resto de gestión —el árbol de clientes,
// los chats, el tablero, habilitar y deshabilitar— abría con solo escribir la
// dirección. Este archivo lo decía en un comentario, y el documento de
// despliegue afirmaba lo contrario: «Entrar a gestión. Tiene que pedir la
// contraseña». Un pendiente anotado en un lugar y desmentido en otro es un
// pendiente que no existe.
//
// Ahora es la puerta. `proxy.ts` no deja pasar a nada que cuelgue de `/gestion`
// ni al diagnóstico sin la galleta de acá, así que una pantalla nueva nace
// protegida sin que nadie tenga que acordarse.
//
// **Ya no es la llave del equipo: ahora cada una entra con la suya.** Esto
// quedó para dos cosas. Una, seguir protegiendo la clave de un cliente. La
// otra, firmar la galleta de sesión: como la firma sale de acá, cambiar
// `CLAVE_DE_ADMIN` echa a todo el mundo en el acto, sin una lista de sesiones
// abiertas que después nadie mantiene.
//
// Y sirve de llave de arranque: mientras nadie del equipo tenga contraseña, la
// puerta la acepta para poder cargar la primera. Ese camino se cierra solo en
// cuanto alguien tiene la suya.
//
// Sale de una variable de entorno y no del código: una contraseña escrita en
// el fuente termina en el repositorio, y de ahí no sale más.

import { createHmac, timingSafeEqual } from "node:crypto";

export function hayContrasena(): boolean {
  return Boolean(process.env.CLAVE_DE_ADMIN?.trim());
}

/**
 * Compara en tiempo constante.
 *
 * `===` tarda distinto según cuántos caracteres coinciden, y esa diferencia se
 * puede medir para ir adivinando de a un carácter.
 */
export function contrasenaCorrecta(escrita: string): boolean {
  const esperada = process.env.CLAVE_DE_ADMIN?.trim();
  // Sin contraseña configurada no se abre nada: el lado seguro del error.
  if (!esperada) return false;

  const a = Buffer.from(esperada);
  const b = Buffer.from(String(escrita ?? "").trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------

/**
 * El nombre de la galleta de gestión. No dice qué es ni de quién.
 */
export const GALLETA_DE_GESTION = "mdt_gestion";

/**
 * Quién entró con la llave del equipo y no con la suya.
 *
 * Es el arranque: la primera vez no hay ninguna contraseña cargada, así que
 * alguien tiene que poder entrar a ponerlas. Lo que haga queda firmado «El
 * equipo», igual que antes de que existiera el login, porque de verdad no se
 * sabe quién es.
 */
export const SIN_PERSONA = "equipo";

/**
 * Lo que se guarda en la galleta cuando alguien entra.
 *
 * Es el identificador de la persona **más una firma nuestra**. Leerla no sirve
 * para nada y fabricarla sin la llave no se puede: cambiar el identificador a
 * mano rompe la firma. Antes era una marca igual para todos —servía para decir
 * «este navegador es del equipo» y nada más—, así que hacerse pasar por otro
 * era imposible porque no había otro por quien pasarse.
 *
 * `null` cuando no hay `CLAVE_DE_ADMIN`, que es lo que hace que sin configurar
 * no se abra nada.
 */
export function valorDeSesion(personaId: string): string | null {
  const firma = firmarSesion(personaId);
  return firma && `${personaId}.${firma}`;
}

/**
 * De quién es esta galleta, o `null` si no la firmamos nosotros.
 *
 * Devuelve el identificador y no un sí o un no, porque quien pregunta casi
 * siempre quiere saber **quién**: es lo que hace que lo anotado deje de decir
 * «El equipo».
 */
export function personaDeLaGalleta(valor: string | undefined): string | null {
  if (!valor) return null;

  const corte = valor.lastIndexOf(".");
  if (corte <= 0) return null;

  const personaId = valor.slice(0, corte);
  const firma = valor.slice(corte + 1);
  const esperada = firmarSesion(personaId);
  if (!esperada) return null;

  const a = Buffer.from(esperada);
  const b = Buffer.from(firma);
  return a.length === b.length && timingSafeEqual(a, b) ? personaId : null;
}

/** Si esta galleta la firmamos nosotros. */
export const galletaDeGestionValida = (valor: string | undefined): boolean =>
  personaDeLaGalleta(valor) !== null;

function firmarSesion(personaId: string): string | null {
  const clave = process.env.CLAVE_DE_ADMIN?.trim();
  if (!clave) return null;
  return createHmac("sha256", clave).update(`entro:${personaId}`).digest("base64url");
}
