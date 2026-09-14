"use client";

// El tablero: tres canchas, y en cada una los clientes cerrados.
//
// **Cada cliente está en una sola columna**, la de lo más urgente que tenga.
// Estuvo un rato repartido —el mismo cliente aparecía en dos columnas, una por
// cada clase de trabajo que tuviera— y era información de más: para saber cómo
// venía alguien había que buscarlo en tres lados y sumar. Lo que importa de un
// cliente es lo más urgente que tiene; el resto se ve abriéndolo.
//
// Y abriéndolo se ven **los trabajos por su nombre**, cada uno con su propio
// estado. Así se sabe que hay dos, cuáles son, y en qué anda cada uno sin
// tener que ir a otra pantalla.
//
// Tres formas de mirar, de menos a más:
//
//   · **Cerrado**: el cliente y cuántos trabajos tiene.
//   · **Abierto**: los nombres, con el estado de cada uno.
//   · **Tocando uno**: el resumen entero, con sus piezas.
//
// El orden de las columnas es el de la urgencia: primero lo nuestro, que es lo
// único sobre lo que se puede hacer algo ahora.

import { useState } from "react";
import { Plegable } from "@/admin/Plegable";
import { ResumenDeTrabajo } from "@/admin/ResumenDeTrabajo";
import type { Cancha, CarpetaEnElTablero } from "@/admin/datos/tablero";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

const CANCHAS: Record<
  Cancha,
  { titulo: string; explica: string; filo: string; punto: string; comoEsta: string }
> = {
  agencia: {
    titulo: "Lo tenemos nosotros",
    explica: "El cliente ya habló. Falta hacerlo.",
    filo: "border-acento",
    punto: "bg-acento",
    comoEsta: "Falta hacerlo",
  },
  cliente: {
    titulo: "Lo tiene el cliente",
    explica: "Se lo entregamos y todavía no decidió.",
    filo: "border-espera-borde",
    punto: "bg-espera-borde",
    comoEsta: "Esperando al cliente",
  },
  listo: {
    titulo: "Terminado",
    explica: "No queda nada esperando de ningún lado.",
    filo: "border-linea",
    punto: "bg-tinta-suave",
    comoEsta: "Terminado",
  },
};

/** De más urgente a menos. Un cliente va a la cancha de lo peor que tenga. */
const ORDEN: Cancha[] = ["agencia", "cliente", "listo"];

type PorCliente = {
  clienteId: string;
  cliente: string;
  carpetas: CarpetaEnElTablero[];
  /** Dónde se muestra: la cancha más urgente de sus trabajos. */
  cancha: Cancha;
};

function porCliente(carpetas: CarpetaEnElTablero[]): PorCliente[] {
  const salida: PorCliente[] = [];

  for (const carpeta of carpetas) {
    const suyo = salida.find((c) => c.clienteId === carpeta.clienteId);
    if (suyo) suyo.carpetas.push(carpeta);
    else
      salida.push({
        clienteId: carpeta.clienteId,
        cliente: carpeta.cliente,
        carpetas: [carpeta],
        cancha: "listo",
      });
  }

  for (const cliente of salida) {
    // La peor de las que tenga: el índice más chico de ORDEN.
    cliente.cancha = ORDEN[
      Math.min(...cliente.carpetas.map((c) => ORDEN.indexOf(c.cancha)))
    ];
    // Y adentro, primero lo más urgente también.
    cliente.carpetas.sort(
      (a, b) => ORDEN.indexOf(a.cancha) - ORDEN.indexOf(b.cancha)
    );
  }

  return salida;
}

export function TableroPorCliente({ carpetas }: { carpetas: CarpetaEnElTablero[] }) {
  // Cuál se está mirando en grande. Vive acá arriba y no en cada ficha: la
  // ventana tapa la pantalla entera, así que solo puede haber una.
  const [mirando, setMirando] = useState<CarpetaEnElTablero | null>(null);

  if (carpetas.length === 0) {
    return (
      <p className="mt-8 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-normal text-espera">
        No hay carpetas de trabajo en ningún cliente habilitado.
      </p>
    );
  }

  const clientes = porCliente(carpetas);

  return (
    <>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {ORDEN.map((cual) => (
          <Columna
            key={cual}
            cual={cual}
            clientes={clientes.filter((c) => c.cancha === cual)}
            onMirar={setMirando}
          />
        ))}
      </div>

      {mirando && (
        <ResumenDeTrabajo carpeta={mirando} onCerrar={() => setMirando(null)} />
      )}
    </>
  );
}

function Columna({
  cual,
  clientes,
  onMirar,
}: {
  cual: Cancha;
  clientes: PorCliente[];
  onMirar: (c: CarpetaEnElTablero) => void;
}) {
  const { titulo, explica, filo } = CANCHAS[cual];

  return (
    // `min-w-0` para que un nombre largo no ensanche la columna y saque la
    // página de ancho. Ya pasó en el portal.
    <section className={`min-w-0 border-t-4 pt-4 ${filo}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-guia font-extrabold tracking-tight">{titulo}</h2>
        <span className="cifras text-titulo font-extrabold leading-none tracking-tighter text-apagado">
          {clientes.length}
        </span>
      </div>
      <p className="mt-0.5 text-micro text-apagado">{explica}</p>

      {clientes.length === 0 ? (
        <p className="mt-4 text-menudo text-apagado">Nada por acá.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {clientes.map((c) => (
            <li key={c.clienteId} className="border border-linea bg-lienzo px-3 py-2">
              <Plegable
                recuerdo={`tablero-${c.clienteId}`}
                titulo={<span className="text-normal">{c.cliente}</span>}
                resumen={`${c.carpetas.length} ${
                  c.carpetas.length === 1 ? "trabajo" : "trabajos"
                }`}
              >
                <ul className="mt-2 flex flex-col">
                  {c.carpetas.map((carpeta) => (
                    <Trabajo key={carpeta.carpetaId} carpeta={carpeta} onMirar={onMirar} />
                  ))}
                </ul>
              </Plegable>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Un trabajo: el nombre, y el resto al pasar por encima.
 *
 * El renglón dice lo mínimo —cómo se llama y de quién es la pelota— y el
 * detalle aparece al apoyar el mouse o al llegar con el teclado. Meterlo todo
 * en el renglón vuelve la columna un párrafo; esconderlo del todo obliga a
 * abrir una ventana para saber si vale la pena abrirla.
 *
 * El toque abre el resumen entero. En un teléfono no hay «pasar por encima»,
 * así que ese es el único camino y tiene que llevar a todo.
 */
function Trabajo({
  carpeta: c,
  onMirar,
}: {
  carpeta: CarpetaEnElTablero;
  onMirar: (c: CarpetaEnElTablero) => void;
}) {
  const cancha = CANCHAS[c.cancha];
  const cerradas = Math.max(0, c.piezas - c.enAgencia - c.sinRevisar);

  return (
    <li className="group relative border-t border-linea-tenue">
      <button
        type="button"
        onClick={() => onMirar(c)}
        className="flex w-full items-center gap-2 py-2 text-left transition-colors
                   hover:text-acento focus-visible:outline-2 focus-visible:outline-acento"
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${cancha.punto}`}
        />
        <span className="min-w-0 flex-1 truncate font-bold tracking-tight">
          {c.carpeta}
        </span>
        {c.vencida && (
          <span className="shrink-0 text-micro font-extrabold uppercase tracking-wider text-alerta">
            vencido
          </span>
        )}
      </button>

      {/*
        La vista rápida. Aparece al apoyar el mouse o al llegar con el teclado,
        y no se puede tocar: es para mirar, no para usar. Por eso
        `pointer-events-none`, que además evita que tape el renglón de abajo.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-4 right-0 top-full z-20 hidden
                   border-2 border-tinta bg-lienzo px-3 py-2 shadow-lg
                   group-hover:block group-focus-within:block"
      >
        <p className="flex flex-wrap items-baseline gap-x-2 text-micro">
          <span className="font-extrabold uppercase tracking-widest text-apagado">
            {cancha.comoEsta}
          </span>
          <span className="text-apagado">
            {c.asignadaA ?? "sin asignar"}
            {c.vence && (
              <span className={c.vencida ? "font-extrabold text-alerta" : ""}>
                {" · "}
                {c.vencida ? "venció el" : "vence el"} {fecha.format(c.vence)}
              </span>
            )}
          </span>
        </p>

        {c.piezas > 0 && (
          <div className="mt-1.5 flex h-1.5 overflow-hidden bg-hueco">
            {c.enAgencia > 0 && (
              <span
                className="bg-acento"
                style={{ width: `${(c.enAgencia / c.piezas) * 100}%` }}
              />
            )}
            {c.sinRevisar > 0 && (
              <span
                className="bg-espera-borde"
                style={{ width: `${(c.sinRevisar / c.piezas) * 100}%` }}
              />
            )}
            {cerradas > 0 && (
              <span
                className="bg-tinta-suave"
                style={{ width: `${(cerradas / c.piezas) * 100}%` }}
              />
            )}
          </div>
        )}

        <p className="mt-1.5 text-micro text-apagado">
          {c.piezas} {c.piezas === 1 ? "pieza" : "piezas"}
          {c.sinEntregar > 0 && (
            <span className="font-bold text-acento"> · {c.sinEntregar} sin entregar</span>
          )}
          {c.sinRevisar > 0 && ` · ${c.sinRevisar} sin revisar`}
          {c.sinLeer > 0 && (
            <span className="font-bold text-acento"> · {c.sinLeer} sin leer</span>
          )}
        </p>
      </div>
    </li>
  );
}
