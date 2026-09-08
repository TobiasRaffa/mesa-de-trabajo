// La entrega, como la ve el cliente en su teléfono.
//
// Todavía muestra datos de ejemplo: falta la base de datos para saber a qué
// entrega apunta el token y para pedir el tag. Pero la ruta, la forma y el
// comportamiento son los definitivos.
//
// Está pensada para el teléfono primero, porque ahí es donde va a abrirse:
// el link llega por WhatsApp. Lo de la computadora es lo que se agrega
// después, no al revés.

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
  const revisadas = entrega.piezas.length - pendientes;

  return (
    <main className="mx-auto max-w-2xl pb-40">
      {/* Encabezado: quién y qué. Sin gritar el plazo, que va al pie. */}
      <header className="border-b border-linea-tenue px-5 py-5">
        <p className="text-micro uppercase tracking-widest text-apagado">{entrega.cliente}</p>
        <h1 className="mt-1 text-titulo font-semibold tracking-tight">{entrega.proyecto}</h1>
        <p className="mt-2 text-menudo text-tinta-suave">
          {entrega.piezas.length} piezas para revisar
          {revisadas > 0 && (
            <span className="text-apagado"> · {revisadas} ya resueltas</span>
          )}
        </p>
      </header>

      <ul className="divide-y divide-linea-tenue">
        {entrega.piezas.map((pieza) => (
          <li key={pieza.id} className="px-5 py-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-guia font-semibold leading-snug">{pieza.nombre}</h2>
              <Estado estado={pieza.estado} />
            </div>

            {/* La imagen. El nombre queda de fondo: si la miniatura no carga,
                se ve el nombre en lugar de un ícono roto. */}
            <div className="relative mt-4 grid aspect-[4/5] max-w-sm place-items-center overflow-hidden rounded-lg border border-linea bg-hueco">
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

            {pieza.estado === "final" ? (
              <p className="mt-4 text-menudo text-listo">
                Aprobada. Ya podemos avanzar con esta.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Boton variante="aprobar" ancho>
                  Está bien así
                </Boton>
                <Boton variante="secundario" ancho>
                  Pedir cambios
                </Boton>
              </div>
            )}
          </li>
        ))}
      </ul>

      {entrega.comentarios.length > 0 && (
        <section className="border-t-8 border-hueco px-5 py-6">
          <h2 className="text-micro uppercase tracking-widest text-apagado">
            Lo que anotaron hasta ahora
          </h2>
          <ul className="mt-4 space-y-4">
            {entrega.comentarios.map((c, i) => (
              <li key={i}>
                <p className="text-menudo font-semibold">
                  {c.quien} <span className="font-normal text-apagado">· {c.cuando}</span>
                </p>
                <p className="mt-0.5 text-normal text-tinta-suave">{c.texto}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-menudo text-apagado">
            Los cambios que pidas llegan todos juntos cuando cierres la revisión. Lo que
            apruebes queda listo enseguida.
          </p>
        </section>
      )}

      {/* Barra fija abajo: el pulgar llega sin estirarse, y respeta la barra
          de gestos del teléfono. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-linea bg-lienzo/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Boton ancho disabled={pendientes > 0}>
            {pendientes > 0
              ? `Faltan ${pendientes} de ${entrega.piezas.length}`
              : "Terminé la revisión"}
          </Boton>
          <p className="mt-2 text-center text-micro text-apagado">
            Plazo {entrega.plazoDias} días · {plazoEnPalabras(entrega.vence)}
          </p>
        </div>
      </div>
    </main>
  );
}
