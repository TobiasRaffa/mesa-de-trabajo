"use client";

// El botón de entregar una carpeta.
//
// **Es el acto que le faltaba a la aplicación.** Un archivo que aparecía en
// Drive nacía entregado, así que el cliente lo veía —y lo podía aprobar— en el
// instante en que se subía. Ahora se sube tranquilo y se entrega cuando está.
//
// Entrega la carpeta entera y no pieza por pieza porque así se trabaja: se
// arma una tanda y se manda.
//
// **Pregunta antes.** Es lo único de gestión que el cliente ve pasar en el
// momento: le aparece el trabajo, le arranca el plazo y le sale el aviso. Un
// clic de más acá vale menos que un «perdón, mirá que eso todavía no estaba».

import { useState, useTransition } from "react";
import { entregarCarpeta } from "@/app/(admin)/gestion/acciones";

export function Entregar({
  carpetaId,
  carpeta,
  cuantas,
  alEntregar,
}: {
  carpetaId: string;
  carpeta: string;
  /** Cuántas piezas están sin entregar. Si no hay ninguna, no se muestra. */
  cuantas: number;
  alEntregar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yendo, empezar] = useTransition();

  if (cuantas === 0) return null;

  function entregar() {
    setError(null);
    empezar(async () => {
      const r = await entregarCarpeta(carpetaId);
      if (r.ok) {
        setConfirmando(false);
        alEntregar();
      } else {
        setError(r.motivo);
      }
    });
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="min-h-toque shrink-0 bg-acento px-4 text-normal font-bold tracking-tight
                   text-white transition-colors hover:bg-acento-hover"
      >
        Entregar {cuantas}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-2 border-acento bg-acento-tenue p-3">
      <p className="text-menudo font-semibold text-acento">
        {cuantas === 1
          ? `Se le entrega 1 pieza de ${carpeta}. La va a ver ahora`
          : `Se le entregan ${cuantas} piezas de ${carpeta}. Las va a ver ahora`}
        , le arranca el plazo y le sale el aviso.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={entregar}
          disabled={yendo}
          className="min-h-toque bg-acento px-4 text-normal font-bold tracking-tight
                     text-white transition-colors hover:bg-acento-hover disabled:opacity-40"
        >
          {yendo ? "Entregando…" : "Sí, entregar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={yendo}
          className="min-h-toque border-2 border-tinta px-4 text-normal font-bold
                     tracking-tight text-tinta transition-colors hover:bg-hueco"
        >
          Todavía no
        </button>
      </div>
      {error && (
        <p aria-live="polite" className="text-menudo font-semibold text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}
