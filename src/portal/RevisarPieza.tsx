"use client";

// Una pieza, abierta para revisarla.
//
// Es una ventana y no un despliegue hacia abajo: se abre desde el calendario o
// desde la lista, se resuelve, se cierra y sigue la que viene — sin perder el
// lugar donde se estaba. Trae el paso a la anterior y a la siguiente, que es
// lo que permite hacer las doce de una sentada.
//
// **La pieza tiene que verse sin desplazar.** Es lo que se vino a mirar: si
// hay que buscarla moviendo la pantalla, la ventana falló. Por eso la imagen
// se mide contra el alto de la pantalla y no contra su propia proporción.

import { useState } from "react";
import type { Evento, Pieza } from "@/dominio/pieza";
import { Boton, BotonEnlace } from "@/ui/Boton";
import { Comparador } from "@/ui/Comparador";
import { pasoActual, Seguimiento } from "@/ui/Seguimiento";
import {
  IconoAmpliar,
  IconoAprobar,
  IconoCerrar,
  IconoComparar,
  IconoDescargar,
  IconoDeshacer,
  IconoEditar,
  IconoEnviar,
  IconoFlecha,
} from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import { fechaCorta } from "@/lib/fechas";
import { urlDeMiniatura } from "@/lib/miniaturas";
import type { VersionEjemplo } from "@/portal/datos/ejemplo";

export type PiezaAbierta = Pieza & {
  id: string;
  nombre: string;
  driveFileId: string;
  modificado?: string;
  versiones: VersionEjemplo[];
  publicaEl?: Date;
  pedido: string;
  enviada: boolean;
  editando: boolean;
};

type Props = {
  pieza: PiezaAbierta;
  posicion: { actual: number; total: number };
  onIr: (paso: -1 | 1) => void;
  onCerrar: () => void;
  onEvento: (evento: Evento, extra?: Partial<PiezaAbierta>) => void;
  onEscribir: (texto: string) => void;
  onGuardar: () => void;
  onEnviarEsta: () => void;
  onAmpliar: (src: string, alt: string) => void;
};

export function RevisarPieza({
  pieza,
  posicion,
  onIr,
  onCerrar,
  onEvento,
  onEscribir,
  onGuardar,
  onEnviarEsta,
  onAmpliar,
}: Props) {
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);
  const [comparando, setComparando] = useState(false);

  const hayAnterior = pieza.versiones.length > 1;
  const pendiente =
    !pieza.enviada && (pieza.estado === "entregada" || pieza.estado === "en_revision");
  const pidiendoCambios = !pieza.enviada && pieza.estado === "cambios_marcados";

  const srcGrande = urlDeMiniatura(pieza.driveFileId, 1200, pieza.modificado);

  const version = (indice: number) => {
    const v = pieza.versiones[indice];
    return {
      numero: v.numero,
      src: urlDeMiniatura(v.driveFileId, 1200, v.modificado),
      pie: `Entregada el ${fechaCorta(v.entregadaEl)}`,
    };
  };

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-tinta/50 sm:items-center sm:p-6">
      <div
        ref={marco}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={pieza.nombre}
        className="flex w-full flex-col overflow-hidden bg-papel sm:max-h-[94vh] sm:max-w-6xl sm:rounded-2xl sm:shadow-2xl"
      >
        {/* ------------------------- Encabezado ------------------------- */}
        {/* La banda de color es el encabezado: dice de quién es la pieza, cómo
            se llama y en qué anda, sin que haya que buscarlo. */}
        <header className="flex items-center gap-4 bg-acento px-4 py-4 text-white sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-micro font-extrabold uppercase tracking-widest text-white/60">
              Pieza {posicion.actual} de {posicion.total}
              {pieza.publicaEl && ` · sale el ${fechaCorta(pieza.publicaEl)}`}
            </p>
            <h2 className="mt-0.5 truncate text-titulo font-extrabold tracking-tight">
              {pieza.nombre}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden bg-white/15 px-3 py-1.5 text-micro font-extrabold uppercase tracking-wider sm:block">
              {pasoActual(pieza.ronda, pieza.rondasIncluidas, pieza.estado === "final")}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onIr(-1)}
                disabled={posicion.total < 2}
                aria-label="Pieza anterior"
                className="grid h-9 w-9 place-items-center bg-white/15 transition-colors hover:bg-white/25 disabled:opacity-35"
              >
                <IconoFlecha className="rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => onIr(1)}
                disabled={posicion.total < 2}
                aria-label="Pieza siguiente"
                className="grid h-9 w-9 place-items-center bg-white/15 transition-colors hover:bg-white/25 disabled:opacity-35"
              >
                <IconoFlecha />
              </button>
              <button
                type="button"
                onClick={onCerrar}
                aria-label="Cerrar"
                className="grid h-9 w-9 place-items-center bg-white text-acento transition-colors hover:bg-white/90"
              >
                <IconoCerrar />
              </button>
            </div>
          </div>
        </header>

        {/* --------------------------- Cuerpo --------------------------- */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
            {/* La pieza. Medida contra la pantalla, no contra su proporción:
                así entra siempre sin tener que desplazar. */}
            <div className="flex flex-col gap-3">
              {comparando && hayAnterior ? (
                <Comparador
                  nombre={pieza.nombre}
                  antes={version(pieza.versiones.length - 2)}
                  ahora={version(pieza.versiones.length - 1)}
                  onAmpliar={onAmpliar}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onAmpliar(srcGrande, pieza.nombre)}
                  aria-label={`Ver ${pieza.nombre} en grande`}
                  className="group relative grid h-[38vh] w-full place-items-center overflow-hidden
                             border border-linea bg-lienzo sm:h-[46vh] lg:h-[58vh]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={srcGrande}
                    alt={pieza.nombre}
                    className="absolute inset-0 h-full w-full object-contain p-2"
                  />
                </button>
              )}

              <div className="flex flex-wrap gap-2">
                <Boton
                  variante="contorno"
                  tamano="chico"
                  onClick={() => onAmpliar(srcGrande, pieza.nombre)}
                >
                  <IconoAmpliar />
                  Ver en grande
                </Boton>

                {hayAnterior && (
                  <Boton
                    variante={comparando ? "principal" : "contorno"}
                    tamano="chico"
                    onClick={() => setComparando(!comparando)}
                    aria-pressed={comparando}
                  >
                    <IconoComparar />
                    {comparando
                      ? "Ver solo la última"
                      : `Comparar con la v${pieza.versiones.length - 1}`}
                  </Boton>
                )}
              </div>
            </div>

            {/* Las decisiones */}
            <div className="flex flex-col gap-6">
              <Seguimiento
                ronda={pieza.ronda}
                rondasIncluidas={pieza.rondasIncluidas}
                rondasExtra={pieza.rondasExtra}
                aprobada={pieza.estado === "final"}
              />

              {pieza.enviada && (
                <p className="rounded-xl bg-hueco px-4 py-3 text-normal text-tinta-suave">
                  Ya se lo mandamos al equipo.
                </p>
              )}

              {!pieza.enviada && pieza.estado === "final" && (
                <p className="rounded-xl bg-listo-tenue px-4 py-3 text-normal text-listo">
                  Aprobada. Va a salir tal cual está.
                </p>
              )}

              {pidiendoCambios && (
                <div className="flex flex-col gap-3">
                  {/* El título de lo que hay que escribir, con su propio peso y
                      separado del camino de arriba: es la tarea de la pantalla. */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label htmlFor={`pedido-${pieza.id}`} className="text-titulo font-semibold tracking-tight">
                      Qué habría que cambiar
                    </label>

                    {/* Editar y descartar viven arriba del cuadro, que es lo
                        que gobiernan. Abajo quedan las acciones que mandan la
                        pieza a algún lado. */}
                    <div className="flex flex-wrap gap-2">
                      {!pieza.editando && (
                        <Boton
                          variante="contorno"
                          tamano="chico"
                          onClick={() => onEvento({ tipo: "pedir_cambios" }, { editando: true })}
                        >
                          <IconoEditar />
                          Editar cambios
                        </Boton>
                      )}
                      <Boton
                        variante="sutil"
                        tamano="chico"
                        onClick={() =>
                          onEvento({ tipo: "descartar_cambios" }, { pedido: "", editando: false })
                        }
                      >
                        <IconoDeshacer />
                        Descartar
                      </Boton>
                    </div>
                  </div>

                  {pieza.editando ? (
                    <textarea
                      id={`pedido-${pieza.id}`}
                      value={pieza.pedido}
                      onChange={(e) => onEscribir(e.target.value)}
                      rows={8}
                      autoFocus
                      placeholder="Escribí lo que haya que ajustar. Podés guardarlo y volver más tarde a seguir."
                      className="w-full resize-y rounded-xl border border-linea bg-lienzo p-4 text-normal
                                 shadow-inner transition-colors placeholder:text-apagado
                                 focus:border-acento focus:outline-none focus:ring-4 focus:ring-acento-tenue"
                    />
                  ) : (
                    // Ya guardado: se lee, no se toca.
                    <p className="min-h-40 whitespace-pre-wrap rounded-xl border border-linea-tenue bg-hueco/60 p-4 text-normal">
                      {pieza.pedido.trim() || (
                        <span className="text-apagado">Todavía no escribiste nada.</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {pieza.estado === "extra_pedida" && (
                <p className="rounded-xl bg-acento-tenue px-4 py-3 text-normal text-acento">
                  Le pedimos al equipo una revisión adicional. Te avisamos cuando la habiliten.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------- Pie ----------------------------- */}
        <footer className="border-t-2 border-tinta bg-lienzo px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {pendiente && (
              <>
                <Boton variante="sutil" tamano="chico" onClick={onCerrar}>
                  Dejar esta para después
                </Boton>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Boton
                    variante="contorno"
                    onClick={() => onEvento({ tipo: "pedir_cambios" }, { editando: true })}
                  >
                    <IconoEditar />
                    Pedir cambios
                  </Boton>
                  <Boton
                    variante="aprobar"
                    onClick={() => onEvento({ tipo: "aprobar", por: "cliente" })}
                  >
                    <IconoAprobar />
                    Aprobar
                  </Boton>
                </div>
              </>
            )}

            {pidiendoCambios && pieza.editando && (
              <>
                <span className="hidden sm:block" />
                <Boton variante="principal" onClick={onGuardar}>
                  Guardar y seguir después
                </Boton>
              </>
            )}

            {pidiendoCambios && !pieza.editando && (
              <>
                <Boton variante="sutil" tamano="chico" onClick={onCerrar}>
                  Dejar esta para después
                </Boton>
                <Boton variante="principal" onClick={onEnviarEsta}>
                  <IconoEnviar />
                  Enviar revisión
                </Boton>
              </>
            )}

            {!pieza.enviada && pieza.estado === "final" && (
              <>
                <BotonEnlace
                  href={`/api/archivo/${pieza.driveFileId}`}
                  download
                  variante="contorno"
                  tamano="chico"
                >
                  <IconoDescargar />
                  Descargar original
                </BotonEnlace>
                <Boton variante="principal" onClick={onEnviarEsta}>
                  <IconoEnviar />
                  Enviar revisión
                </Boton>
              </>
            )}

            {pieza.enviada && (
              <>
                <span className="hidden sm:block" />
                {pieza.estado === "final" && (
                  <BotonEnlace
                    href={`/api/archivo/${pieza.driveFileId}`}
                    download
                    variante="contorno"
                    tamano="chico"
                  >
                    <IconoDescargar />
                    Descargar original
                  </BotonEnlace>
                )}
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
