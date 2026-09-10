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
// Sigue siendo **una contraseña compartida por el equipo**, no un usuario por
// persona. Eso es a propósito y está decidido: son tres personas. Lo que no
// puede ser es que no haya ninguna.
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
 * Lo que se guarda en la galleta cuando alguien acierta la contraseña.
 *
 * Es una firma de la contraseña, no la contraseña. Leer la galleta no sirve
 * para deducirla, y fabricarla sin conocerla no se puede. Como se deriva de
 * ella, **cambiar la contraseña echa a todo el mundo en el acto**: no hace
 * falta una lista de sesiones abiertas que después nadie mantiene.
 *
 * `null` cuando no hay contraseña configurada, que es lo que hace que sin
 * configurar no se abra nada.
 */
export function valorDeGalletaDeGestion(): string | null {
  const clave = process.env.CLAVE_DE_ADMIN?.trim();
  if (!clave) return null;
  return createHmac("sha256", clave).update("entro a gestion").digest("base64url");
}

/** Si esta galleta la firmamos nosotros. Comparación en tiempo constante. */
export function galletaDeGestionValida(valor: string | undefined): boolean {
  if (!valor) return false;
  const esperado = valorDeGalletaDeGestion();
  if (!esperado) return false;

  const a = Buffer.from(esperado);
  const b = Buffer.from(valor);
  return a.length === b.length && timingSafeEqual(a, b);
}
