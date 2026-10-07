"use client";

// Una vuelta que espera que alguien diga de qué trabajo es.
//
// **Una V2, V3 o más no se suma sola a ningún trabajo.** El nombre sugiere
// —«V2 logo.jpg» parece de «logo»— y la opción de entrada es esa, pero decide
// una persona: «V2 logo final.jpg» también puede ser de «logo», y «Hario
// V60.jpg» no es la vuelta sesenta de nada. Lo decidido queda en la
// aplicación, por el archivo, sin tocar su nombre en Drive; desde ahí se le
// sigue el rastro aunque lo renombren.
//
// Aparece en el árbol de clientes y en la ventana del trabajo, que es donde se
// entrega: una vuelta sin asignar no se puede entregar.

import { useState } from "react";
import { asignarVueltaDeCarpeta } from "@/app/(admin)/gestion/acciones";
import type { NodoPendiente } from "@/admin/datos/arbol";

/** El valor del selector para «no es una vuelta de nada». */
const PROPIO = "__propio__";

export function VueltaSinAsignar({
  carpetaId,
  pendiente,
  trabajos,
  alAsignar,
}: {
  carpetaId: string;
  pendiente: NodoPendiente;
  /** Los trabajos de la carpeta a los que se la puede sumar. */
  trabajos: Array<{ id: string; nombre: string }>;
  alAsignar: () => void;
}) {
  const [destino, setDestino] = useState(pendiente.sugerida ?? trabajos[0]?.id ?? PROPIO);
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function asignar() {
    setYendo(true);
    setError(null);
    try {
      const r = await asignarVueltaDeCarpeta(
        carpetaId,
        pendiente.id,
        destino === PROPIO ? null : destino
      );
      if (r.ok) alAsignar();
      else setError(r.motivo);
    } catch {
      setError("No pude guardarlo.");
    } finally {
      setYendo(false);
    }
  }

  return (
    <div className="min-w-0">
      <span className="block max-w-full truncate text-normal font-bold tracking-tight">
        {pendiente.nombre}
      </span>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="bg-alerta-tenue px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-alerta">
          sin asignar
        </span>
        <span className="text-micro text-apagado">v{pendiente.numero}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`destino-${pendiente.id}`}>
          De qué trabajo es
        </label>
        <select
          id={`destino-${pendiente.id}`}
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          disabled={yendo}
          className="min-h-toque max-w-full rounded-full border-2 border-linea bg-lienzo px-3
                     text-menudo font-semibold text-tinta"
        >
          {trabajos.map((t) => (
            <option key={t.id} value={t.id}>
              V{pendiente.numero} de «{t.nombre}»
            </option>
          ))}
          <option value={PROPIO}>No es una vuelta: es un trabajo nuevo</option>
        </select>
        <button
          type="button"
          onClick={asignar}
          disabled={yendo}
          className="rounded-full min-h-toque bg-alerta px-3 text-menudo font-bold tracking-tight
                     text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {yendo ? "Guardando…" : "Asignar"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-menudo font-semibold text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}
