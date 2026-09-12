"use client";

// El botón que abre la conversación de un cliente, del lado de la agencia.
//
// Usa el mismo panel que el portal —`@/ui/Conversacion`— porque es la misma
// pantalla vista desde el otro lado del mostrador. Lo único que cambia es
// quién es «yo», que decide de qué lado va cada burbuja.
//
// El número es **lo que no leíste**, no cuántos mensajes hay. Un contador que
// dice «14» para siempre no dice nada; el que importa es el que baja a cero
// cuando mirás. Abrirlo lo marca como leído.
//
// **Quién firma se elige acá.** Todos los mensajes de la agencia salían como
// «El equipo», y el cliente no sabía con quién estaba hablando. Hasta que haya
// usuarios de verdad, quien escribe se elige de la lista del equipo; la
// elección queda guardada en este navegador, así que en la práctica se elige
// una vez. La opción «El equipo» sigue estando para lo que se manda en nombre
// de la agencia y no de una persona.

import { useEffect, useState } from "react";
import {
  escribirComoAgencia,
  marcarChatLeido,
  traerConversacion,
} from "@/app/(admin)/gestion/acciones";
import type { Mensaje } from "@/lib/conversaciones";
import { Conversacion } from "@/ui/Conversacion";

/** Cómo se firma lo que no lo manda una persona en particular. */
const LA_AGENCIA = "El equipo";

/** Dónde se recuerda quién viene escribiendo, en este navegador. */
const RECUERDO = "mdt_quien_escribe";

function recordado(): string {
  try {
    // Un navegador que no deja guardar nada no es motivo para no abrir el chat.
    return localStorage.getItem(RECUERDO) ?? LA_AGENCIA;
  } catch {
    return LA_AGENCIA;
  }
}

export function ChatDeCliente({
  clienteId,
  nombre,
  sinLeer,
  equipo = [],
}: {
  clienteId: string;
  nombre: string;
  sinLeer: number;
  /** Los nombres del equipo, para elegir quién firma. */
  equipo?: string[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [leidos, setLeidos] = useState(false);
  const [quien, setQuien] = useState(LA_AGENCIA);

  // Mientras el chat está abierto se pregunta cada seis segundos: es cuando
  // importa enterarse rápido de que el cliente contestó.
  useEffect(() => {
    if (!abierto) return;
    let vivo = true;

    async function traer() {
      try {
        // Por acción y no por la ruta del portal: esa pide la galleta del
        // cliente, y la agencia está del otro lado del mostrador.
        const r = await traerConversacion(clienteId);
        if (r.ok && vivo) setMensajes(r.mensajes);
      } catch {}
    }

    traer();
    // Abrirlo es leerlo. Se marca una sola vez por apertura.
    marcarChatLeido(clienteId).then(() => vivo && setLeidos(true));

    const cada = setInterval(traer, 6000);
    return () => {
      vivo = false;
      clearInterval(cada);
    };
  }, [abierto, clienteId]);

  async function enviar(texto: string) {
    setEnviando(true);
    try {
      const r = await escribirComoAgencia(clienteId, texto, quien);
      if (r.ok) setMensajes(r.mensajes);
    } finally {
      setEnviando(false);
    }
  }

  const pendientes = leidos ? 0 : sinLeer;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Se lee al abrir y no al montar: `localStorage` no existe en el
          // servidor, y leerlo antes haría que lo que dibuja el servidor y lo
          // que dibuja el navegador no coincidan. Acá ya hubo un clic.
          setQuien(recordado());
          setAbierto(true);
        }}
        className="min-h-toque border-2 border-tinta px-4 text-normal font-bold tracking-tight
                   text-tinta transition-colors hover:bg-hueco"
      >
        Conversación
        {pendientes > 0 && (
          <span className="ml-2 bg-acento px-1.5 text-micro font-extrabold text-white">
            {pendientes}
          </span>
        )}
      </button>

      {abierto && (
        <Conversacion
          carpeta={nombre}
          mensajes={mensajes}
          yo="agencia"
          enviando={enviando}
          onEnviar={enviar}
          onCerrar={() => setAbierto(false)}
          firma={
            <label className="mb-2 flex items-center gap-2 text-micro font-extrabold uppercase tracking-wider text-apagado">
              Escribe
              <select
                value={quien}
                onChange={(e) => {
                  setQuien(e.target.value);
                  try {
                    localStorage.setItem(RECUERDO, e.target.value);
                  } catch {}
                }}
                className="h-8 border border-linea bg-lienzo px-2 text-menudo font-bold
                           normal-case tracking-normal text-tinta"
              >
                <option value={LA_AGENCIA}>{LA_AGENCIA}</option>
                {equipo.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
            </label>
          }
        />
      )}
    </>
  );
}
