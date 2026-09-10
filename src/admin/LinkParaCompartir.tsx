"use client";

// Un link del portal, listo para mandar.
//
// Muestra la dirección, la copia, y deja renovarla. Es lo mismo para el link
// de un cliente y el de una carpeta: lo único que cambia es qué muestra del
// otro lado.

import { useState } from "react";

export function LinkParaCompartir({
  token,
  etiqueta,
  alRenovar,
}: {
  token: string;
  etiqueta: string;
  /** Si viene, aparece el botón de cambiarlo. */
  alRenovar?: React.ReactNode;
}) {
  const [copiado, setCopiado] = useState(false);
  const camino = `/t/${token}`;

  async function copiar() {
    try {
      // La dirección completa, que es lo que el cliente necesita recibir.
      await navigator.clipboard.writeText(new URL(camino, location.origin).toString());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Un navegador que no deja copiar no rompe nada: el link está a la vista.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-hueco/60 px-3 py-2">
      <span className="shrink-0 text-micro font-extrabold uppercase tracking-wider text-apagado">
        {etiqueta}
      </span>
      <code className="min-w-0 flex-1 truncate font-mono text-menudo text-tinta-suave">
        {camino}
      </code>
      <button
        type="button"
        onClick={copiar}
        className="shrink-0 border border-linea bg-lienzo px-3 py-1.5 text-micro font-extrabold
                   uppercase tracking-wider text-tinta transition-colors hover:bg-hueco"
      >
        {copiado ? "Copiado" : "Copiar"}
      </button>
      {alRenovar}
    </div>
  );
}
