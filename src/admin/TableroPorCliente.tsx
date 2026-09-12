"use client";

// El tablero: cómo viene todo, sin tener que leer.
//
// **Por cliente, y adentro por carpeta.** Estuvo un tiempo armado en tres
// columnas por cancha —lo nuestro, lo del cliente, lo terminado— y eso contesta
// bien «qué tengo que mover yo», pero obliga a recorrer las tres columnas para
// contestar «cómo viene Café Otoño», que es la otra pregunta que se hace todo
// el tiempo. Cerrado por cliente contesta las dos: el renglón de cada uno dice
// cuánto hay de cada lado, y se abre solo el que interesa.
//
// La cancha no se perdió: es el color de cada número. Verde es nuestro, ámbar
// es del cliente, gris es cerrado. Los mismos tres en el renglón del cliente,
// en el de cada carpeta y en la barra, así se aprenden una vez.
//
// Arranca todo cerrado a propósito. Una pantalla con todo desplegado obliga a
// leer para encontrar, y lo que se busca casi siempre es una cosa.

import Link from "next/link";
import { Plegable } from "@/admin/Plegable";
import type { CarpetaEnElTablero } from "@/admin/datos/tablero";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

type PorCliente = {
  clienteId: string;
  cliente: string;
  carpetas: CarpetaEnElTablero[];
};

/** Agrupa las carpetas por cliente, conservando el orden en que llegaron. */
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

const suma = (carpetas: CarpetaEnElTablero[], que: (c: CarpetaEnElTablero) => number) =>
  carpetas.reduce((total, c) => total + que(c), 0);

export function TableroPorCliente({ carpetas }: { carpetas: CarpetaEnElTablero[] }) {
  const clientes = porCliente(carpetas);

  if (clientes.length === 0) {
    return (
      <p className="mt-8 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-normal text-espera">
        No hay carpetas de trabajo en ningún cliente habilitado.
      </p>
    );
  }

  return (
    <ul className="mt-8 flex flex-col gap-1">
      {clientes.map((c) => (
        <li key={c.clienteId} className="border-b border-linea pb-3">
          <Plegable
            recuerdo={`tablero-${c.clienteId}`}
            titulo={c.cliente}
            resumen={<Cuentas carpetas={c.carpetas} />}
            alLado={
              <Link
                href={`/gestion/cliente/${c.clienteId}`}
                className="shrink-0 text-micro font-extrabold uppercase tracking-wider
                           text-apagado transition-colors hover:text-tinta"
              >
                Abrir
              </Link>
            }
          >
            <ul className="mt-2 flex flex-col gap-2 pl-8">
              {c.carpetas.map((carpeta) => (
                <Carpeta key={carpeta.carpetaId} carpeta={carpeta} />
              ))}
            </ul>
          </Plegable>
        </li>
      ))}
    </ul>
  );
}

/**
 * Cuánto hay de cada lado, en tres números.
 *
 * Es lo que evita tener que abrir: si dice «2 para hacer» ya se sabe que ahí
 * hay trabajo, y si no dice nada es porque no hay nada que mover.
 */
function Cuentas({ carpetas }: { carpetas: CarpetaEnElTablero[] }) {
  const paraHacer = suma(carpetas, (c) => c.enAgencia);
  const sinEntregar = suma(carpetas, (c) => c.sinEntregar);
  const conElCliente = suma(carpetas, (c) => c.sinRevisar);
  const vencidas = carpetas.filter((c) => c.vencida).length;
  const sinLeer = suma(carpetas, (c) => c.sinLeer);

  return (
    <>
      {carpetas.length} {carpetas.length === 1 ? "trabajo" : "trabajos"}
      {paraHacer > 0 && (
        <span className="ml-2 font-bold text-acento">
          {paraHacer} para hacer
          {sinEntregar > 0 && ` (${sinEntregar} sin entregar)`}
        </span>
      )}
      {conElCliente > 0 && (
        <span className="ml-2 font-bold text-espera">{conElCliente} con el cliente</span>
      )}
      {paraHacer === 0 && conElCliente === 0 && (
        <span className="ml-2 text-apagado">al día</span>
      )}
      {vencidas > 0 && (
        <span className="ml-2 font-extrabold text-alerta">
          {vencidas} {vencidas === 1 ? "vencido" : "vencidos"}
        </span>
      )}
      {sinLeer > 0 && (
        <span className="ml-2 font-bold text-acento">{sinLeer} sin leer</span>
      )}
    </>
  );
}

function Carpeta({ carpeta: c }: { carpeta: CarpetaEnElTablero }) {
  const cerradas = Math.max(0, c.piezas - c.enAgencia - c.sinRevisar);

  return (
    <li className="border border-linea bg-lienzo px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
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

      {/* La barra dice de un vistazo cómo está repartido el trabajo. Los
          colores son los mismos que los números de arriba: no hay leyenda que
          aprender. */}
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
        {c.enAgencia > c.sinEntregar && ` · ${c.enAgencia - c.sinEntregar} para trabajar`}
        {c.sinRevisar > 0 && ` · ${c.sinRevisar} sin revisar`}
        {c.vence && (
          <span className={c.vencida ? "font-extrabold text-alerta" : ""}>
            {" · "}
            {c.vencida ? "venció el" : "vence el"} {fecha.format(c.vence)}
          </span>
        )}
      </p>
    </li>
  );
}
