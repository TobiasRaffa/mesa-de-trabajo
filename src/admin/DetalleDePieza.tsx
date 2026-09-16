"use client";

// Lo que pasó con una pieza, y qué se puede hacer al respecto.
//
// **Estaba repartido en dos pantallas.** La ventana del tablero decía el
// nombre y el estado; para saber qué había pedido el cliente, o qué
// escribieron encima del archivo en Drive, había que irse a la pantalla de la
// carpeta. Cuatro pantallas para contestar «¿por qué está frenado esto?».
//
// El orden es el de la urgencia, no el cronológico:
//
//   1. **Lo que espera una decisión nuestra.** Una revisión adicional pedida
//      no es información: es alguien esperando que digamos que sí.
//   2. **Lo que pidió el cliente**, que es el trabajo por hacer.
//   3. **Lo que se escribió en Drive**, que suele ser la mitad que falta.
//   4. **Lo que ya pasó**, al final y plegado: se consulta, no se lee.

import { useState, useTransition } from "react";
import { habilitarExtraDePieza } from "@/app/(admin)/gestion/acciones";
import { EN_PALABRAS } from "@/dominio/historia";
import { Plegable } from "@/admin/Plegable";
import { Visibilidad } from "@/admin/Visibilidad";
import { Responsable } from "@/admin/Responsable";
import { DiasDeRevision } from "@/admin/DiasDeRevision";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import type { NodoArchivo } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";

const cuando = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const enPalabras = (iso: string) => {
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? "" : cuando.format(f);
};

export function DetalleDePieza({
  pieza,
  archivo,
  carpetaId,
  equipo,
  onCambio,
}: {
  /** Lo anotado: qué pidió el cliente, qué se comentó en Drive, qué pasó. */
  pieza: PiezaConHistoria;
  /** Lo que se puede cambiar de la pieza: visible, quién la lleva, su plazo. */
  archivo: NodoArchivo;
  carpetaId: string;
  equipo: Persona[];
  onCambio: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      {pieza.estado === "extra_pedida" && (
        <VueltaExtra carpetaId={carpetaId} piezaId={pieza.id} onHecho={onCambio} />
      )}

      {pieza.cambios.length > 0 && (
        <div className="border-l-4 border-acento bg-acento-tenue/40 py-1.5 pl-3">
          <p className="text-micro font-extrabold uppercase tracking-widest text-acento">
            {pieza.enviada ? "Lo que pidió" : "Está escribiendo"}
          </p>
          <ol className="mt-1 flex flex-col gap-1">
            {pieza.cambios.map((cambio, i) => (
              <li key={cambio.id} className="flex gap-2 text-menudo text-tinta-suave">
                <span className="shrink-0 font-extrabold text-apagado">{i + 1}.</span>
                <span className="min-w-0 whitespace-pre-wrap">{cambio.texto}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {pieza.comentarios.length > 0 && (
        <div className="border-l-4 border-espera-borde bg-espera-tenue py-1.5 pl-3">
          <p className="text-micro font-extrabold uppercase tracking-widest text-espera">
            {pieza.comentarios.length === 1
              ? "1 comentario en Drive"
              : `${pieza.comentarios.length} comentarios en Drive`}
          </p>
          <ul className="mt-1 flex flex-col gap-1.5">
            {pieza.comentarios.map((c) => (
              <li key={c.id} className="text-menudo text-tinta-suave">
                <span className="font-bold">{c.quien}</span>
                <span className="text-apagado"> · {enPalabras(c.cuando)}</span>
                <span className="block whitespace-pre-wrap">{c.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        **Lo que se puede cambiar de esta pieza, y lo que ya le pasó.**
        Estaban en dos pantallas distintas: la configuración en el engranaje
        del árbol y la historia en la pantalla de la carpeta. Van juntas y
        plegadas: se miran mucho menos de lo que se mira el trabajo, pero
        cuando se necesitan se necesitan acá.
      */}
      <Plegable
        titulo={<span className="text-menudo">Configurar</span>}
        resumen={
          pieza.historia.length > 0 ? `${pieza.historia.length} cosas pasaron` : undefined
        }
      >
        <div className="mt-3 flex flex-col gap-4 border-l-2 border-linea pl-3">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
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
          </div>

          {pieza.historia.length > 0 && (
            <section>
              <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
                Lo que pasó
              </h4>
              <ol className="mt-1.5 flex flex-col gap-1">
                {[...pieza.historia].reverse().map((h) => (
                  <li key={h.id} className="text-micro text-apagado">
                    <span className="cifras">{enPalabras(h.cuando)}</span>
                    {" · "}
                    <span className="font-bold text-tinta-suave">{h.quien}</span>
                    {": "}
                    {EN_PALABRAS[h.que]}
                    {h.detalle && <span className="block pl-2">{h.detalle}</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </Plegable>

    </div>
  );
}

/**
 * La vuelta extra que pidió el cliente, con el botón para dársela.
 *
 * **Es lo único de esta ventana que no es información.** El cliente se quedó
 * sin vueltas incluidas, pidió una más, y el portal le dijo «te avisamos
 * cuando la habiliten». Hasta ahora había que ir a buscar el botón a la ficha
 * del archivo, en otra pantalla: el cliente esperaba a que alguien pasara por
 * ahí de casualidad.
 *
 * Es un botón pelado a propósito: qué pasó ya lo dice el estado de la pieza,
 * que está a dos centímetros.
 */
function VueltaExtra({
  carpetaId,
  piezaId,
  onHecho,
}: {
  carpetaId: string;
  piezaId: string;
  onHecho: () => void;
}) {
  const [yendo, empezar] = useTransition();
  const [dicho, setDicho] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* **Un botón y nada más.** Estaba con un cartel de dos líneas
          explicando qué había pasado, y el estado de la pieza —«revisión
          adicional pedida»— ya lo dice al lado. Repetirlo hacía que la única
          cosa accionable de la ventana quedara enterrada en su propia
          explicación. */}
      <button
        type="button"
        disabled={yendo}
        onClick={() =>
          empezar(async () => {
            const r = await habilitarExtraDePieza(carpetaId, piezaId);
            setDicho(r.motivo);
            if (r.ok) onHecho();
          })
        }
        className="min-h-toque bg-acento px-4 text-normal font-bold tracking-tight
                   text-white transition-colors hover:bg-acento-hover disabled:opacity-40"
      >
        {yendo ? "…" : "Otorgar revisión extra"}
      </button>
      {dicho && (
        <span aria-live="polite" className="text-menudo font-semibold text-tinta-suave">
          {dicho}
        </span>
      )}
    </div>
  );
}
