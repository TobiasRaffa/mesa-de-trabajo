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
import { cambiosPorVuelta, EN_PALABRAS } from "@/dominio/historia";
import { Plegable } from "@/admin/Plegable";
import { Visibilidad } from "@/admin/Visibilidad";
import { Responsable } from "@/admin/Responsable";
import { DiasDeRevision } from "@/admin/DiasDeRevision";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import type { NodoArchivo } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";
import { IconoCerrar } from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";

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
  const [configurando, setConfigurando] = useState(false);

  const vueltas = cambiosPorVuelta(
    pieza.historia,
    pieza.cambios.map((c) => c.texto),
    archivo.vueltas,
    pieza.enviada
  );

  return (
    <div className="mt-3 flex flex-col gap-3">
      {/*
        **Lo que pidió el cliente, vuelta por vuelta.** Estaba todo junto en
        una lista sin decir de cuál versión era cada cosa: con tres vueltas
        encima, eso es un párrafo del que no se puede sacar por qué salió así
        la V2.
      */}
      {vueltas.length > 0 && (
        <div className="flex flex-col gap-2">
          {vueltas.map((v) => (
            <div
              key={v.version}
              className="border-l-4 border-acento bg-acento-tenue/40 py-1.5 pl-3"
            >
              <p className="text-micro font-extrabold uppercase tracking-widest text-acento">
                Cambios v{v.version}
                {v.abierta && (
                  <span className="ml-2 font-bold text-apagado">
                    los está escribiendo
                  </span>
                )}
              </p>
              <ol className="mt-1 flex flex-col gap-1">
                {v.puntos.map((texto, i) => (
                  <li key={i} className="flex gap-2 text-menudo text-tinta-suave">
                    <span className="shrink-0 font-extrabold text-apagado">{i + 1}.</span>
                    <span className="min-w-0 whitespace-pre-wrap">{texto}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
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
        **Los botones, al final.** Arriba competían con el nombre y el estado,
        que es lo que se mira primero; y lo que se hace con una pieza se decide
        después de haberla mirado, no antes.
      */}
      <div className="flex flex-wrap items-center gap-2 border-t border-linea pt-3">
        {pieza.estado === "extra_pedida" && (
          <VueltaExtra carpetaId={carpetaId} piezaId={pieza.id} onHecho={onCambio} />
        )}
        <button
          type="button"
          onClick={() => setConfigurando(!configurando)}
          aria-expanded={configurando}
          className={`min-h-toque border-2 border-tinta px-3 text-menudo font-bold
                      tracking-tight transition-colors ${
                        configurando ? "bg-tinta text-lienzo" : "text-tinta hover:bg-hueco"
                      }`}
        >
          Configurar
        </button>
      </div>

      {configurando && (
        <Configuracion
          pieza={pieza}
          archivo={archivo}
          carpetaId={carpetaId}
          equipo={equipo}
          onCambio={onCambio}
          onCerrar={() => setConfigurando(false)}
        />
      )}
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

/**
 * La configuración de una pieza, en su propia ventana.
 *
 * **Se abre encima y no debajo.** Adentro hay tres controles y la lista entera
 * de lo que pasó: desplegado dentro de la ficha empujaba la pieza fuera de la
 * pantalla, y quien estaba mirando el trabajo perdía el trabajo de vista.
 *
 * Lo que pasó viene plegado. Es lo que se consulta el día que alguien discute
 * qué se aprobó, no cada vez que se cambia quién lleva algo.
 */
function Configuracion({
  pieza,
  archivo,
  carpetaId,
  equipo,
  onCambio,
  onCerrar,
}: {
  pieza: PiezaConHistoria;
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

          {pieza.historia.length > 0 && (
            <Plegable
              titulo={<span className="text-normal">Lo que pasó</span>}
              resumen={`${pieza.historia.length} ${
                pieza.historia.length === 1 ? "cosa" : "cosas"
              }`}
            >
              <ol className="mt-2 flex flex-col gap-1 border-l-2 border-linea pl-3">
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
            </Plegable>
          )}
        </div>
      </div>
    </div>
  );
}
