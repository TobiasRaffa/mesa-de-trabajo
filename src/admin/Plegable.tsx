"use client";

// Un bloque que se abre y se cierra.
//
// Existe porque la misma idea aparecía en cuatro lugares —las notificaciones,
// las secciones de Admin, los clientes del tablero, las carpetas de cada
// cliente— y escrita cuatro veces se separa: una gira la flecha, otra no; una
// recuerda si estaba abierta, otra se cierra sola al recargar.
//
// **Arranca cerrado.** Es la razón de ser de esto: una pantalla con todo
// desplegado obliga a leer para encontrar, y lo que se busca casi siempre es
// una cosa. Cerrado, el título y el resumen alcanzan para saber si hay que
// abrirlo.
//
// **Recuerda si lo dejaste abierto**, en este navegador. Quien entra todos los
// días a mirar lo mismo no tiene que volver a abrirlo cada vez; quien entra a
// otra cosa lo encuentra cerrado. Sin el recuerdo, «cerrado por omisión» se
// vuelve un clic de peaje.

import { useState } from "react";
import { IconoFlecha } from "@/ui/Icono";

export function Plegable({
  titulo,
  resumen,
  alLado,
  recuerdo,
  abiertoDeEntrada = false,
  children,
}: {
  titulo: React.ReactNode;
  /** Lo que se ve sin abrir: números, avisos, lo que evita tener que abrir. */
  resumen?: React.ReactNode;
  /** Lo que va a la derecha del título y **no** abre ni cierra. */
  alLado?: React.ReactNode;
  /**
   * Con qué nombre se recuerda si quedó abierto.
   *
   * Sin esto no se recuerda nada, que es lo correcto para algo que aparece
   * muchas veces —una carpeta de un cliente— y llenaría el navegador de
   * anotaciones que nadie va a volver a mirar.
   */
  recuerdo?: string;
  abiertoDeEntrada?: boolean;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(() => {
    if (!recuerdo) return abiertoDeEntrada;
    try {
      const guardado = localStorage.getItem(`mdt_abierto_${recuerdo}`);
      return guardado === null ? abiertoDeEntrada : guardado === "si";
    } catch {
      // Un navegador que no deja guardar nada no es motivo para no abrir.
      return abiertoDeEntrada;
    }
  });

  function alternar() {
    const nuevo = !abierto;
    setAbierto(nuevo);
    if (!recuerdo) return;
    try {
      localStorage.setItem(`mdt_abierto_${recuerdo}`, nuevo ? "si" : "no");
    } catch {}
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={abierto}
          className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left transition-colors
                     hover:text-acento focus-visible:outline-2 focus-visible:outline-acento"
        >
          <span
            aria-hidden="true"
            className={`shrink-0 transition-transform ${abierto ? "rotate-90" : ""}`}
          >
            <IconoFlecha />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-guia font-extrabold tracking-tight">{titulo}</span>
            {resumen && (
              <span className="ml-3 text-menudo font-normal text-apagado">{resumen}</span>
            )}
          </span>
        </button>
        {alLado}
      </div>

      {abierto && children}
    </section>
  );
}
