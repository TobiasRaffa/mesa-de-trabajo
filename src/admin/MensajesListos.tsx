"use client";

// Los mensajes listos para copiar.
//
// La aplicación no le escribe al cliente. Esto deja el texto escrito para que
// una persona lo lea, lo cambie si quiere, lo copie y lo mande por donde ya le
// escribe siempre.
//
// Al lado va el botón para abrir la conversación del portal, que es el otro
// camino: si el cliente ya está hablando ahí, contestarle ahí es mejor que
// mandarle un WhatsApp más.

import { useState } from "react";
import { PLANTILLAS, type Datos } from "@/lib/plantillas";

export function MensajesListos({
  datos,
  alLado,
}: {
  datos: Datos;
  /** El botón para abrir la conversación, que lo pone quien nos usa. */
  alLado?: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [copiada, setCopiada] = useState<string | null>(null);
  const [texto, setTexto] = useState("");

  function abrir(id: string) {
    if (abierta === id) {
      setAbierta(null);
      return;
    }
    const plantilla = PLANTILLAS.find((p) => p.id === id);
    if (!plantilla) return;
    setAbierta(id);
    setTexto(plantilla.texto(datos));
  }

  async function copiar(id: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiada(id);
      setTimeout(() => setCopiada(null), 2000);
    } catch {
      // Sin portapapeles el texto igual está a la vista para seleccionarlo.
    }
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-titulo font-extrabold tracking-tight">Mensajes listos</h2>
        </div>
        {alLado}
      </div>

      <ul className="mt-5 flex flex-col divide-y divide-linea border-y border-linea">
        {PLANTILLAS.map((plantilla) => {
          const activa = abierta === plantilla.id;
          return (
            <li key={plantilla.id}>
              <button
                type="button"
                onClick={() => abrir(plantilla.id)}
                aria-expanded={activa}
                className="flex w-full items-center justify-between gap-4 py-3 text-left
                           transition-colors hover:bg-hueco/60"
              >
                <span className="min-w-0">
                  <span className="block font-bold tracking-tight">{plantilla.titulo}</span>
                  <span className="mt-0.5 block text-menudo text-apagado">
                    {plantilla.cuando}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-apagado">
                  {activa ? "−" : "+"}
                </span>
              </button>

              {activa && (
                <div className="pb-4">
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={6}
                    className="w-full resize-y border border-linea bg-lienzo p-3 font-mono text-menudo
                               transition-colors focus:border-acento focus:outline-none"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => copiar(plantilla.id)}
                      className="rounded-full min-h-toque bg-tinta px-4 text-normal font-bold tracking-tight
                                 text-lienzo transition-colors hover:bg-tinta/90"
                    >
                      {copiada === plantilla.id ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
