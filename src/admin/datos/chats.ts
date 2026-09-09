// Todas las conversaciones juntas, para no entrar cliente por cliente.
//
// Lo que la agencia necesita saber de un vistazo es una sola cosa: **dónde le
// están esperando una respuesta**. Por eso el orden no es alfabético ni por
// cliente, sino por quién habló último y cuándo: arriba lo que el cliente dijo
// y nadie contestó.

import { esCarpetaReservada } from "@/lib/ajustesDeCarpeta";
import { clientesHabilitados } from "@/lib/clientes";
import { leerConversacion, type Mensaje } from "@/lib/conversaciones";
import { subcarpetasDe } from "@/lib/google";

export type ChatEnLista = {
  clienteId: string;
  cliente: string;
  carpetaId: string;
  carpeta: string;
  mensajes: number;
  ultimo: Mensaje | null;
  /**
   * El último que habló fue el cliente.
   *
   * Es lo más parecido a «sin responder» que se puede saber sin registrar
   * quién leyó qué. Cuando existan los usuarios, esto pasa a ser «no leído»
   * de verdad, por persona.
   */
  esperandoRespuesta: boolean;
};

export async function todasLasConversaciones(): Promise<ChatEnLista[]> {
  const clientes = await clientesHabilitados();

  const porCliente = await Promise.all(
    clientes.map(async (cliente) => {
      const carpetas = await subcarpetasDe(cliente.id);

      return Promise.all(
        carpetas
          .filter((c) => !esCarpetaReservada(c.name))
          .map(async (carpeta): Promise<ChatEnLista> => {
            const mensajes = await leerConversacion(carpeta.id);
            const ultimo = mensajes[mensajes.length - 1] ?? null;

            return {
              clienteId: cliente.id,
              cliente: cliente.nombre,
              carpetaId: carpeta.id,
              carpeta: carpeta.name,
              mensajes: mensajes.length,
              ultimo,
              esperandoRespuesta: ultimo?.de === "cliente",
            };
          })
      );
    })
  );

  const todas = porCliente.flat();

  // Primero lo que espera respuesta; después, lo más reciente. Una carpeta sin
  // una sola palabra dicha va al final: no es una conversación todavía.
  return todas.sort((a, b) => {
    if (a.esperandoRespuesta !== b.esperandoRespuesta) return a.esperandoRespuesta ? -1 : 1;
    const cuandoA = a.ultimo?.cuando ?? "";
    const cuandoB = b.ultimo?.cuando ?? "";
    if (cuandoA !== cuandoB) return cuandoB.localeCompare(cuandoA);
    return a.cliente.localeCompare(b.cliente, "es");
  });
}
