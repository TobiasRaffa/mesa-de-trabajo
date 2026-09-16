"use client";

// Lo que se puede cambiar de una pieza, en su propia ventana.
//
// **Se abre encima y no debajo.** Adentro hay tres controles y la lista entera
// de lo que pasó: desplegado dentro de la ficha empujaba la pieza fuera de la
// pantalla, y quien estaba mirando el trabajo perdía el trabajo de vista.
//
// Lo que pasó viene plegado. Es lo que se consulta el día que alguien discute
// qué se aprobó, no cada vez que se cambia quién lleva algo.
//
// **Vive acá y no adentro de la ficha** porque desde que los botones de la
// ventana se juntaron todos abajo, quien la abre es la barra de abajo y ya no
// el detalle: dejarla donde estaba obligaba a exportar media ficha para poder
// abrirla desde otro lado.

import { EN_PALABRAS } from "@/dominio/historia";
import { Plegable } from "@/admin/Plegable";
import { Visibilidad } from "@/admin/Visibilidad";
import { Responsable } from "@/admin/Responsable";
import { DiasDeRevision } from "@/admin/DiasDeRevision";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import type { NodoArchivo } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";
import { IconoCerrar } from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import { enPalabrasLaFecha } from "@/admin/cuando";

export function ConfigurarPieza({
  pieza,
  archivo,
  carpetaId,
  equipo,
  onCambio,
  onCerrar,
}: {
  /** Lo anotado, para poder leer «lo que pasó» al final. */
  pieza: PiezaConHistoria | undefined;
  /** Lo que se puede cambiar: visible, quién la lleva, su plazo. */
  archivo: NodoArchivo;
  carpetaId: string;
  equipo: Persona[];
  onCambio: () => void;
  onCerrar: () => void;
}) {
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-tinta/50 p-0 sm:items-center sm:p-6"
      onClick={onCerrar}
    >
      <div
        ref={marco}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Configurar ${archivo.nombre}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden bg-lienzo"
      >
        <header className="flex items-center gap-3 bg-tinta px-5 py-4 text-lienzo">
          <h2 className="min-w-0 flex-1 text-guia font-extrabold tracking-tight">
            Configurar {archivo.nombre}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center bg-lienzo text-tinta transition-colors hover:bg-lienzo/90"
          >
            <IconoCerrar />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <Visibilidad
            ids={archivo.archivos}
            visible={archivo.visible}
            que="archivo"
            alGuardar={onCambio}
          />

          <section>
            <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
              Quién la lleva
            </h4>
            <div className="mt-2">
              <Responsable
                nivel="archivo"
                id={archivo.id}
                carpetaId={carpetaId}
                quien={archivo.responsableQueCorre}
                propio={archivo.responsable !== undefined}
                equipo={equipo}
                alGuardar={onCambio}
              />
            </div>
          </section>

          <section>
            <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
              Tiempo de revisión
            </h4>
            <div className="mt-2">
              <DiasDeRevision
                nivel="archivo"
                id={archivo.id}
                carpetaId={carpetaId}
                dias={archivo.diasQueCorren}
                propio={archivo.dias !== undefined}
                alGuardar={onCambio}
              />
            </div>
          </section>

          {pieza && pieza.historia.length > 0 && (
            <Plegable
              titulo={<span className="text-normal">Lo que pasó</span>}
              resumen={`${pieza.historia.length} ${
                pieza.historia.length === 1 ? "cosa" : "cosas"
              }`}
            >
              <ol className="mt-2 flex flex-col gap-1 border-l-2 border-linea pl-3">
                {[...pieza.historia].reverse().map((h) => (
                  <li key={h.id} className="text-micro text-apagado">
                    <span className="cifras">{enPalabrasLaFecha(h.cuando)}</span>
                    {" · "}
                    <span className="font-bold text-tinta-suave">{h.quien}</span>
                    {": "}
                    {EN_PALABRAS[h.que]}
                    {h.detalle && <span className="block pl-2">{h.detalle}</span>}
                  </li>
                ))}
              </ol>
            </Plegable>
          )}
        </div>
      </div>
    </div>
  );
}
