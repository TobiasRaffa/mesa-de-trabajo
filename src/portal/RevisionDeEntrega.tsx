"use client";

// La revisión, como la trabaja el cliente.
//
// Tres ideas mandan sobre el diseño de esta pantalla:
//
//   1. **Las piezas empiezan cerradas.** Doce posteos abiertos a la vez son un
//      muro. Se abre una, se resuelve, se cierra sola y sigue la que viene.
//
//   2. **Guardar no es enviar.** Un cliente puede revisar tres piezas hoy,
//      cerrar el navegador y seguir mañana. Guardar deja el trabajo esperando;
//      enviar es el único momento en que la agencia recibe algo.
//
//   3. **La pieza se muestra entera.** Es una obra de diseño: recortarle un
//      borde puede cambiar lo que se está juzgando. Y se puede agrandar,
//      porque una miniatura no alcanza para decidir.
//
// Las reglas de qué se puede hacer en cada estado no están acá: salen de
// `aplicar()`, la misma función que va a correr en el servidor.

import { useEffect, useState } from "react";
import { aplicar, type Evento, type Pieza } from "@/dominio/pieza";
import { Ampliada } from "@/ui/Ampliada";
import { Boton } from "@/ui/Boton";
import { Estado } from "@/ui/Estado";
import { Seguimiento } from "@/ui/Seguimiento";
import { plazoEnPalabras } from "@/lib/fechas";
import type { EntregaEjemplo } from "@/portal/datos/ejemplo";

type EnPantalla = Pieza & {
  id: string;
  nombre: string;
  driveFileId: string;
  modificado?: string;
  /** Lo que el cliente escribió. Se guarda aunque todavía no se envíe. */
  pedido: string;
  /** Ya viajó a la agencia, sola o con el resto. */
  enviada: boolean;
};

const BORRADOR = "mesa-de-trabajo:borrador";

const miniatura = (p: EnPantalla, px: number) =>
  `/api/miniatura/${p.driveFileId}?px=${px}&v=${encodeURIComponent(p.modificado ?? "")}`;

export function RevisionDeEntrega({ entrega }: { entrega: EntregaEjemplo }) {
  const [piezas, setPiezas] = useState<EnPantalla[]>(() =>
    entrega.piezas.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      driveFileId: p.driveFileId,
      modificado: p.modificado,
      estado: p.estado,
      ronda: p.ronda,
      rondasIncluidas: entrega.rondasIncluidas,
      rondasExtra: entrega.rondasExtra,
      pedido: "",
      enviada: false,
    }))
  );
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<EnPantalla | null>(null);
  const [confirmando, setConfirmando] = useState<null | { soloEsta?: string }>(null);
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Mientras no exista la base de datos, el trabajo a medio hacer queda en el
  // navegador. Es lo que hace que «Guardar» signifique algo hoy. Cuando exista
  // la base, esto se reemplaza por una llamada al servidor y la pantalla no
  // cambia.
  useEffect(() => {
    try {
      const crudo = localStorage.getItem(BORRADOR);
      if (!crudo) return;
      const guardado = JSON.parse(crudo) as Record<
        string,
        { estado: string; pedido: string; enviada?: boolean }
      >;
      // El linter desaconseja cambiar el estado dentro de un efecto, y tiene
      // razón como regla general. Acá es a propósito: el servidor no puede
      // saber qué guardó este navegador. Evitarlo prolijamente pide más
      // maquinaria de la que merece algo que se borra cuando llegue la base.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPiezas((antes) =>
        antes.map((p) =>
          guardado[p.id]
            ? {
                ...p,
                estado: guardado[p.id].estado as Pieza["estado"],
                pedido: guardado[p.id].pedido,
                enviada: guardado[p.id].enviada ?? false,
              }
            : p
        )
      );
    } catch {
      // Un navegador que no deja guardar no es motivo para romper la pantalla.
    }
  }, []);

  function guardar(siguientes: EnPantalla[]) {
    try {
      localStorage.setItem(
        BORRADOR,
        JSON.stringify(
          Object.fromEntries(
            siguientes.map((p) => [
              p.id,
              { estado: p.estado, pedido: p.pedido, enviada: p.enviada },
            ])
          )
        )
      );
    } catch {}
  }

  function mover(id: string, evento: Evento, extra?: Partial<EnPantalla>) {
    setRechazo(null);
    setPiezas((antes) => {
      const siguientes = antes.map((pieza) => {
        if (pieza.id !== id) return pieza;
        const resultado = aplicar(pieza, evento);
        if (!resultado.ok) {
          setRechazo(resultado.motivo);
          return pieza;
        }
        return { ...pieza, ...resultado.pieza, ...extra };
      });
      guardar(siguientes);
      return siguientes;
    });
  }

  function enviar(soloEsta?: string) {
    setPiezas((antes) => {
      const siguientes = antes.map((pieza) => {
        if (soloEsta && pieza.id !== soloEsta) return pieza;
        if (pieza.enviada) return pieza;
        const r = aplicar(pieza, { tipo: "cerrar_revision" });
        return r.ok ? { ...pieza, ...r.pieza, enviada: true } : pieza;
      });
      guardar(siguientes);
      return siguientes;
    });
    setConfirmando(null);
    setAbierta(null);
    setAviso(soloEsta ? "Enviamos esa pieza al equipo." : "Enviamos la revisión al equipo.");
  }

  const sinDecidir = piezas.filter(
    (p) => !p.enviada && (p.estado === "entregada" || p.estado === "en_revision")
  );
  const paraEnviar = piezas.filter(
    (p) => !p.enviada && (p.estado === "final" || p.estado === "cambios_marcados")
  );

  return (
    <>
      {aviso && (
        <p className="mt-6 rounded-lg bg-listo-tenue px-5 py-4 text-normal text-listo">
          {aviso}
        </p>
      )}

      <ul className="mt-2 divide-y divide-linea-tenue border-b border-linea-tenue">
        {piezas.map((pieza) => {
          const estaAbierta = abierta === pieza.id;
          const pendiente =
            !pieza.enviada &&
            (pieza.estado === "entregada" || pieza.estado === "en_revision");

          return (
            <li key={pieza.id}>
              {/* ------------------------- La fila ------------------------- */}
              <button
                type="button"
                onClick={() => setAbierta(estaAbierta ? null : pieza.id)}
                aria-expanded={estaAbierta}
                className="flex w-full items-center gap-5 py-5 text-left transition-colors hover:bg-hueco/50"
              >
                <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-linea bg-hueco">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={miniatura(pieza, 220)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-guia font-semibold leading-snug">
                    {pieza.nombre}
                  </span>
                  {pieza.pedido && (
                    <span className="mt-1 block truncate text-menudo text-apagado">
                      {pieza.pedido}
                    </span>
                  )}
                </span>

                <Estado estado={pieza.estado} />

                <span
                  aria-hidden="true"
                  className={`shrink-0 text-apagado transition-transform ${
                    estaAbierta ? "rotate-180" : ""
                  }`}
                >
                  ▾
                </span>
              </button>

              {/* ------------------------ Desplegada ----------------------- */}
              {estaAbierta && (
                <div className="grid gap-8 pb-12 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12">
                  {/* La pieza, entera y ampliable. */}
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setAmpliada(pieza)}
                      aria-label={`Ver ${pieza.nombre} en grande`}
                      className="group relative grid aspect-[4/5] place-items-center overflow-hidden rounded-lg border border-linea bg-hueco"
                    >
                      <span className="px-6 text-center text-micro text-apagado">
                        {pieza.nombre}
                      </span>
                      {/* object-contain y no cover: la pieza se ve completa. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={miniatura(pieza, 800)}
                        alt={pieza.nombre}
                        className="absolute inset-0 h-full w-full bg-hueco object-contain transition-transform group-hover:scale-[1.02]"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmpliada(pieza)}
                      className="self-start text-menudo text-acento underline underline-offset-4 hover:text-acento-hover"
                    >
                      Ver en grande
                    </button>
                  </div>

                  {/* Las decisiones. */}
                  <div className="flex flex-col gap-6">
                    <Seguimiento
                      ronda={pieza.ronda}
                      rondasIncluidas={pieza.rondasIncluidas}
                      rondasExtra={pieza.rondasExtra}
                      aprobada={pieza.estado === "final"}
                    />

                    {pieza.enviada && (
                      <p className="text-guia text-tinta-suave">Ya se lo mandamos al equipo.</p>
                    )}

                    {!pieza.enviada && pieza.estado === "final" && (
                      <>
                        <p className="text-guia text-listo">Aprobada. Va a salir tal cual está.</p>
                        <div>
                          <Boton
                            variante="principal"
                            onClick={() => setConfirmando({ soloEsta: pieza.id })}
                          >
                            Enviar solo esta
                          </Boton>
                        </div>
                      </>
                    )}

                    {!pieza.enviada && pieza.estado === "cambios_marcados" && (
                      <>
                        <div>
                          <label
                            htmlFor={`pedido-${pieza.id}`}
                            className="block text-micro uppercase tracking-widest text-apagado"
                          >
                            Qué habría que cambiar
                          </label>
                          <textarea
                            id={`pedido-${pieza.id}`}
                            value={pieza.pedido}
                            onChange={(e) =>
                              setPiezas((antes) =>
                                antes.map((p) =>
                                  p.id === pieza.id ? { ...p, pedido: e.target.value } : p
                                )
                              )
                            }
                            rows={6}
                            placeholder="Escribí lo que haya que ajustar. Podés volver más tarde y seguir agregando."
                            className="mt-3 w-full rounded-lg border border-linea bg-lienzo p-4 text-normal
                                       placeholder:text-apagado focus:border-acento focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Boton
                            variante="principal"
                            onClick={() => {
                              setPiezas((antes) => {
                                guardar(antes);
                                return antes;
                              });
                              setAbierta(null);
                            }}
                          >
                            Guardar y seguir después
                          </Boton>
                          <Boton
                            variante="secundario"
                            onClick={() => setConfirmando({ soloEsta: pieza.id })}
                          >
                            Enviar solo esta
                          </Boton>
                          <Boton
                            variante="sutil"
                            onClick={() =>
                              mover(pieza.id, { tipo: "descartar_cambios" }, { pedido: "" })
                            }
                          >
                            Descartar
                          </Boton>
                        </div>

                        <p className="text-menudo text-apagado">
                          Esto todavía no llegó a la agencia.
                        </p>
                      </>
                    )}

                    {pendiente && (
                      <>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Boton
                            variante="aprobar"
                            onClick={() => mover(pieza.id, { tipo: "aprobar", por: "cliente" })}
                          >
                            Está bien así
                          </Boton>
                          <Boton
                            variante="secundario"
                            onClick={() => mover(pieza.id, { tipo: "pedir_cambios" })}
                          >
                            Pedir cambios
                          </Boton>
                        </div>
                        <p className="text-menudo text-apagado">
                          Si aprobás, esta pieza queda cerrada y el equipo puede avanzar con
                          ella enseguida.
                        </p>
                      </>
                    )}

                    {pieza.estado === "extra_pedida" && (
                      <p className="text-guia text-tinta-suave">
                        Le pedimos al equipo una revisión adicional. Te avisamos cuando la
                        habiliten.
                      </p>
                    )}

                    {!pieza.enviada && (
                      <button
                        type="button"
                        onClick={() => setAbierta(null)}
                        className="self-start text-menudo text-apagado underline underline-offset-4 hover:text-tinta"
                      >
                        Dejar esta para después
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {rechazo && (
        <p className="mt-6 rounded-lg bg-espera-tenue px-5 py-4 text-normal text-espera">
          {rechazo}
        </p>
      )}

      {/* --------------------- Enviar todo lo resuelto --------------------- */}
      <div
        className="fixed inset-x-0 bottom-0 border-t border-linea bg-lienzo/95 backdrop-blur
                   lg:static lg:mt-8 lg:rounded-lg lg:border lg:bg-lienzo lg:backdrop-blur-none"
      >
        <div
          className="mx-auto flex max-w-6xl flex-col gap-3 px-5 pt-4
                     pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-8
                     lg:flex-row lg:items-center lg:justify-between lg:py-5"
        >
          <div className="order-2 lg:order-1">
            <p className="text-normal">
              <span className="font-semibold">
                {piezas.length - sinDecidir.length} de {piezas.length}
              </span>{" "}
              <span className="text-apagado">resueltas</span>
            </p>
            <p className="mt-0.5 text-menudo text-apagado">
              Plazo {entrega.plazoDias} días · {plazoEnPalabras(entrega.vence)}
            </p>
          </div>

          <div className="order-1 w-full lg:order-2 lg:w-auto">
            <Boton ancho disabled={paraEnviar.length === 0} onClick={() => setConfirmando({})}>
              Enviar revisión completa
            </Boton>
          </div>
        </div>
      </div>

      {ampliada && (
        <Ampliada
          src={miniatura(ampliada, 1200)}
          alt={ampliada.nombre}
          onCerrar={() => setAmpliada(null)}
        />
      )}

      {confirmando && (
        <Confirmacion
          proyecto={entrega.proyecto}
          piezas={
            confirmando.soloEsta
              ? paraEnviar.filter((p) => p.id === confirmando.soloEsta)
              : paraEnviar
          }
          sinRevisar={confirmando.soloEsta ? [] : sinDecidir.map((p) => p.nombre)}
          soloUna={Boolean(confirmando.soloEsta)}
          onVolver={() => setConfirmando(null)}
          onEnviar={() => enviar(confirmando.soloEsta)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * El resumen antes de enviar.
 *
 * Enviar es el único acto de esta pantalla que la agencia ve, y no se deshace.
 * Merece que el cliente lea qué está mandando: qué aprobó, qué pidió cambiar
 * y —sobre todo— si quedó alguna sin mirar.
 */
function Confirmacion({
  proyecto,
  piezas,
  sinRevisar,
  soloUna,
  onVolver,
  onEnviar,
}: {
  proyecto: string;
  piezas: Array<{ nombre: string; estado: Pieza["estado"]; pedido: string }>;
  sinRevisar: string[];
  soloUna: boolean;
  onVolver: () => void;
  onEnviar: () => void;
}) {
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => e.key === "Escape" && onVolver();
    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [onVolver]);

  const aprobadas = piezas.filter((p) => p.estado === "final");
  const conCambios = piezas.filter((p) => p.estado === "cambios_marcados");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 sm:items-center sm:p-6"
      onClick={onVolver}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-confirmacion"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-lienzo sm:rounded-2xl"
      >
        <div className="px-6 pt-7">
          <h2 id="titulo-confirmacion" className="text-titulo font-semibold tracking-tight">
            {soloUna ? "Enviar esta pieza" : "Antes de enviar"}
          </h2>
          <p className="mt-1.5 text-menudo text-apagado">{proyecto}</p>

          <div className="mt-7 space-y-7">
            {aprobadas.length > 0 && (
              <section>
                <h3 className="text-micro uppercase tracking-widest text-listo">
                  Aprobadas · {aprobadas.length}
                </h3>
                <ul className="mt-3 space-y-1.5">
                  {aprobadas.map((p) => (
                    <li key={p.nombre} className="text-normal">
                      {p.nombre}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {conCambios.length > 0 && (
              <section>
                <h3 className="text-micro uppercase tracking-widest text-acento">
                  Con cambios · {conCambios.length}
                </h3>
                <ul className="mt-3 space-y-4">
                  {conCambios.map((p) => (
                    <li key={p.nombre}>
                      <p className="text-normal font-semibold">{p.nombre}</p>
                      <p className="mt-1 text-menudo text-tinta-suave">
                        {p.pedido.trim() || (
                          <span className="text-espera">Sin escribir qué cambiar</span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {sinRevisar.length > 0 && (
              <section className="rounded-lg bg-espera-tenue px-5 py-4">
                <h3 className="text-micro uppercase tracking-widest text-espera">
                  Sin revisar · {sinRevisar.length}
                </h3>
                <ul className="mt-3 space-y-1.5">
                  {sinRevisar.map((n) => (
                    <li key={n} className="text-menudo text-tinta-suave">
                      {n}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-menudo text-espera">
                  Estas quedan esperándote. Podés volver más tarde y resolverlas.
                </p>
              </section>
            )}
          </div>

          <p className="mt-8 text-menudo text-apagado">
            {soloUna
              ? "El equipo recibe solo esta pieza y empieza a trabajarla. El resto sigue esperándote."
              : "El equipo recibe la devolución y empieza a trabajar sobre los cambios."}
          </p>
        </div>

        <div className="sticky bottom-0 mt-8 flex flex-col gap-3 border-t border-linea-tenue bg-lienzo px-6 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:flex-row-reverse sm:pb-5">
          <Boton ancho onClick={onEnviar}>
            Sí, enviar
          </Boton>
          <Boton variante="secundario" ancho onClick={onVolver}>
            Volver
          </Boton>
        </div>
      </div>
    </div>
  );
}
