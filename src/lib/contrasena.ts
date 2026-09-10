// La contraseña que protege lo delicado de administración.
//
// Hoy protege una sola cosa: **ver o cambiar la clave de un cliente**. Es el
// dato con el que alguien entra a su portal, y estaba a la vista de cualquiera
// que abriera la pantalla.
//
// Hay que ser honesto sobre qué es y qué no es. Administración **no tiene
// login**: quien llega a la máquina, entra. Esto no arregla eso. Lo que sí
// hace es que la clave de cada cliente no esté escrita en pantalla para el que
// pasa por atrás, y que no viaje al navegador hasta que alguien la pida. Es
// una cortina, no una puerta. La puerta es el login, y va antes de subir esto
// a internet.
//
// Sale de una variable de entorno y no del código: una contraseña escrita en
// el fuente termina en el repositorio, y de ahí no sale más.

import { timingSafeEqual } from "node:crypto";

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
