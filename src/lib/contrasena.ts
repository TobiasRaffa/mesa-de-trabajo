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
 * Cuánto dura una sesión, en segundos. Una semana.
 *
 * **El vencimiento va adentro de la firma y no solo en la galleta.** El
 * `maxAge` de una galleta lo respeta el navegador; quien copia el valor y lo
 * manda a mano no tiene navegador que se lo haga respetar. Antes de esto, una
 * galleta robada valía para siempre —hasta que cambiara `CLAVE_DE_ADMIN`—.
 */
export const DURACION_DE_SESION = 60 * 60 * 24 * 7;

/**
 * Quién entró con la llave del equipo y no con la suya.
 *
 * Es el arranque: la primera vez no hay ninguna contraseña cargada, así que
 * alguien tiene que poder entrar a ponerlas. Lo que haga queda firmado «El
 * equipo», igual que antes de que existiera el login, porque de verdad no se
 * sabe quién es.
 */
export const SIN_PERSONA = "equipo";

export type Galleta = {
  personaId: string;
  /** Cuándo se emitió, en segundos desde 1970. */
  emitida: number;
};

const ahoraEnSegundos = () => Math.floor(Date.now() / 1000);

/**
 * Lo que se guarda en la galleta cuando alguien entra.
 *
 * Es el identificador de la persona, cuándo entró, **más una firma nuestra**
 * sobre las dos cosas. Leerla no sirve para nada y fabricarla sin la llave no
 * se puede: cambiar el identificador o la fecha a mano rompe la firma.
 *
 * `null` cuando no hay `CLAVE_DE_ADMIN`, que es lo que hace que sin configurar
 * no se abra nada.
 */
export function valorDeSesion(personaId: string, emitida = ahoraEnSegundos()): string | null {
  const firma = firmarSesion(personaId, emitida);
  return firma && `${personaId}.${emitida}.${firma}`;
}

/**
 * De quién es esta galleta y cuándo se emitió, o `null` si no la firmamos
 * nosotros o ya venció.
 *
 * Se lee de derecha a izquierda —firma, fecha, y lo que queda es la persona—
 * para que un identificador con puntos adentro se lea entero.
 */
export function leerGalleta(
  valor: string | undefined,
  ahora = ahoraEnSegundos()
): Galleta | null {
  if (!valor) return null;

  const corteFirma = valor.lastIndexOf(".");
  if (corteFirma <= 0) return null;
  const firma = valor.slice(corteFirma + 1);
  const resto = valor.slice(0, corteFirma);

  const corteFecha = resto.lastIndexOf(".");
  if (corteFecha <= 0) return null;
  const emitida = Number(resto.slice(corteFecha + 1));
  const personaId = resto.slice(0, corteFecha);
  if (!personaId || !Number.isInteger(emitida)) return null;

  const esperada = firmarSesion(personaId, emitida);
  if (!esperada) return null;

  const a = Buffer.from(esperada);
  const b = Buffer.from(firma);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Vencida, o emitida en el futuro: ninguna de las dos la firmamos hoy.
  if (emitida > ahora + 60 || ahora - emitida > DURACION_DE_SESION) return null;

  return { personaId, emitida };
}

/**
 * De quién es esta galleta, o `null` si no la firmamos nosotros.
 *
 * Devuelve el identificador y no un sí o un no, porque quien pregunta casi
 * siempre quiere saber **quién**: es lo que hace que lo anotado deje de decir
 * «El equipo».
 */
export function personaDeLaGalleta(valor: string | undefined): string | null {
  return leerGalleta(valor)?.personaId ?? null;
}

/** Si esta galleta la firmamos nosotros. */
export const galletaDeGestionValida = (valor: string | undefined): boolean =>
  personaDeLaGalleta(valor) !== null;

function firmarSesion(personaId: string, emitida: number): string | null {
  const clave = process.env.CLAVE_DE_ADMIN?.trim();
  if (!clave) return null;
  return createHmac("sha256", clave)
    .update(`entro:${personaId}:${emitida}`)
    .digest("base64url");
}
