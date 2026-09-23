// La llave de la tarea de todas las mañanas.
//
// Hay una sola cosa que llama a la aplicación sin ser una persona: la tarea
// programada de Netlify (`netlify/functions/tarea-diaria.mjs`), que manda los
// recordatorios de plazo y guarda el respaldo del día. No tiene sesión ni
// galleta, así que se presenta con esta llave.
//
// **La llave sale de `CLAVE_DE_ADMIN` y no de una variable nueva.** Las dos
// puntas —la tarea y la ruta— corren en el mismo sitio de Netlify y leen las
// mismas variables: derivarla ahí no suma nada que configurar, y una variable
// más es una fila más que alguien se olvida de cargar el día del despliegue.
// Se deriva con una etiqueta propia, así que conocer esta llave no dice nada
// de la otra, ni sirve para firmar una sesión.

import { createHmac, timingSafeEqual } from "node:crypto";

/** Con qué se distingue esta llave de cualquier otra que salga de la misma clave. */
const PARA_QUE = "tarea-diaria";

/** La llave, o `null` si no hay de dónde sacarla. */
export function llaveDeLaTarea(clave = process.env.CLAVE_DE_ADMIN?.trim()): string | null {
  if (!clave) return null;
  return createHmac("sha256", clave).update(PARA_QUE).digest("base64url");
}

/**
 * ¿Este pedido lo manda la tarea?
 *
 * Sin `CLAVE_DE_ADMIN` no hay llave que comparar y la respuesta es que no:
 * falla cerrado, igual que la puerta de gestión.
 */
export function esLaTarea(pedido: Request): boolean {
  const esperada = llaveDeLaTarea();
  if (!esperada) return false;
  const llego = pedido.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(llego);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}
