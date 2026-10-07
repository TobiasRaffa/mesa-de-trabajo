// El encabezado de toda pantalla de gestión.
//
// **Existe porque había ocho, parecidos y no iguales.** «Clientes» era un
// título y una línea; «Tablero» tenía una cuenta a la derecha; la carpeta de
// un cliente tenía un enlace para volver arriba del título; «Admin» una bajada;
// y Notificaciones un título que plegaba. Cada uno con su margen. Ahora es uno,
// y lo que cambia entre pantallas es lo que se le pasa.
//
// Es un componente de servidor a propósito: no tiene estado, y así lo pueden
// usar las páginas sin volverse de cliente.

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * El marco de toda pantalla de gestión: el mismo ancho y el mismo margen.
 *
 * Cada pantalla tenía el suyo —3xl, 4xl, 5xl, 6xl— y el encabezado, aunque
 * fuera el mismo componente, arrancaba y terminaba en otro lugar según a dónde
 * se entrara. Igual quiere decir igual: se aplica esto en el `<main>` de todas.
 */
export const PANTALLA = "mx-auto w-full max-w-6xl px-6 py-7";

export function EncabezadoDePagina({
  volver,
  titulo,
  bajada,
  alLado,
  acciones,
}: {
  /** A dónde se vuelve, si esta pantalla está adentro de otra. */
  volver?: { href: string; texto: string };
  titulo: string;
  /** Una línea que explica de qué es la pantalla. Solo si hace falta. */
  bajada?: string;
  /** Lo que va a la derecha del título: una cuenta, la campana. */
  alLado?: ReactNode;
  /** Los botones de la pantalla entera, abajo del título. */
  acciones?: ReactNode;
}) {
  return (
    <header className="border-b-2 border-tinta pb-4">
      {volver && (
        <Link
          href={volver.href}
          className="font-mono text-micro font-bold uppercase tracking-widest text-apagado
                     transition-colors hover:text-tinta"
        >
          ← {volver.texto}
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className={`text-grande font-extrabold tracking-tight ${volver ? "mt-2" : ""}`}>
            {titulo}
          </h1>
          {bajada && <p className="mt-1.5 max-w-2xl text-menudo text-apagado">{bajada}</p>}
        </div>
        {alLado && <div className="flex shrink-0 items-center gap-4">{alLado}</div>}
      </div>

      {acciones && <div className="mt-5 flex flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}
