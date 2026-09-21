"use client";

// Cuando una pantalla de gestión se cae por algo que no es Drive.
//
// Las lecturas de Drive ya están envueltas y cuentan lo suyo, pero todo lo
// demás —leer los avisos, el equipo, las claves— caía en la pantalla roja que
// trae Next, en inglés y sin forma de volver. Acá queda el mismo marco de
// siempre, con el motivo a la vista: esta pantalla la ve la agencia, que es
// quien puede arreglarlo.

import { useEffect } from "react";
import { PANTALLA } from "@/admin/EncabezadoDePagina";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Al registro del servidor, que es donde se mira después.
    console.error(error);
  }, [error]);

  return (
    <main className={PANTALLA}>
      <h1 className="text-grande font-extrabold tracking-tight">Algo se rompió</h1>
      <p className="mt-4 border-l-4 border-alerta bg-alerta-tenue px-4 py-3 font-mono text-menudo text-alerta">
        {error.message || "Error desconocido"}
        {error.digest && ` · ${error.digest}`}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-toque items-center rounded-full border-2 border-tinta px-6
                   text-normal font-bold tracking-tight text-tinta transition-colors hover:bg-hueco"
      >
        Reintentar
      </button>
    </main>
  );
}
