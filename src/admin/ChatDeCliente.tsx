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
// **Quién firma no se elige acá.** Sale de la sesión: quien dijo ser al entrar
// a gestión. Hubo un desplegable en este pie para elegirlo, y estaba mal por
// dos razones: hay que acordarse de mirarlo cada vez, y el día que se firma
// mal no hay a quién preguntarle.

import { useEffect, useState } from "react";
import {
  escribirComoAgencia,
  marcarChatLeido,
  traerConversacion,
} from "@/app/(admin)/gestion/acciones";
import type { Mensaje } from "@/lib/conversaciones";
import { Conversacion } from "@/ui/Conversacion";

export function ChatDeCliente({
  clienteId,
  nombre,
  sinLeer,
  firma,
  abrirDeEntrada = false,
}: {
  clienteId: string;
  nombre: string;
  sinLeer: number;
  /** Cómo se presenta quien escribe: «Nari · Matter». Sale de la sesión. */
  firma: string;
  /**
   * Abrir la conversación apenas se dibuja.
   *
   * Es lo que hace el globo de mensajes del tablero: trae a esta pantalla con
   * el cliente ya elegido, y sin esto habría que volver a buscarlo en la lista.
   */
  abrirDeEntrada?: boolean;
}) {
  const [abierto, setAbierto] = useState(abrirDeEntrada);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [leidos, setLeidos] = useState(false);
  /**
   * Si se pidió ver lo de antes.
   *
   * Una vez pedido, **también se pregunta entero cada vez**: si no, la vuelta
   * siguiente del reloj traería solo el hilo vivo y le borraría de la pantalla
   * lo que acababa de traer.
   */
  const [entera, setEntera] = useState(false);
  const [hayAnteriores, setHayAnteriores] = useState(false);
  const [trayendo, setTrayendo] = useState(false);

  // Mientras el chat está abierto se pregunta cada seis segundos: es cuando
  // importa enterarse rápido de que el cliente contestó.
  useEffect(() => {
    if (!abierto) return;
    let vivo = true;

    async function traer() {
      try {
        // Por acción y no por la ruta del portal: esa pide la galleta del
        // cliente, y la agencia está del otro lado del mostrador.
        const r = await traerConversacion(clienteId, entera);
        if (r.ok && vivo) {
          setMensajes(r.mensajes);
          setHayAnteriores(r.hayAnteriores);
        }
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
  }, [abierto, clienteId, entera]);

  async function verLoAnterior() {
    setTrayendo(true);
    try {
      const r = await traerConversacion(clienteId, true);
      if (r.ok) {
        setMensajes(r.mensajes);
        setHayAnteriores(false);
        setEntera(true);
      }
    } finally {
      setTrayendo(false);
    }
  }

  async function enviar(texto: string) {
    setEnviando(true);
    try {
      const r = await escribirComoAgencia(clienteId, texto);
      if (r.ok) setMensajes(r.mensajes);
    } finally {
      setEnviando(false);
    }
  }

  const pendientes = leidos ? 0 : sinLeer;
  /** Cuántos faltaban leer cuando se abrió: donde arranca la conversación. */
  // Si se abrió sola, lo que faltaba leer es lo que decía el número al llegar.
  const [alAbrir, setAlAbrir] = useState(abrirDeEntrada ? sinLeer : 0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAlAbrir(pendientes);
          setAbierto(true);
        }}
        className="rounded-full min-h-toque border-2 border-tinta px-4 text-normal font-bold tracking-tight
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
          anteriores={{ hay: hayAnteriores, trayendo, onTraer: verLoAnterior }}
          // Lo que faltaba leer al abrir: ahí arranca la pantalla. Se anota al
          // tocar el botón y no se lee del número vivo, porque marcar leído
          // corre a la par de traer los mensajes y a veces gana: el número
          // ya era cero cuando la pantalla tenía algo que mostrar.
          sinLeer={alAbrir}
          // Con qué nombre lo va a leer el cliente: «Nari · Matter». Decía
          // «Sale firmado por…», y la explicación sobraba.
          firma={
            <p className="mb-2 text-micro font-extrabold uppercase tracking-wider text-tinta">
              {firma}
            </p>
          }
        />
      )}
    </>
  );
}
