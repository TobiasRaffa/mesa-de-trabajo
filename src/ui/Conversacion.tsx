"use client";

// La conversación entre el cliente y el equipo.
//
// Vive en `ui` y no en uno de los dos mundos porque **es la misma pantalla de
// los dos lados**: el cliente la abre desde el portal, la agencia desde la app
// de gestión. Lo único que cambia es quién es «yo», que decide de qué lado va
// cada burbuja. Tener dos copias sería la forma segura de que un día se vean
// distinto.
//
// Reemplaza al «comentario general», que era un cuadro de texto que se mandaba
// y desaparecía. Una entrega no se resuelve con un mensaje suelto: se resuelve
// hablando —«¿podemos correr todo una semana?», «sí, pero el jueves no llega»—
// y eso hoy pasa en WhatsApp, donde se mezcla con todo lo demás y se pierde.
// Acá queda al lado del trabajo del que se está hablando.
//
// **Del otro lado siempre hay una persona.** Es la regla más vieja de este
// proyecto y no se negocia: la aplicación no contesta, no sugiere respuestas,
// no resume lo que dijo el cliente ni le pone palabras a nadie. Lo único que
// hace es mostrar lo que cada uno escribió y cuándo. Si alguna vez esta
// pantalla parece contestar sola, algo se rompió.
//
// Lo que sí hace la aplicación es escribir **avisos de estado**: «el cliente
// aprobó 4 piezas», «se envió la revisión». Van marcados distinto justamente
// para que no se confundan con lo que dijo alguien.

import { useEffect, useRef, useState } from "react";
import { Boton } from "@/ui/Boton";
import { IconoCerrar, IconoEnviar } from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import { Fondo } from "@/ui/Fondo";
import { LARGO_MAXIMO } from "@/dominio/texto";
import type { Mensaje } from "@/lib/conversaciones";

export type { Mensaje };

// En 24 horas: es como se escribe y se dice la hora en Argentina. El formato
// que sale por omisión —«05:31 P. M.»— se lee como traducido de otro lado.
const hora = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function cuandoEnPalabras(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "" : hora.format(fecha);
}

/** El mínimo para que un dedo acierte, en píxeles. Es `--spacing-toque`. */
const PISO = 44;

type Props = {
  carpeta: string;
  mensajes: Mensaje[];
  /** De qué lado del mostrador está quien mira esta pantalla. */
  yo: "cliente" | "agencia";
  onEnviar: (texto: string) => void;
  onCerrar: () => void;
  /** Se está esperando al servidor. */
  enviando?: boolean;
  /**
   * Quién firma lo que se escribe. Va arriba del campo.
   *
   * El portal no lo usa: del lado del cliente firma el cliente y no hay nada
   * que elegir. Del lado de la agencia sí, porque son varias personas y el
   * cliente tiene que saber con quién habló.
   */
  firma?: React.ReactNode;
  /**
   * Lo de antes, cuando la conversación es larga.
   *
   * Un hilo de años no se trae entero cada vez: lo viejo queda guardado aparte
   * y se pide con un botón. **No falta nada**, está más atrás; el botón lo dice
   * con esas palabras justamente para que nadie crea que se perdió algo.
   */
  anteriores?: { hay: boolean; trayendo: boolean; onTraer: () => void };
};

export function Conversacion({
  carpeta,
  mensajes,
  yo,
  onEnviar,
  onCerrar,
  enviando = false,
  firma,
  anteriores,
}: Props) {
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);
  const [texto, setTexto] = useState("");
  const final = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  // El campo crece con lo que se escribe. Se mide poniéndolo en cero primero:
  // sin eso, `scrollHeight` devuelve el alto de antes y el campo nunca achica.
  //
  // El piso se aplica acá y no solo en el CSS: dejando el alto por debajo del
  // mínimo, el navegador lo estira con `min-height` pero sigue creyendo que
  // hay algo de sobra, y dibuja una barra de desplazamiento de un pelo con el
  // campo vacío.
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    // `scrollHeight` mide el contenido; el alto que se fija incluye el borde.
    // Sin sumarlo faltaba un pelo y el navegador dibujaba una barra de
    // desplazamiento de un píxel con el campo vacío.
    const borde = el.offsetHeight - el.clientHeight;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight + borde, PISO)}px`;
  }, [texto]);

  // Al abrir, y con cada mensaje nuevo, se mira el final: lo último dicho es
  // lo que importa. Sin esto habría que arrastrar hasta abajo cada vez.
  //
  // **Salvo cuando lo que llegó es lo de antes.** Traer el historial y que la
  // pantalla salte al final es lo contrario de lo que pidió quien apretó el
  // botón: se queda donde estaba, que es donde está lo que vino a leer.
  const cuantos = useRef(0);
  useEffect(() => {
    const crecioPorAtras = mensajes.length > cuantos.current + 1;
    cuantos.current = mensajes.length;
    if (!crecioPorAtras) final.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  function enviar() {
    const limpio = texto.trim();
    if (!limpio) return;
    onEnviar(limpio);
    setTexto("");
  }

  return (
    <Fondo
      onCerrar={onCerrar}
      className="z-50 flex items-end justify-center sm:items-center sm:p-6"
    >
      <div
        ref={marco}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Conversación sobre ${carpeta}`}
        className="flex h-[88vh] w-full max-w-xl flex-col overflow-hidden bg-lienzo sm:h-[80vh]"
      >
        <header className="flex items-center gap-3 bg-acento px-4 py-3 text-white">
          <div className="min-w-0 flex-1">
            <h2 className="text-guia font-extrabold tracking-tight">Conversación</h2>
            <p className="truncate text-micro text-white/70">{carpeta}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center bg-white text-acento transition-colors hover:bg-white/90"
          >
            <IconoCerrar />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-papel px-4 py-4">
          {/* Arriba de todo, que es donde termina el que sube leyendo. */}
          {anteriores?.hay && (
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                onClick={anteriores.onTraer}
                disabled={anteriores.trayendo}
                className="min-h-toque border border-linea bg-lienzo px-4 text-menudo
                           font-semibold text-tinta-suave transition-colors
                           hover:bg-hueco disabled:opacity-40"
              >
                {anteriores.trayendo ? "Buscando…" : "Ver lo anterior"}
              </button>
            </div>
          )}

          {mensajes.length === 0 ? (
            <p className="py-10 text-center text-normal text-apagado">
              Todavía no hablaron por acá.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {mensajes.map((mensaje) => (
                <Burbuja key={mensaje.id} mensaje={mensaje} yo={yo} />
              ))}
            </ul>
          )}
          <div ref={final} />
        </div>

        {/*
          El pie era un tercio de la ventana: tres renglones de textarea, una
          línea de texto y un botón, todo fijo aunque no se estuviera
          escribiendo. Lo que importa son los mensajes.

          Ahora arranca en un renglón y crece con lo que se escribe, hasta un
          tope: quien manda dos palabras ve dos palabras, y quien escribe un
          párrafo lo ve entero sin desplazar.
        */}
        <footer className="border-t-2 border-tinta px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
          {firma}
          <div className="flex items-end gap-2">
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={LARGO_MAXIMO}
              rows={1}
              autoFocus
              placeholder={
                yo === "cliente" ? "Escribile al equipo…" : "Escribile al cliente…"
              }
              className="max-h-40 min-h-toque w-full resize-none border border-linea bg-lienzo
                         px-3 py-2.5 text-normal transition-colors placeholder:text-apagado
                         focus:border-acento focus:outline-none focus:ring-4 focus:ring-acento-tenue"
            />
            <Boton
              onClick={enviar}
              disabled={enviando || texto.trim().length === 0}
              aria-label="Enviar"
            >
              <IconoEnviar />
              <span className="sr-only sm:not-sr-only">Enviar</span>
            </Boton>
          </div>
          <p className="mt-1.5 text-micro text-apagado">
            {yo === "cliente"
              ? "Contesta una persona del equipo."
              : "Le escribís al cliente."}
          </p>
        </footer>
      </div>
    </Fondo>
  );
}

function Burbuja({ mensaje, yo }: { mensaje: Mensaje; yo: "cliente" | "agencia" }) {
  // Un aviso de la aplicación no es alguien hablando: va centrado, en gris y
  // sin burbuja, para que se lea como lo que es.
  if (mensaje.de === "sistema") {
    return (
      <li className="flex justify-center">
        <p className="bg-hueco px-3 py-1.5 text-center text-menudo text-tinta-suave">
          {mensaje.texto}
          <span className="ml-2 text-micro text-apagado">
            {cuandoEnPalabras(mensaje.cuando)}
          </span>
        </p>
      </li>
    );
  }

  const mio = mensaje.de === yo;

  return (
    <li className={`flex ${mio ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%]">
        <p
          className={`text-micro font-extrabold uppercase tracking-widest text-apagado ${
            mio ? "text-right" : ""
          }`}
        >
          {mensaje.quien} · {cuandoEnPalabras(mensaje.cuando)}
        </p>
        <p
          className={`mt-0.5 whitespace-pre-wrap px-3 py-2 text-normal ${
            mio ? "bg-acento text-white" : "border border-linea bg-lienzo text-tinta"
          }`}
        >
          {mensaje.texto}
        </p>
      </div>
    </li>
  );
}
