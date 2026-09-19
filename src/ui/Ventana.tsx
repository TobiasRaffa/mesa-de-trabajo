"use client";

// Una ventana emergente: encabezado, cuerpo y, si hace falta, un pie con los
// botones. Esquinas amplias, como las tarjetas de Matter; en el teléfono,
// donde sube desde abajo, solo las de arriba.
//
// **Es lo que estaba copiado en cada pantalla que abría algo.** El mismo
// `fixed inset-0`, el mismo recuadro, el mismo encabezado con la cruz: copias
// de la misma forma en gestión y otra más en el portal, que es como terminan
// siendo formas parecidas. Y cada copia tenía que acordarse sola de la trampa
// de foco y de que el fondo cierre bien —de eso último ya se ocupa `<Fondo>`—.
//
// Chica a propósito: lo que hay adentro lo pone quien la abre. Esto resuelve
// dónde se dibuja, cómo se sale y que el teclado no se escape.

import type { ReactNode } from "react";
import { EncabezadoDeVentana } from "@/ui/EncabezadoDeVentana";
import { Fondo } from "@/ui/Fondo";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";

export function Ventana({
  titulo,
  rotulo,
  bajada,
  ancho = "max-w-lg",
  /**
   * Cuán arriba se apila.
   *
   * En gestión, por encima de la ventana del trabajo, que está en `z-50`,
   * porque esto se abre **desde** ahí adentro. El portal la pasa más baja.
   */
  capa = "z-[60]",
  onCerrar,
  children,
  pie,
}: {
  titulo: string;
  rotulo?: ReactNode;
  bajada?: string;
  ancho?: string;
  capa?: string;
  onCerrar: () => void;
  children: ReactNode;
  /** Los botones de abajo, cuando la ventana termina en una decisión. */
  pie?: ReactNode;
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
        className={`flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-tarjeta bg-lienzo sm:rounded-tarjeta ${ancho}`}
      >
        <EncabezadoDeVentana
          rotulo={rotulo}
          titulo={titulo}
          bajada={bajada}
          onCerrar={onCerrar}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {pie && (
          <footer className="border-t-2 border-tinta px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
            {pie}
          </footer>
        )}
      </div>
    </Fondo>
  );
}
