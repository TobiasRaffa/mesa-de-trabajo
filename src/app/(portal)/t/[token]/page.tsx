// La entrega, como la ve el cliente.
//
// Una sola pantalla que funciona en las dos partes: en la computadora las
// piezas se acomodan en columnas y las acciones van dentro de cada una; en el
// teléfono se apilan y el botón de cerrar queda fijo abajo, donde llega el
// pulgar. No son dos diseños: es el mismo, que se reacomoda.
//
// Todavía muestra datos de ejemplo: falta la base de datos para saber a qué
// entrega apunta el token y para pedir el tag. La ruta, la forma y el
// comportamiento son los definitivos.

import { Boton } from "@/ui/Boton";
import { Estado } from "@/ui/Estado";
import { Seguimiento } from "@/ui/Seguimiento";
import { plazoEnPalabras } from "@/lib/fechas";
import { entregaDeEjemplo } from "@/portal/datos/ejemplo";

export const dynamic = "force-dynamic";

export default async function Entrega() {
  const entrega = await entregaDeEjemplo();

  const pendientes = entrega.piezas.filter(
    (p) => p.estado === "entregada" || p.estado === "en_revision"
  ).length;
  const resueltas = entrega.piezas.length - pendientes;
  const listo = pendientes === 0;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-32 sm:px-8 lg:pb-16">
      {/* Encabezado. El plazo no aparece acá: va al pie, en chico. */}
      <header className="border-b border-linea-tenue py-6 lg:py-10">
        <p className="text-micro uppercase tracking-widest text-apagado">{entrega.cliente}</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="text-titulo font-semibold tracking-tight lg:text-grande">
            {entrega.proyecto}
          </h1>
          <p className="text-menudo text-tinta-suave">
            {entrega.piezas.length} piezas
            {resueltas > 0 && (
              <span className="text-apagado"> · {resueltas} resueltas</span>
            )}
          </p>
        </div>
      </header>

      <ul className="grid gap-x-8 gap-y-10 py-8 md:grid-cols-2 lg:grid-cols-3">
        {entrega.piezas.map((pieza) => (
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
                rondasIncluidas={entrega.rondasIncluidas}
                rondasExtra={entrega.rondasExtra}
                aprobada={pieza.estado === "final"}
              />
            </div>

            {/* mt-auto empuja las acciones al pie de la tarjeta, así todas
                quedan alineadas aunque los nombres tengan distinto largo. */}
            <div className="mt-4 pt-1">
              {pieza.estado === "final" ? (
                <p className="text-menudo text-listo">Aprobada. Ya podemos avanzar.</p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Boton variante="aprobar" ancho>
                    Está bien así
                  </Boton>
                  <Boton variante="secundario" ancho>
                    Pedir cambios
                  </Boton>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {entrega.comentarios.length > 0 && (
        <section className="border-t border-linea-tenue py-8">
          <h2 className="text-micro uppercase tracking-widest text-apagado">
            Lo que anotaron hasta ahora
          </h2>
          <ul className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
            {entrega.comentarios.map((c, i) => (
              <li key={i}>
                <p className="text-menudo font-semibold">
                  {c.quien} <span className="font-normal text-apagado">· {c.cuando}</span>
                </p>
                <p className="mt-0.5 text-normal text-tinta-suave">{c.texto}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-prose text-menudo text-apagado">
            Los cambios que pidas llegan todos juntos cuando cierres la revisión. Lo que
            apruebes queda listo enseguida.
          </p>
        </section>
      )}

      {/*
        En el teléfono va fijo abajo, al alcance del pulgar, respetando la barra
        de gestos. En la computadora deja de estar fijo y se apoya al final de
        la página, donde termina la lectura.
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
            <Boton ancho disabled={!listo}>
              {listo
                ? "Terminé la revisión"
                : `Faltan ${pendientes} de ${entrega.piezas.length}`}
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}
