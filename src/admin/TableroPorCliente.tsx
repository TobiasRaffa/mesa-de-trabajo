"use client";

// El tablero: tres canchas, y adentro los clientes.
//
// **Tres columnas, porque la pregunta de la mañana es de quién es el próximo
// movimiento.** Lo que está en nuestra cancha es lo único sobre lo que se puede
// hacer algo ahora; lo que está en la del cliente es normal y no es un
// problema; lo terminado está para saber que existe. Ordenado de cualquier otra
// manera, eso hay que deducirlo leyendo.
//
// **Adentro de cada columna, los clientes cerrados.** Un cliente con tres
// trabajos ocupaba tres fichas y la columna se volvía una lista larga: lo que
// se ve de un vistazo deja de verse. Cerrado es un renglón con el nombre y
// cuántos trabajos tiene **en esa cancha**; se abre el que interesa.
//
// Un cliente puede aparecer en dos columnas a la vez, y eso es información, no
// un error: quiere decir que tiene algo esperando trabajo nuestro y algo
// esperando su decisión.
//
// Los colores son los mismos en todos lados —verde es nuestro, ámbar es del
// cliente, gris es cerrado—, así se aprenden una vez.

import Link from "next/link";
import { Plegable } from "@/admin/Plegable";
import type { Cancha, CarpetaEnElTablero } from "@/admin/datos/tablero";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

const CANCHAS: Record<Cancha, { titulo: string; explica: string; filo: string }> = {
  agencia: {
    titulo: "Lo tenemos nosotros",
    explica: "El cliente ya habló. Falta hacerlo.",
    filo: "border-acento",
  },
  cliente: {
    titulo: "Lo tiene el cliente",
    explica: "Se lo entregamos y todavía no decidió.",
    filo: "border-espera-borde",
  },
  listo: {
    titulo: "Terminado",
    explica: "No queda nada esperando de ningún lado.",
    filo: "border-linea",
  },
};

/** El orden es el de la urgencia: primero lo único que se puede mover hoy. */
const ORDEN: Cancha[] = ["agencia", "cliente", "listo"];

type PorCliente = {
  clienteId: string;
  cliente: string;
  carpetas: CarpetaEnElTablero[];
};

/** Agrupa por cliente, conservando el orden en que llegaron las carpetas. */
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
      });
  }
  return salida;
}

export function TableroPorCliente({ carpetas }: { carpetas: CarpetaEnElTablero[] }) {
  if (carpetas.length === 0) {
    return (
      <p className="mt-8 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-normal text-espera">
        No hay carpetas de trabajo en ningún cliente habilitado.
      </p>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-3">
      {ORDEN.map((cual) => (
        <Columna
          key={cual}
          cual={cual}
          carpetas={carpetas.filter((c) => c.cancha === cual)}
        />
      ))}
    </div>
  );
}

function Columna({ cual, carpetas }: { cual: Cancha; carpetas: CarpetaEnElTablero[] }) {
  const { titulo, explica, filo } = CANCHAS[cual];
  const clientes = porCliente(carpetas);

  return (
    // `min-w-0` para que un nombre largo no ensanche la columna y saque la
    // página de ancho. Ya pasó en el portal.
    <section className={`min-w-0 border-t-4 pt-4 ${filo}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-guia font-extrabold tracking-tight">{titulo}</h2>
        <span className="cifras text-titulo font-extrabold leading-none tracking-tighter text-apagado">
          {carpetas.length}
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
                // El recuerdo lleva la cancha: el mismo cliente puede estar en
                // dos columnas, y abrir una no tiene por qué abrir la otra.
                recuerdo={`tablero-${cual}-${c.clienteId}`}
                titulo={<span className="text-normal">{c.cliente}</span>}
                resumen={`${c.carpetas.length} ${
                  c.carpetas.length === 1 ? "trabajo" : "trabajos"
                }`}
              >
                <ul className="mt-2 flex flex-col gap-2">
                  {c.carpetas.map((carpeta) => (
                    <Ficha key={carpeta.carpetaId} carpeta={carpeta} />
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

function Ficha({ carpeta: c }: { carpeta: CarpetaEnElTablero }) {
  // Lo cerrado es el resto: así los tres pedazos suman el total y la barra no
  // miente.
  const cerradas = Math.max(0, c.piezas - c.enAgencia - c.sinRevisar);

  return (
    <li className="border-t border-linea-tenue pt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Link
          href={`/gestion/cliente/${c.clienteId}/carpeta/${c.carpetaId}`}
          className="min-w-0 font-bold tracking-tight underline-offset-4 hover:underline"
        >
          {c.carpeta}
        </Link>
        <span
          className={`shrink-0 px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider ${
            c.asignadaA ? "bg-hueco text-tinta-suave" : "bg-espera-tenue text-espera"
          }`}
        >
          {c.asignadaA ?? "sin asignar"}
        </span>
      </div>

      {/* Cómo está repartido el trabajo, sin leer. Los colores son los de las
          columnas: no hay leyenda que aprender. */}
      {c.piezas > 0 && (
        <div
          className="mt-2 flex h-2 overflow-hidden bg-hueco"
          role="img"
          aria-label={`${c.enAgencia} para hacer, ${c.sinRevisar} esperando al cliente, ${cerradas} cerradas`}
        >
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

      <p className="mt-1.5 text-menudo text-apagado">
        {c.piezas} {c.piezas === 1 ? "pieza" : "piezas"}
        {c.sinEntregar > 0 && (
          <span className="font-bold text-acento"> · {c.sinEntregar} sin entregar</span>
        )}
        {c.sinRevisar > 0 && ` · ${c.sinRevisar} sin revisar`}
        {c.vence && (
          <span className={c.vencida ? "font-extrabold text-alerta" : ""}>
            {" · "}
            {c.vencida ? "venció el" : "vence el"} {fecha.format(c.vence)}
          </span>
        )}
      </p>

      {c.sinLeer > 0 && (
        <Link
          href="/gestion/chats"
          className="mt-1 inline-block text-micro font-extrabold text-acento underline underline-offset-4"
        >
          {c.sinLeer} sin leer
        </Link>
      )}
    </li>
  );
}
