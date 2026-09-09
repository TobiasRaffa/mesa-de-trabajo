"use client";

// La parte de la pantalla que responde a los clics.
//
// Lo importante: **usa la máquina de estados de verdad**. Cuando el cliente
// aprueba una pieza, acá se llama a la misma función `aplicar()` que va a
// correr en el servidor el día que esto guarde de verdad. Si una regla del
// dominio cambia, esta pantalla cambia con ella sin tocarla.
//
// Lo único que falta es la parte de abajo: todavía no se guarda nada. Al
// recargar la página vuelve todo al principio. Eso se resuelve cuando exista
// la base de datos, y no cambia nada de lo que se ve acá.

import { useState } from "react";
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
  /** Lo que el cliente escribió al pedir cambios, si escribió algo. */
  pedido: string;
};

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
  const [cerrada, setCerrada] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);

  function mover(id: string, evento: Evento) {
    setRechazo(null);
    setPiezas((antes) =>
      antes.map((pieza) => {
        if (pieza.id !== id) return pieza;

        const resultado = aplicar(pieza, evento);
        if (!resultado.ok) {
          // La máquina de estados explica por qué no se puede. Se lo mostramos
          // en vez de que el botón simplemente no haga nada.
          setRechazo(resultado.motivo);
          return pieza;
        }
        return { ...pieza, ...resultado.pieza };
      })
    );
  }

  const pendientes = piezas.filter(
    (p) => p.estado === "entregada" || p.estado === "en_revision"
  ).length;
  const aprobadas = piezas.filter((p) => p.estado === "final").length;
  const conCambios = piezas.filter((p) => p.estado === "cambios_marcados").length;

  function cerrarRevision() {
    setPiezas((antes) =>
      antes.map((pieza) => {
        const r = aplicar(pieza, { tipo: "cerrar_revision" });
        return r.ok ? { ...pieza, ...r.pieza } : pieza;
      })
    );
    setCerrada(true);
  }

  if (cerrada) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-titulo font-semibold">Listo, gracias</h2>
        <p className="mx-auto mt-3 max-w-prose text-tinta-suave">
          {aprobadas > 0 && `${aprobadas} ${aprobadas === 1 ? "pieza aprobada" : "piezas aprobadas"}`}
          {aprobadas > 0 && conCambios > 0 && " y "}
          {conCambios > 0 &&
            `${conCambios} ${conCambios === 1 ? "con cambios" : "con cambios"}`}
          . Ya le avisamos al equipo.
        </p>
        <p className="mt-8 text-menudo text-apagado">
          Esto es una prueba: al recargar la página vuelve todo al principio.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="grid gap-x-8 gap-y-10 py-8 md:grid-cols-2 lg:grid-cols-3">
        {piezas.map((pieza) => (
          <li key={pieza.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-guia font-semibold leading-snug">{pieza.nombre}</h2>
              <Estado estado={pieza.estado} />
            </div>

            {/* El nombre queda de fondo: si la miniatura no carga, se ve el
                nombre en lugar de un ícono roto. Sin JavaScript. */}
            <div className="relative mt-3 grid aspect-[4/5] place-items-center overflow-hidden rounded-lg border border-linea bg-hueco">
              <span className="px-4 text-center text-micro text-apagado">{pieza.nombre}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/miniatura/${pieza.driveFileId}?px=800&v=${encodeURIComponent(
                  pieza.modificado ?? ""
                )}`}
                alt={pieza.nombre}
                className="absolute inset-0 h-full w-full bg-hueco object-cover"
              />
            </div>

            <div className="mt-3">
              <Seguimiento
                ronda={pieza.ronda}
                rondasIncluidas={pieza.rondasIncluidas}
                rondasExtra={pieza.rondasExtra}
                aprobada={pieza.estado === "final"}
              />
            </div>

            <div className="mt-4 pt-1">
              {pieza.estado === "final" && (
                <p className="text-menudo text-listo">Aprobada. Ya podemos avanzar.</p>
              )}

              {pieza.estado === "cambios_marcados" && (
                <div>
                  <textarea
                    value={pieza.pedido}
                    onChange={(e) =>
                      setPiezas((antes) =>
                        antes.map((p) =>
                          p.id === pieza.id ? { ...p, pedido: e.target.value } : p
                        )
                      )
                    }
                    rows={3}
                    placeholder="¿Qué habría que cambiar?"
                    className="w-full rounded-md border border-linea bg-lienzo p-3 text-normal
                               placeholder:text-apagado focus:border-acento focus:outline-none"
                  />
                  <p className="mt-1 text-micro text-apagado">
                    Llega cuando cierres la revisión, junto con el resto.
                  </p>
                </div>
              )}

              {(pieza.estado === "entregada" || pieza.estado === "en_revision") && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Boton
                    variante="aprobar"
                    ancho
                    onClick={() => mover(pieza.id, { tipo: "aprobar", por: "cliente" })}
                  >
                    Está bien así
                  </Boton>
                  <Boton
                    variante="secundario"
                    ancho
                    onClick={() => mover(pieza.id, { tipo: "pedir_cambios" })}
                  >
                    Pedir cambios
                  </Boton>
                </div>
              )}

              {pieza.estado === "extra_pedida" && (
                <p className="text-menudo text-tinta-suave">
                  Le pedimos al equipo una revisión adicional. Te avisamos cuando la
                  habiliten.
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {rechazo && (
        <p className="mb-6 rounded-md bg-espera-tenue px-4 py-3 text-menudo text-espera">
          {rechazo}
        </p>
      )}

      {/*
        En el teléfono va fijo abajo, al alcance del pulgar, respetando la barra
        de gestos. En la computadora se apoya al final de la página.
      */}
      <div
        className="fixed inset-x-0 bottom-0 border-t border-linea bg-lienzo/95 backdrop-blur
                   lg:static lg:mt-4 lg:rounded-lg lg:border lg:bg-lienzo lg:backdrop-blur-none"
      >
        <div
          className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 pt-3
                     pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8
                     lg:flex-row lg:justify-between lg:py-4"
        >
          <p className="order-2 text-micro text-apagado lg:order-1">
            Plazo {entrega.plazoDias} días · {plazoEnPalabras(entrega.vence)}
          </p>
          <div className="order-1 w-full lg:order-2 lg:w-auto">
            <Boton ancho disabled={pendientes > 0} onClick={cerrarRevision}>
              {pendientes > 0
                ? `Faltan ${pendientes} de ${piezas.length}`
                : "Terminé la revisión"}
            </Boton>
          </div>
        </div>
      </div>
    </>
  );
}
