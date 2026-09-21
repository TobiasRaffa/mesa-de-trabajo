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

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
  renglon,
}: {
  clienteId: string;
  nombre: string;
  sinLeer: number;
  /**
   * Con qué se abre, cuando no alcanza un botón.
   *
   * En la lista de Conversaciones el renglón entero es el objetivo: se venía
   * a abrir esa conversación, y había que cruzar la pantalla hasta un botón
   * del extremo derecho que decía «Conversación» al lado de un renglón que ya
   * dice de qué es. Pasándole el renglón, todo él abre.
   */
  renglon?: ReactNode;
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
  const router = useRouter();
  const [abierto, setAbierto] = useState(abrirDeEntrada);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [enviando, setEnviando] = useState(false);
  /** Lo que dijo el servidor cuando el mensaje no salió. */
  const [fallo, setFallo] = useState<string | null>(null);
  /** Lo que dijo el servidor cuando no se pudo leer la conversación. */
  const [noSePudoLeer, setNoSePudoLeer] = useState<string | null>(null);
  /** Lo escrito a medias, para que sobreviva a cerrar y volver a abrir. */
  const [borrador, setBorrador] = useState("");
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
        if (!vivo) return;
        if (r.ok) {
          setMensajes(r.mensajes);
          setHayAnteriores(r.hayAnteriores);
          setNoSePudoLeer(null);
        } else {
          // **Un error de lectura no es un hilo vacío.** Se tragaba entero y
          // la ventana dibujaba «Todavía no hablaron por acá.»: alguien
          // miraba, leía que no hay nada, y cerraba sin enterarse de que había
          // mensajes sin leer del otro lado.
          setNoSePudoLeer(r.motivo);
        }
      } catch {
        if (vivo) setNoSePudoLeer("No pude leer la conversación.");
      }
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
        setNoSePudoLeer(null);
      } else {
        setNoSePudoLeer(r.motivo);
      }
    } finally {
      setTrayendo(false);
    }
  }

  async function enviar(texto: string): Promise<boolean> {
    setEnviando(true);
    try {
      const r = await escribirComoAgencia(clienteId, texto);
      if (r.ok) {
        setMensajes(r.mensajes);
        setFallo(null);
        return true;
      }
      // **Antes acá no pasaba nada.** Un `if (r.ok)` sin `else`: el servidor
      // decía que no y la pantalla se quedaba callada, con el campo ya vacío.
      setFallo(r.motivo);
      return false;
    } catch {
      setFallo("No pudimos mandar el mensaje. Probá de nuevo.");
      return false;
    } finally {
      setEnviando(false);
    }
  }

  // **El número vuelve a contar al cerrar.** `leidos` se quedaba en `true`
  // para siempre: después de cerrar la ventana, el botón decía cero mientras
  // el renglón de al lado —que sale del servidor— seguía diciendo «2 sin
  // leer». La marca solo vale mientras la ventana está abierta; cerrada,
  // manda lo que dice el servidor.
  const pendientes = abierto && leidos ? 0 : sinLeer;
  /** Cuántos faltaban leer cuando se abrió: donde arranca la conversación. */
  // Si se abrió sola, lo que faltaba leer es lo que decía el número al llegar.
  const [alAbrir, setAlAbrir] = useState(abrirDeEntrada ? sinLeer : 0);

  function abrir() {
    setAlAbrir(pendientes);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    setLeidos(false);
    // **La dirección no se queda con `?abrir=` puesto.** Quedaba pegada, así
    // que recargar o volver atrás reabría la conversación que se acababa de
    // cerrar, y el link quedaba inservible para compartir la pantalla.
    if (abrirDeEntrada) router.replace("/gestion/chats", { scroll: false });
  }

  return (
    <>
      {renglon ? (
        <button type="button" onClick={abrir} className="block w-full text-left">
          {renglon}
        </button>
      ) : (
        <button
          type="button"
          onClick={abrir}
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
      )}

      {abierto && (
        <Conversacion
          carpeta={nombre}
          mensajes={mensajes}
          yo="agencia"
          enviando={enviando}
          onEnviar={enviar}
          onCerrar={cerrar}
          error={noSePudoLeer}
          borrador={borrador}
          onBorrador={setBorrador}
          anteriores={{ hay: hayAnteriores, trayendo, onTraer: verLoAnterior }}
          // Lo que faltaba leer al abrir: ahí arranca la pantalla. Se anota al
          // tocar el botón y no se lee del número vivo, porque marcar leído
          // corre a la par de traer los mensajes y a veces gana: el número
          // ya era cero cuando la pantalla tenía algo que mostrar.
          sinLeer={alAbrir}
          // Con qué nombre lo va a leer el cliente: «Nari · Matter». Decía
          // «Sale firmado por…», y la explicación sobraba.
          firma={
            <>
              {/* Si no salió, se dice, y encima del campo —que sigue teniendo
                  lo escrito— para que se vea junto con lo que hay que
                  reintentar. */}
              {fallo && (
                <p
                  role="alert"
                  className="mb-2 border-l-4 border-alerta bg-alerta-tenue px-3 py-2 text-menudo font-semibold text-alerta"
                >
                  {fallo}
                </p>
              )}
              <p className="mb-2 text-micro font-extrabold uppercase tracking-wider text-tinta">
                {firma}
              </p>
            </>
          }
        />
      )}
    </>
  );
}
