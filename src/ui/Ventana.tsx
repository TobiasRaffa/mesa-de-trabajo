"use client";

// Una ventana emergente de gestión: encabezado oscuro, cuerpo, y nada más.
//
// **Es lo que estaba copiado en cada pantalla que abría algo.** El mismo
// `fixed inset-0`, el mismo recuadro, el mismo encabezado con la cruz: cinco
// copias de la misma forma, que es como terminan siendo cinco formas
// parecidas. Y cada copia tenía que acordarse sola de la trampa de foco y de
// que el fondo cierre bien —de eso último ya se ocupa `<Fondo>`—.
//
// Chica a propósito: lo que hay adentro lo pone quien la abre. Esto resuelve
// dónde se dibuja, cómo se sale y que el teclado no se escape.

import type { ReactNode } from "react";
import { Fondo } from "@/ui/Fondo";
import { IconoCerrar } from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";

export function Ventana({
  titulo,
  bajada,
  ancho = "max-w-lg",
  /**
   * Cuán arriba se apila.
   *
   * Por encima de la ventana del trabajo, que está en `z-50`, porque esto se
   * abre **desde** ahí adentro.
   */
  capa = "z-[60]",
  onCerrar,
  children,
}: {
  titulo: string;
  bajada?: string;
  ancho?: string;
  capa?: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);

  return (
    <Fondo
      onCerrar={onCerrar}
      className={`${capa} flex items-end justify-center p-0 sm:items-center sm:p-6`}
    >
      <div
        ref={marco}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`flex max-h-[85vh] w-full flex-col overflow-hidden bg-lienzo ${ancho}`}
      >
        <header className="flex items-start gap-3 bg-tinta px-5 py-4 text-lienzo">
          <div className="min-w-0 flex-1">
            <h2 className="text-guia font-extrabold tracking-tight">{titulo}</h2>
            {bajada && <p className="mt-0.5 text-menudo text-lienzo/60">{bajada}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center bg-lienzo text-tinta transition-colors hover:bg-lienzo/90"
          >
            <IconoCerrar />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </Fondo>
  );
}
