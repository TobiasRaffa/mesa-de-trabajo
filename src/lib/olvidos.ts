// «Olvidé mi contraseña».
//
// **El correo de recuperación manda un link que no abre nada por sí solo:**
// sirve para elegir una contraseña nueva, vence en 30 minutos y se gasta al
// usarlo (ver `lib/restablecer.ts`). Este registro queda igual, para que quien
// administra vea a quién no le llega el correo o no puede entrar.
//
// Lo que hace quien administra: ve el pedido en Admin y, si hace falta, le
// **reinicia** la contraseña. Reiniciar no es
// ponerle una nueva —nadie elige la contraseña de otro— sino sacarle la que
// tenía: la persona vuelve a quedar como recién dada de alta y elige una
// nueva la próxima vez que entre. Sigue siendo la única que la sabe.
//
// **Nada se borra.** El pedido atendido queda marcado y en su lugar: si alguien
// pide recuperar su contraseña tres veces en una semana, eso es algo que se
// tiene que poder ver.

import { coleccion } from "@/lib/almacen";

export type Olvido = {
  /** Cuándo lo pidió. */
  pedido: string;
  /** Cuándo se lo reiniciaron. Vacío mientras está pendiente. */
  atendido?: string;
};

function esOlvido(v: unknown): v is Olvido {
  return Boolean(v) && typeof v === "object" && typeof (v as Olvido).pedido === "string";
}

const almacen = coleccion<Olvido>("olvidos", esOlvido);

/**
 * Alguien dice que no puede entrar.
 *
 * Pedirlo de nuevo pisa la fecha del anterior en vez de sumar otro renglón:
 * lo que hace falta saber es que **hoy** no puede entrar, y una lista de diez
 * pedidos de la misma persona esconde a las otras dos que también están
 * esperando.
 */
export async function pedirOtraClave(personaId: string): Promise<void> {
  await almacen.guardar(personaId, { pedido: new Date().toISOString() });
}

/** Se le reinició la contraseña: ya puede volver a entrar. */
export async function darPorAtendido(personaId: string): Promise<void> {
  const guardado = await almacen.uno(personaId);
  if (!guardado) return;
  await almacen.guardar(personaId, { ...guardado, atendido: new Date().toISOString() });
}

/** Quiénes están esperando que alguien les reinicie la contraseña. */
export async function quienesNoPuedenEntrar(): Promise<Record<string, Olvido>> {
  const todo = await almacen.todo();
  return Object.fromEntries(Object.entries(todo).filter(([, o]) => !o.atendido));
}
