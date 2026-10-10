// Restablecer la contraseña por correo.
//
// **El link es una llave de un solo uso, que vence.** Quien lo recibe elige una
// contraseña nueva y listo: el link no abre nada por sí solo, y después de usarlo
// (o de que venza) no sirve más.
//
// **El token no se guarda; se guarda su huella.** Igual que con las contraseñas:
// si alguien lee el almacén, no se lleva ningún link que todavía funcione. Por
// eso el token es de 32 bytes al azar (imposible de adivinar) y en el almacén
// queda solo su SHA-256.

import { createHash, randomBytes } from "node:crypto";
import { coleccion } from "@/lib/almacen";

/** Dónde se elige la contraseña nueva. Queda afuera de la puerta, como la entrada. */
export const RESTABLECER = "/gestion/entrar/restablecer";

/** Cuánto dura el link. Corto a propósito: el correo puede quedar en una bandeja. */
export const VIGENCIA_MS = 30 * 60 * 1000;

/** Cuánto hay que esperar entre un link y el siguiente para la misma persona. */
export const ENTRE_LINKS_MS = 2 * 60 * 1000;

export type Pedido = {
  personaId: string;
  /** Hasta cuándo sirve el link, en milisegundos desde 1970. */
  vence: number;
};

const esPedido = (v: unknown): v is Pedido =>
  Boolean(v) &&
  typeof v === "object" &&
  typeof (v as Pedido).personaId === "string" &&
  typeof (v as Pedido).vence === "number";

const almacen = coleccion<Pedido>("restablecer", esPedido);

/** La huella con la que se guarda y se busca un token. */
export const huellaDelToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * Hace un link nuevo para esa persona y devuelve el token que va en el link.
 *
 * Un pedido nuevo reemplaza al anterior de la misma persona: si pidió dos veces,
 * solo sirve el último link que le llegó.
 */
export async function crearLinkDeRestablecer(personaId: string): Promise<string | null> {
  const ahora = Date.now();
  const previos = Object.entries(await almacen.todo()).filter(
    ([, pedido]) => pedido.personaId === personaId
  );
  // **Uno cada tanto, no uno por clic.** Sin esto, cualquiera que sepa un correo
  // del equipo puede apretar «olvidé» sin parar y llenarle la bandeja, o gastar
  // el cupo diario de envíos de la cuenta de Gmail.
  const reciente = previos.some(([, p]) => p.vence - VIGENCIA_MS > ahora - ENTRE_LINKS_MS);
  if (reciente) return null;
  for (const [huella] of previos) await almacen.borrar(huella);
  const token = randomBytes(32).toString("base64url");
  await almacen.guardar(huellaDelToken(token), {
    personaId,
    vence: ahora + VIGENCIA_MS,
  });
  return token;
}

/**
 * Quién puede elegir contraseña con este token, o `null` si ya no sirve.
 *
 * No lo consume: lo consume `gastarLinkDeRestablecer` recién cuando la
 * contraseña nueva quedó guardada. Así un error de escritura no obliga a pedir
 * otro link.
 */
export async function personaDelLink(token: string): Promise<string | null> {
  if (!token) return null;
  const pedido = await almacen.uno(huellaDelToken(token));
  if (!pedido) return null;
  if (Date.now() > pedido.vence) {
    await almacen.borrar(huellaDelToken(token));
    return null;
  }
  return pedido.personaId;
}

/** El link se usó: ya no sirve, ni una segunda vez. */
export async function gastarLinkDeRestablecer(token: string): Promise<void> {
  await almacen.borrar(huellaDelToken(token));
}

/** El texto del correo. Corto, sin HTML, y con lo que hace falta saber. */
export function cuerpoDeRestablecer(link: string): string {
  return [
    "Alguien pidió cambiar la contraseña de tu cuenta de Mesa de trabajo.",
    "",
    "Si fuiste vos, elegí una contraseña nueva en este link:",
    link,
    "",
    "El link sirve una sola vez y vence en 30 minutos.",
    "",
    "Si no fuiste vos, ignorá este correo: tu contraseña sigue siendo la misma.",
  ].join("\n");
}
