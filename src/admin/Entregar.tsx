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
import { Ventana } from "@/ui/Ventana";
import { DIAS_POSIBLES } from "@/lib/dias";

export function Entregar({
  carpetaId,
  carpeta,
  cuantas,
  piezaId,
  dias,
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
   * Los días de revisión que corren hoy acá.
   *
   * Se muestran al confirmar y se pueden cambiar en el momento: es el único
   * instante en que alguien de verdad sabe cuánto tiempo hay. Antes había que
   * acordarse de ir a la configuración a cambiarlo y después volver.
   */
  dias: number;
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
  /**
   * Se avisa con los días que terminaron corriendo, si se cambiaron.
   *
   * Quien nos dibuja suele mostrar el plazo al lado, y lo saca de una foto
   * tomada antes: sin esto seguiría diciendo «25 días» abajo de un mensaje que
   * le prometió uno al cliente.
   */
  alEntregar: (dias?: number) => void;
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

  // Lo que se va a mandar: arranca en lo que corre hoy.
  const [diasElegidos, setDiasElegidos] = useState(dias);

  if (cuantas === 0 && !recienEntregado) return null;

  function entregar() {
    setError(null);
    empezar(async () => {
      const r = await entregarCarpeta(
        carpetaId,
        piezaId,
        // Solo se manda si se cambió: entregar sin tocar nada no tiene por qué
        // escribir un plazo donde no había ninguno puesto a mano.
        diasElegidos === dias ? undefined : diasElegidos
      );
      if (r.ok) {
        setConfirmando(false);
        if (r.avisar) setRecienEntregado({ avisar: r.avisar, cuantas: r.entregadas });
        alEntregar(diasElegidos === dias ? undefined : diasElegidos);
      } else {
        setError(r.motivo);
      }
    });
  }

  // **El botón se queda quieto y lo demás se abre encima.**
  //
  // Antes el bloque de confirmación —tres renglones, un desplegable y dos
  // botones— reemplazaba al botón **en el lugar donde estuviera**: en la barra
  // de abajo de la ventana del trabajo la hacía crecer de golpe y empujaba
  // todo, y en el árbol quedaba metido entre dos renglones. Una pregunta que
  // se contesta sí o no, dibujada adentro de una fila de botones, se lee como
  // parte de la fila.
  //
  // Encima, es lo que es: algo que pide una respuesta antes de seguir. Y el
  // mensaje para el cliente —lo que de verdad importa después de entregar—
  // pasa a tener la pantalla entera en vez de un rincón.
  const adentro = (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        // Entregado, ya no hay nada que entregar: queda apagado mientras se
        // muestra el aviso, en vez de desaparecer y mover todo de lugar.
        disabled={cuantas === 0}
        className="min-h-toque shrink-0 bg-acento px-4 text-normal font-bold tracking-tight
                   text-white transition-colors hover:bg-acento-hover disabled:opacity-35"
      >
        {piezaId ? "Entregar esta" : `Entregar ${cuantas}`}
      </button>

      {confirmando && (
        <Ventana
          titulo={piezaId ? `Entregar ${carpeta}` : `Entregar ${cuantas}`}
          onCerrar={() => !yendo && setConfirmando(false)}
        >
          <Confirmacion
            carpeta={carpeta}
            cuantas={piezaId ? 0 : cuantas}
            dias={diasElegidos}
            onDias={setDiasElegidos}
            yendo={yendo}
            error={error}
            onSi={entregar}
            onNo={() => setConfirmando(false)}
          />
        </Ventana>
      )}

      {recienEntregado && (
        <Ventana
          titulo="Falta avisarle"
          bajada="Entregar y avisar son dos actos, y el segundo es el que se olvida."
          onCerrar={() => setRecienEntregado(null)}
        >
          <AvisoDeEntrega
            avisar={recienEntregado.avisar}
            cuantas={recienEntregado.cuantas}
            onListo={() => setRecienEntregado(null)}
          />
        </Ventana>
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
  dias,
  onDias,
  yendo,
  error,
  onSi,
  onNo,
}: {
  carpeta: string;
  cuantas: number;
  dias: number;
  onDias: (dias: number) => void;
  yendo: boolean;
  error: string | null;
  onSi: () => void;
  onNo: () => void;
}) {
  // Sin recuadro propio: ya está adentro de una ventana, y un borde dentro de
  // otro borde a dos centímetros se lee como dos cosas y no como una.
  return (
    <div className="flex flex-col gap-4">
      <p className="text-normal font-semibold text-tinta-suave">
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

      {/* El plazo, acá y no en otra pantalla: es el momento en que alguien
          sabe cuánto tiempo hay para esto. */}
      <label className="flex flex-wrap items-center gap-2 text-normal font-semibold text-tinta-suave">
        Tiene
        <select
          value={dias}
          disabled={yendo}
          onChange={(e) => onDias(Number(e.target.value))}
          className="min-h-toque border-2 border-tinta bg-lienzo px-2 text-normal font-bold
                     tracking-tight text-tinta disabled:opacity-40"
        >
          {DIAS_POSIBLES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {dias === 1 ? "día para revisar" : "días para revisar"}
      </label>
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
