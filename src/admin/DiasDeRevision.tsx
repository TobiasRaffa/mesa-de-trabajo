"use client";

// Cuántos días tiene el cliente para revisar.
//
// El mismo control sirve para el cliente, para una carpeta y para un archivo.
// Lo único que cambia es a qué nivel se guarda, y eso decide **qué se lleva
// puesto**: lo de arriba borra lo de abajo, para que no queden valores viejos
// escondidos que nadie sepa de dónde salieron.
//
// Dice si el número es propio o heredado. Sin eso, un «3» no distingue entre
// «alguien eligió tres» y «nadie eligió nada».

import { useState, useTransition } from "react";
import { guardarDiasDeRevision } from "@/app/(admin)/gestion/acciones";
import { DIAS_POSIBLES } from "@/lib/dias";

export function DiasDeRevision({
  nivel,
  id,
  carpetaId,
  dias,
  propio,
  alGuardar,
}: {
  nivel: "cliente" | "carpeta" | "archivo";
  id: string;
  /** Solo para un archivo: su carpeta, para poder comprobarlo. */
  carpetaId?: string;
  dias: number;
  /** El número está puesto acá, no heredado de arriba. */
  propio: boolean;
  alGuardar?: () => void;
}) {
  const [guardando, guardar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cambiar(nuevos: number) {
    guardar(async () => {
      const r = await guardarDiasDeRevision(nivel, id, nuevos, carpetaId);
      if (r.ok) {
        setError(null);
        alGuardar?.();
      } else {
        setError(r.motivo);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={dias}
        disabled={guardando}
        onChange={(e) => cambiar(Number(e.target.value))}
        aria-label="Días para revisar"
        className="min-h-toque border border-linea bg-lienzo px-2 text-menudo font-bold
                   focus:border-acento focus:outline-none disabled:opacity-40"
      >
        {DIAS_POSIBLES.map((d) => (
          <option key={d} value={d}>
            {d} {d === 1 ? "día" : "días"}
          </option>
        ))}
      </select>

      {!propio && (
        <span className="text-micro font-extrabold uppercase tracking-wider text-apagado">
          heredado
        </span>
      )}

      {error && <span className="text-menudo font-semibold text-alerta">{error}</span>}
    </div>
  );
}
