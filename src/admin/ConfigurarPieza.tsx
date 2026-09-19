"use client";

// Lo que se puede cambiar de una pieza, en su propia ventana.
//
// **Se abre encima y no debajo.** Adentro hay tres controles y la lista entera
// de lo que pasó: desplegado dentro de la ficha empujaba la pieza fuera de la
// pantalla, y quien estaba mirando el trabajo perdía el trabajo de vista.
//
// **Arriba, en un renglón, lo que se mira de un vistazo.** A la izquierda si
// el cliente la ve; a la derecha en qué estado está, con su color, y —si está
// aprobada— el botón de reabrirla justo debajo. Decía en tres renglones qué
// hace reabrir; ahora lo dice el botón al pasarle por encima, que es cuando
// alguien se lo pregunta.
//
// Las vueltas y lo que pasó vienen plegados. Son lo que se consulta el día
// que alguien discute qué se aprobó, no cada vez que se cambia quién lleva
// algo.
//
// **Vive acá y no adentro de la ficha** porque quien la abre es la ficha del
// trabajo, y dejarla ahí obligaba a exportar media ficha para poder abrirla
// desde otro lado.

import { useState } from "react";
import { EN_PALABRAS } from "@/dominio/historia";
import { Plegable } from "@/admin/Plegable";
import { Visibilidad } from "@/admin/Visibilidad";
import { Responsable } from "@/admin/Responsable";
import { DiasDeRevision } from "@/admin/DiasDeRevision";
import { TITULO } from "@/admin/estilos";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import type { NodoArchivo } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import { Boton } from "@/ui/Boton";
import { Estado } from "@/ui/Estado";
import { reabrirPieza } from "@/app/(admin)/gestion/acciones";
import { EncabezadoDeVentana } from "@/ui/EncabezadoDeVentana";
import { Fondo } from "@/ui/Fondo";
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
    <Fondo
      onCerrar={onCerrar}
      className="z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6"
    >
      <div
        ref={marco}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Configurar ${archivo.nombre}`}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-tarjeta bg-lienzo sm:rounded-tarjeta"
      >
        <EncabezadoDeVentana
          rotulo="Configurar"
          titulo={archivo.nombre}
          onCerrar={onCerrar}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          {/* Dos columnas: a la izquierda lo que se cambia, a la derecha en qué
              anda. La de la derecha es angosta y no empuja nada: el estado y
              reabrir van uno debajo del otro, a la altura de los controles. */}
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-col gap-6">
              <Visibilidad
                ids={archivo.archivos}
                visible={archivo.visible}
                que="archivo"
                alGuardar={onCambio}
              />

              <section>
                <h4 className={TITULO}>Quién la lleva</h4>
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
                <h4 className={TITULO}>Tiempo de revisión</h4>
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
            </div>

            <section className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
              <h4 className={TITULO}>Estado</h4>
              <Estado estado={archivo.estado} />
              {/* **Reabrir vive acá y no solo en la ficha del árbol.** Es lo
                  único que se puede hacer con una pieza aprobada, y esta
                  ventana es donde se la trabaja: dos lugares para configurar
                  lo mismo es cómo se descubre, tres meses después, que uno de
                  los dos no tiene algo. */}
              {archivo.estado === "final" && (
                <Reabrir carpetaId={carpetaId} piezaId={archivo.id} onHecho={onCambio} />
              )}
            </section>
          </div>

          {/* Lo que se consulta de vez en cuando, plegado y al final. */}
          <div className="flex flex-col gap-1 border-t border-linea pt-2">
            {/*
              **Qué archivos son esta pieza.** La pantalla decía «v2» y nada
              más: cuáles dos archivos, no. Y ahí es donde vive el error que no
              se puede diagnosticar solo —subir la vuelta nueva con otra
              extensión, o con un número más bajo que el que ya había— porque
              desde afuera se ve igual que si no hubiera pasado nada.
            */}
            <Plegable
              titulo={<span className="text-normal">Las vueltas</span>}
              resumen={`${archivo.versiones.length} ${
                archivo.versiones.length === 1 ? "archivo" : "archivos"
              }`}
            >
              <ol className="mt-2 flex flex-col gap-1">
                {archivo.versiones.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-baseline gap-2 text-menudo text-tinta-suave"
                  >
                    <span className="cifras shrink-0 font-mono font-bold text-apagado">
                      v{v.numero}
                    </span>
                    <span className="min-w-0 break-all">{v.nombre}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-micro text-apagado">
                La última es la que se muestra y la que se entrega.
              </p>
            </Plegable>

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
                      <span className="cifras font-mono">{enPalabrasLaFecha(h.cuando)}</span>
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
    </Fondo>
  );
}

/**
 * Devolverle al cliente algo que ya había aprobado.
 *
 * No es deshacer: al cliente le vuelve a aparecer para decidir, y el archivo
 * sale de «Entregas finales». Es la única acción de esta ventana que le cambia
 * algo al cliente sin que él haya hecho nada, y por eso el botón lo dice al
 * pasarle por encima.
 */
function Reabrir({
  carpetaId,
  piezaId,
  onHecho,
}: {
  carpetaId: string;
  piezaId: string;
  onHecho: () => void;
}) {
  const [yendo, setYendo] = useState(false);
  const [dicho, setDicho] = useState<string | null>(null);

  return (
    <>
      <Boton
        variante="contorno"
        tamano="chico"
        disabled={yendo}
        title="Se la devuelve al cliente para que la mire de nuevo, y saca el archivo de «Entregas finales»."
        onClick={async () => {
          setYendo(true);
          const r = await reabrirPieza(carpetaId, piezaId);
          setYendo(false);
          setDicho(r.motivo);
          if (r.ok) onHecho();
        }}
      >
        {yendo ? "…" : "Reabrir"}
      </Boton>
      {dicho && (
        <p aria-live="polite" className="max-w-56 text-menudo font-semibold text-tinta-suave">
          {dicho}
        </p>
      )}
    </>
  );
}
