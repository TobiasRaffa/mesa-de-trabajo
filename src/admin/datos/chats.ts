// Todas las conversaciones juntas, para no entrar cliente por cliente.
//
// Lo que la agencia necesita saber de un vistazo es una sola cosa: **dónde le
// están esperando una respuesta**. Por eso el orden no es alfabético, sino por
// lo que quedó sin leer y por quién habló último.

import { clientesHabilitados } from "@/lib/clientes";
import { leerConversacion, sinLeerPorCliente, type Mensaje } from "@/lib/conversaciones";

export type ChatEnLista = {
  clienteId: string;
  cliente: string;
  ultimo: Mensaje | null;
  /** Mensajes del cliente que nadie leyó todavía. */
  sinLeer: number;
};

export async function todasLasConversaciones(): Promise<ChatEnLista[]> {
  const [clientes, sinLeer] = await Promise.all([
    clientesHabilitados(),
    sinLeerPorCliente("agencia"),
  ]);

  const chats = await Promise.all(
    clientes.map(async (cliente): Promise<ChatEnLista> => {
      const mensajes = await leerConversacion(cliente.id);
      return {
        clienteId: cliente.id,
        cliente: cliente.nombre,
        ultimo: mensajes[mensajes.length - 1] ?? null,
        sinLeer: sinLeer[cliente.id] ?? 0,
      };
    })
  );

  // Primero lo que falta leer; después, lo más reciente. Un cliente con el que
  // no se habló nunca va al final: no es una conversación todavía.
  return chats.sort((a, b) => {
    if ((a.sinLeer > 0) !== (b.sinLeer > 0)) return a.sinLeer > 0 ? -1 : 1;
    const cuandoA = a.ultimo?.cuando ?? "";
    const cuandoB = b.ultimo?.cuando ?? "";
    if (cuandoA !== cuandoB) return cuandoB.localeCompare(cuandoA);
    return a.cliente.localeCompare(b.cliente, "es");
  });
}
