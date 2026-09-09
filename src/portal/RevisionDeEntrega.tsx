"use client";

// La revisión, como la trabaja el cliente.
//
// Dos ideas mandan sobre el diseño de esta pantalla:
//
//   1. **Las piezas empiezan cerradas.** Doce posteos abiertos a la vez son un
//      muro. Se abre una, se resuelve, se cierra sola y se sigue con la que
//      viene. La lista siempre deja ver cuánto falta.
//
//   2. **Guardar no es enviar.** Un cliente puede revisar tres piezas hoy,
//      cerrar el navegador y seguir mañana. Guardar deja el trabajo esperando;
//      enviar es el único momento en que la agencia recibe algo. Son dos
//      botones distintos, en dos lugares distintos, y lo dicen con todas las
//      letras.
//
// Las reglas de qué se puede hacer en cada estado no están acá: salen de
// `aplicar()`, la misma función que va a correr en el servidor.

import { useEffect, useState } from "react";
import { aplicar, type Evento, type Pieza } from "@/dominio/pieza";
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
};

const BORRADOR = "mesa-de-trabajo:borrador";

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
    }))
  );
  const [abierta, setAbierta] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [guardadoHace, setGuardadoHace] = useState<string | null>(null);

  // Mientras no exista la base de datos, el trabajo a medio hacer queda en el
  // navegador. Es lo que hace que «Guardar» signifique algo hoy: el cliente
  // puede cerrar la pestaña y volver mañana. Cuando exista la base, esto se
  // reemplaza por una llamada al servidor y la pantalla no cambia.
  useEffect(() => {
    try {
      const crudo = localStorage.getItem(BORRADOR);
      if (!crudo) return;
      const guardado = JSON.parse(crudo) as Record<string, { estado: string; pedido: string }>;
      // El linter desaconseja cambiar el estado dentro de un efecto, y tiene
      // razón como regla general. Acá es a propósito: el servidor no puede
      // saber qué guardó este navegador, así que el borrador solo se puede
      // recuperar una vez montada la pantalla. Evitarlo prolijamente pide
      // bastante más maquinaria de la que merece un mecanismo que se borra el
      // día que exista la base de datos.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPiezas((antes) =>
        antes.map((p) =>
          guardado[p.id]
            ? { ...p, estado: guardado[p.id].estado as Pieza["estado"], pedido: guardado[p.id].pedido }
            : p
        )
      );
      setGuardadoHace("recuperado de la última vez");
    } catch {
      // Un navegador que no deja guardar no es motivo para romper la pantalla.
    }
  }, []);

  function guardar(siguientes: EnPantalla[]) {
    try {
      const resumen = Object.fromEntries(
        siguientes.map((p) => [p.id, { estado: p.estado, pedido: p.pedido }])
      );
      localStorage.setItem(BORRADOR, JSON.stringify(resumen));
      setGuardadoHace("guardado");
    } catch {
      setGuardadoHace(null);
    }
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

  function escribir(id: string, texto: string) {
    setPiezas((antes) => antes.map((p) => (p.id === id ? { ...p, pedido: texto } : p)));
    setGuardadoHace(null);
  }

  const pendientes = piezas.filter(
    (p) => p.estado === "entregada" || p.estado === "en_revision"
  );
  const aprobadas = piezas.filter((p) => p.estado === "final");
  const conCambios = piezas.filter((p) => p.estado === "cambios_marcados");
  const hayAlgoQueEnviar = conCambios.length > 0 || aprobadas.length > 0;

  function enviarRevision() {
    setPiezas((antes) =>
      antes.map((pieza) => {
        const r = aplicar(pieza, { tipo: "cerrar_revision" });
        return r.ok ? { ...pieza, ...r.pieza } : pieza;
      })
    );
    try {
      localStorage.removeItem(BORRADOR);
    } catch {}
    setConfirmando(false);
    setEnviada(true);
  }

  if (enviada) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-titulo font-semibold">Listo, ya lo recibimos</h2>
        <p className="mx-auto mt-3 max-w-prose text-tinta-suave">
          {aprobadas.length > 0 &&
            `${aprobadas.length} ${aprobadas.length === 1 ? "pieza aprobada" : "piezas aprobadas"}`}
          {aprobadas.length > 0 && conCambios.length > 0 && " y "}
          {conCambios.length > 0 &&
            `${conCambios.length} ${conCambios.length === 1 ? "con cambios" : "con cambios"}`}
          . El equipo ya está viendo la devolución.
        </p>
        <p className="mt-10 text-menudo text-apagado">
          Esto es una prueba: al recargar la página vuelve todo al principio.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-linea-tenue border-b border-linea-tenue">
        {piezas.map((pieza) => {
          const estaAbierta = abierta === pieza.id;
          const decidida = pieza.estado === "final" || pieza.estado === "cambios_marcados";

          return (
            <li key={pieza.id}>
              {/* ---- La fila cerrada ---- */}
              <button
                type="button"
                onClick={() => setAbierta(estaAbierta ? null : pieza.id)}
                aria-expanded={estaAbierta}
                className="flex w-full items-center gap-4 py-3 text-left hover:bg-hueco/60"
              >
                <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border border-linea bg-hueco">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/miniatura/${pieza.driveFileId}?px=220&v=${encodeURIComponent(
                      pieza.modificado ?? ""
                    )}`}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{pieza.nombre}</span>
                  {pieza.estado === "cambios_marcados" && pieza.pedido && (
                    <span className="mt-0.5 block truncate text-menudo text-apagado">
                      {pieza.pedido}
                    </span>
                  )}
                </span>

                <Estado estado={pieza.estado} />

                <span
                  aria-hidden="true"
                  className={`shrink-0 text-apagado transition-transform ${estaAbierta ? "rotate-180" : ""}`}
                >
                  ▾
                </span>
              </button>

              {/* ---- Abierta ---- */}
              {estaAbierta && (
                <div className="grid gap-6 pb-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
                  <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-lg border border-linea bg-hueco">
                    <span className="px-4 text-center text-micro text-apagado">
                      {pieza.nombre}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/miniatura/${pieza.driveFileId}?px=800&v=${encodeURIComponent(
                        pieza.modificado ?? ""
                      )}`}
                      alt={pieza.nombre}
                      className="absolute inset-0 h-full w-full bg-hueco object-cover"
                    />
                  </div>

                  <div className="flex flex-col gap-4">
                    <Seguimiento
                      ronda={pieza.ronda}
                      rondasIncluidas={pieza.rondasIncluidas}
                      rondasExtra={pieza.rondasExtra}
                      aprobada={pieza.estado === "final"}
                    />

                    {pieza.estado === "final" && (
                      <p className="text-normal text-listo">
                        Aprobada. Ya podemos avanzar con esta.
                      </p>
                    )}

                    {pieza.estado === "cambios_marcados" && (
                      <>
                        <div>
                          <label
                            htmlFor={`pedido-${pieza.id}`}
                            className="block text-menudo font-semibold"
                          >
                            Qué habría que cambiar
                          </label>
                          <textarea
                            id={`pedido-${pieza.id}`}
                            value={pieza.pedido}
                            onChange={(e) => escribir(pieza.id, e.target.value)}
                            rows={5}
                            placeholder="Escribí acá lo que haya que ajustar. Podés volver más tarde y seguir agregando."
                            className="mt-2 w-full rounded-md border border-linea bg-lienzo p-3 text-normal
                                       placeholder:text-apagado focus:border-acento focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                          <button
                            type="button"
                            onClick={() =>
                              mover(pieza.id, { tipo: "aprobar", por: "cliente" }, { pedido: "" })
                            }
                            className="min-h-toque text-menudo text-acento underline underline-offset-4 hover:text-acento-hover"
                          >
                            Mejor está bien así
                          </button>
                        </div>
                        <p className="text-menudo text-apagado">
                          Esto todavía no llegó a la agencia. Se envía todo junto al final.
                        </p>
                      </>
                    )}

                    {(pieza.estado === "entregada" || pieza.estado === "en_revision") && (
                      <>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Boton
                            variante="aprobar"
                            onClick={() => {
                              mover(pieza.id, { tipo: "aprobar", por: "cliente" });
                              setAbierta(null);
                            }}
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
                      <p className="text-normal text-tinta-suave">
                        Le pedimos al equipo una revisión adicional. Te avisamos cuando la
                        habiliten.
                      </p>
                    )}

                    {!decidida && (
                      <button
                        type="button"
                        onClick={() => setAbierta(null)}
                        className="self-start text-menudo text-apagado underline underline-offset-4"
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
        <p className="mt-6 rounded-md bg-espera-tenue px-4 py-3 text-menudo text-espera">
          {rechazo}
        </p>
      )}

      {/* ---- La barra de abajo: enviar, que es otra cosa que guardar ---- */}
      <div
        className="fixed inset-x-0 bottom-0 border-t border-linea bg-lienzo/95 backdrop-blur
                   lg:static lg:mt-6 lg:rounded-lg lg:border lg:bg-lienzo lg:backdrop-blur-none"
      >
        <div
          className="mx-auto flex max-w-6xl flex-col gap-2 px-5 pt-3
                     pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8
                     lg:flex-row lg:items-center lg:justify-between lg:py-4"
        >
          <div className="order-2 lg:order-1">
            <p className="text-menudo">
              <span className="font-semibold">
                {piezas.length - pendientes.length} de {piezas.length}
              </span>{" "}
              <span className="text-apagado">resueltas</span>
              {guardadoHace && <span className="text-apagado"> · {guardadoHace}</span>}
            </p>
            <p className="text-micro text-apagado">
              Plazo {entrega.plazoDias} días · {plazoEnPalabras(entrega.vence)}
            </p>
          </div>

          <div className="order-1 w-full lg:order-2 lg:w-auto">
            <Boton ancho disabled={!hayAlgoQueEnviar} onClick={() => setConfirmando(true)}>
              Enviar revisión a la agencia
            </Boton>
          </div>
        </div>
      </div>

      {confirmando && (
        <Confirmacion
          proyecto={entrega.proyecto}
          aprobadas={aprobadas.map((p) => p.nombre)}
          conCambios={conCambios.map((p) => ({ nombre: p.nombre, pedido: p.pedido }))}
          sinRevisar={pendientes.map((p) => p.nombre)}
          onVolver={() => setConfirmando(false)}
          onEnviar={enviarRevision}
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
 * Merece que el cliente lea qué está mandando: cuántas aprobó, qué pidió
 * cambiar y —sobre todo— si quedó alguna sin mirar.
 */
function Confirmacion({
  proyecto,
  aprobadas,
  conCambios,
  sinRevisar,
  onVolver,
  onEnviar,
}: {
  proyecto: string;
  aprobadas: string[];
  conCambios: Array<{ nombre: string; pedido: string }>;
  sinRevisar: string[];
  onVolver: () => void;
  onEnviar: () => void;
}) {
  // Cerrar con Escape es lo que espera cualquiera que use teclado.
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => e.key === "Escape" && onVolver();
    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [onVolver]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-0 sm:items-center sm:p-6"
      onClick={onVolver}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-confirmacion"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-lienzo
                   pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-xl sm:pb-5"
      >
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <h2 id="titulo-confirmacion" className="text-titulo font-semibold tracking-tight">
            Antes de enviar
          </h2>
          <p className="mt-1 text-menudo text-apagado">{proyecto}</p>

          <div className="mt-5 space-y-5">
            {aprobadas.length > 0 && (
              <section>
                <h3 className="text-micro uppercase tracking-widest text-listo">
                  Aprobadas · {aprobadas.length}
                </h3>
                <ul className="mt-2 space-y-1">
                  {aprobadas.map((n) => (
                    <li key={n} className="text-normal">
                      {n}
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
                <ul className="mt-2 space-y-3">
                  {conCambios.map((p) => (
                    <li key={p.nombre}>
                      <p className="text-normal font-semibold">{p.nombre}</p>
                      <p className="mt-0.5 text-menudo text-tinta-suave">
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
              <section className="rounded-md bg-espera-tenue px-4 py-3">
                <h3 className="text-micro uppercase tracking-widest text-espera">
                  Sin revisar · {sinRevisar.length}
                </h3>
                <ul className="mt-2 space-y-1">
                  {sinRevisar.map((n) => (
                    <li key={n} className="text-menudo text-tinta-suave">
                      {n}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-menudo text-espera">
                  Estas quedan esperándote. Podés volver más tarde y resolverlas.
                </p>
              </section>
            )}
          </div>

          <p className="mt-6 text-menudo text-apagado">
            Al enviar, el equipo recibe la devolución completa y empieza a trabajar sobre
            los cambios.
          </p>
        </div>

        <div className="sticky bottom-0 mt-6 flex flex-col gap-2 border-t border-linea-tenue bg-lienzo px-5 pt-4 sm:flex-row-reverse sm:px-6">
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
