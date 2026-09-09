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

type Props = {
  carpeta: string;
  mensajes: Mensaje[];
  /** De qué lado del mostrador está quien mira esta pantalla. */
  yo: "cliente" | "agencia";
  onEnviar: (texto: string) => void;
  onCerrar: () => void;
  /** Se está esperando al servidor. */
  enviando?: boolean;
};

export function Conversacion({
  carpeta,
  mensajes,
  yo,
  onEnviar,
  onCerrar,
  enviando = false,
}: Props) {
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);
  const [texto, setTexto] = useState("");
  const final = useRef<HTMLDivElement>(null);

  // Al abrir, y con cada mensaje nuevo, se mira el final: lo último dicho es
  // lo que importa. Sin esto habría que arrastrar hasta abajo cada vez.
  useEffect(() => {
    final.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  function enviar() {
    const limpio = texto.trim();
    if (!limpio) return;
    onEnviar(limpio);
    setTexto("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/50 sm:items-center sm:p-6"
      onClick={onCerrar}
    >
      <div
        ref={marco}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Conversación sobre ${carpeta}`}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[88vh] w-full max-w-xl flex-col overflow-hidden bg-lienzo sm:h-[80vh]"
      >
        <header className="flex items-start gap-3 bg-acento px-6 py-4 text-white">
          <div className="min-w-0 flex-1">
            <h2 className="text-titulo font-extrabold tracking-tight">Conversación</h2>
            <p className="mt-0.5 truncate text-menudo text-white/70">{carpeta}</p>
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

        <div className="min-h-0 flex-1 overflow-y-auto bg-papel px-5 py-5">
          {mensajes.length === 0 ? (
            <p className="mx-auto max-w-sm py-10 text-center text-normal text-apagado">
              Todavía no hablaron por acá. Lo que se escriba queda junto a esta carpeta, no
              perdido en un chat con todo mezclado.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {mensajes.map((mensaje) => (
                <Burbuja key={mensaje.id} mensaje={mensaje} yo={yo} />
              ))}
            </ul>
          )}
          <div ref={final} />
        </div>

        <footer className="border-t-2 border-tinta px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            autoFocus
            placeholder={yo === "cliente" ? "Escribile al equipo…" : "Escribile al cliente…"}
            className="w-full resize-y border border-linea bg-lienzo p-3 text-normal
                       transition-colors placeholder:text-apagado
                       focus:border-acento focus:outline-none focus:ring-4 focus:ring-acento-tenue"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-menudo text-apagado">
              {yo === "cliente"
                ? "Contesta una persona del equipo."
                : "Le escribís al cliente."}
            </p>
            <Boton onClick={enviar} disabled={enviando || texto.trim().length === 0}>
              <IconoEnviar />
              Enviar
            </Boton>
          </div>
        </footer>
      </div>
    </div>
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
          className={`mt-1 whitespace-pre-wrap px-4 py-3 text-normal ${
            mio ? "bg-acento text-white" : "border border-linea bg-lienzo text-tinta"
          }`}
        >
          {mensaje.texto}
        </p>
      </div>
    </li>
  );
}
