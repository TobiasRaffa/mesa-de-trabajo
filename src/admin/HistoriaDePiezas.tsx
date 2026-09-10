// Qué le pasó a cada pieza, y cuándo.
//
// Existe para la conversación que hoy se resuelve de memoria: «esto ya lo
// habíamos aprobado», «yo nunca pedí ese cambio». La aplicación anota cada
// decisión con quién y cuándo, así que deja de ser la palabra de uno contra la
// del otro.
//
// Es una lista y no una tabla a propósito: lo que importa es el orden en que
// pasaron las cosas, no comparar columnas.

import { EN_PALABRAS, type EstadoDePieza } from "@/lib/piezas";
import { Estado } from "@/ui/Estado";

const cuando = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function enPalabras(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "" : cuando.format(fecha);
}

export type PiezaConHistoria = EstadoDePieza & {
  id: string;
  nombre: string;
};

export function HistoriaDePiezas({ piezas }: { piezas: PiezaConHistoria[] }) {
  const conAlgo = piezas.filter((p) => p.historia.length > 0);

  return (
    <section className="mt-12">
      <h2 className="text-titulo font-extrabold tracking-tight">Qué pasó con cada pieza</h2>

      {conAlgo.length === 0 ? (
        <p className="mt-5 border-l-4 border-linea bg-hueco/50 px-4 py-3 text-normal text-tinta-suave">
          Todavía no pasó nada: el cliente no abrió ninguna pieza.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-6">
          {conAlgo.map((pieza) => (
            <li key={pieza.id} className="border-t border-linea pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-guia font-bold tracking-tight">{pieza.nombre}</h3>
                <Estado estado={pieza.estado} />
                {pieza.mudada && (
                  <span className="text-micro font-extrabold uppercase tracking-wider text-apagado">
                    en Entregas finales
                  </span>
                )}
              </div>

              {pieza.cambios.length > 0 && (
                <ol className="mt-3 flex flex-col gap-1.5 border-l-4 border-acento bg-acento-tenue/40 py-2 pl-4">
                  {pieza.cambios.map((cambio, i) => (
                    <li key={cambio.id} className="flex gap-2 text-menudo text-tinta-suave">
                      <span className="shrink-0 font-extrabold text-apagado">{i + 1}.</span>
                      <span className="min-w-0 whitespace-pre-wrap">{cambio.texto}</span>
                    </li>
                  ))}
                </ol>
              )}

              <ol className="mt-3 flex flex-col gap-1">
                {/* Lo último arriba: es lo que se viene a mirar. */}
                {[...pieza.historia].reverse().map((hito) => (
                  <li key={hito.id} className="flex flex-wrap gap-x-2 text-menudo">
                    <span className="cifras shrink-0 text-apagado">
                      {enPalabras(hito.cuando)}
                    </span>
                    <span className="font-bold">{hito.quien}</span>
                    <span className="text-tinta-suave">{EN_PALABRAS[hito.que]}</span>
                    {hito.detalle && (
                      <span className="w-full text-micro text-espera">{hito.detalle}</span>
                    )}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
