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
//
// **Y después ofrece el mensaje.** Entregar y avisar son dos actos, y el
// segundo es el que se olvida: el trabajo entregado, el plazo corriendo, y el
// cliente sin enterarse. El mensaje aparece acá mismo, escrito, para copiar o
// mandar por WhatsApp.

import { useState, useTransition } from "react";
import { entregarCarpeta, type ParaAvisar } from "@/app/(admin)/gestion/acciones";
import { AvisoDeEntrega } from "@/admin/AvisoDeEntrega";

export function Entregar({
  carpetaId,
  carpeta,
  cuantas,
  piezaId,
  sangria,
  alEntregar,
}: {
  carpetaId: string;
  carpeta: string;
  /** Cuántas piezas están sin entregar. Si no hay ninguna, no se muestra. */
  cuantas: number;
  /**
   * Una sola pieza, cuando se entrega de a una desde su ficha.
   *
   * Sin esto se entrega la carpeta entera, que es lo habitual: se arma una
   * tanda y se manda. Con esto se manda solo esa, que es el caso del banner
   * que sale hoy y el resto de la campaña la semana que viene.
   */
  piezaId?: string;
  /**
   * Cuánto se corre desde la izquierda, según qué tan hondo está en el árbol.
   *
   * **El bloque lo dibuja este componente y no el árbol**, y eso no es un
   * detalle: el árbol lo dibujaba mientras hubiera algo sin entregar, así que
   * al entregar lo último lo hacía desaparecer —con el mensaje para el cliente
   * adentro, justo cuando hacía falta—.
   *
   * Sin esto no dibuja el bloque del árbol: es lo que hace falta en el tablero,
   * donde va suelto entre los demás botones.
   */
  sangria?: number;
  alEntregar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yendo, empezar] = useTransition();

  // Lo que quedó recién entregado, para ofrecer el aviso. Vive acá y no se
  // pierde cuando `cuantas` baja a cero: es justo después de entregar cuando
  // hay que avisar, y ese es el momento en que ya no queda nada sin entregar.
  const [recienEntregado, setRecienEntregado] = useState<{
    avisar: ParaAvisar;
    cuantas: number;
  } | null>(null);

  if (cuantas === 0 && !recienEntregado) return null;

  function entregar() {
    setError(null);
    empezar(async () => {
      const r = await entregarCarpeta(carpetaId, piezaId);
      if (r.ok) {
        setConfirmando(false);
        if (r.avisar) setRecienEntregado({ avisar: r.avisar, cuantas: r.entregadas });
        alEntregar();
      } else {
        setError(r.motivo);
      }
    });
  }

  const adentro = (
    <>
      {recienEntregado ? (
        <AvisoDeEntrega
          avisar={recienEntregado.avisar}
          cuantas={recienEntregado.cuantas}
          onListo={() => setRecienEntregado(null)}
        />
      ) : !confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="min-h-toque shrink-0 bg-acento px-4 text-normal font-bold tracking-tight
                     text-white transition-colors hover:bg-acento-hover"
        >
          {piezaId ? "Entregar esta" : `Entregar ${cuantas}`}
        </button>
      ) : (
        <Confirmacion
          carpeta={carpeta}
          cuantas={piezaId ? 0 : cuantas}
          yendo={yendo}
          error={error}
          onSi={entregar}
          onNo={() => setConfirmando(false)}
        />
      )}
    </>
  );

  if (sangria === undefined) return adentro;

  return (
    <div className="border-b border-linea-tenue py-3 pr-4" style={{ paddingLeft: sangria }}>
      {adentro}
    </div>
  );
}

function Confirmacion({
  carpeta,
  cuantas,
  yendo,
  error,
  onSi,
  onNo,
}: {
  carpeta: string;
  cuantas: number;
  yendo: boolean;
  error: string | null;
  onSi: () => void;
  onNo: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-2 border-acento bg-acento-tenue p-3">
      <p className="text-menudo font-semibold text-acento">
        {/* Con 0 se está entregando una sola pieza y `carpeta` es su nombre:
            decir «1 pieza de stickers» sería hablar de una pieza adentro de
            otra. */}
        {cuantas === 0
          ? `Se le entrega «${carpeta}». La va a ver ahora`
          : cuantas === 1
            ? `Se le entrega 1 pieza de ${carpeta}. La va a ver ahora`
            : `Se le entregan ${cuantas} piezas de ${carpeta}. Las va a ver ahora`}
        , le arranca el plazo y le sale el aviso.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSi}
          disabled={yendo}
          className="min-h-toque bg-acento px-4 text-normal font-bold tracking-tight
                     text-white transition-colors hover:bg-acento-hover disabled:opacity-40"
        >
          {yendo ? "Entregando…" : "Sí, entregar"}
        </button>
        <button
          type="button"
          onClick={onNo}
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
