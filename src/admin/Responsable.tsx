"use client";

// Quién lleva algo.
//
// El mismo control sirve para el cliente, para una carpeta y para un archivo.
// Lo único que cambia es a qué nivel se guarda, y eso decide qué se lleva
// puesto: lo de arriba deja heredando a todo lo de abajo.
//
// Dice si está puesto acá o heredado. Sin eso, ver «Nari» no distingue entre
// «alguien la puso en esta carpeta» y «la lleva porque lleva el cliente».

import { useState, useTransition } from "react";
import { guardarResponsable } from "@/app/(admin)/gestion/acciones";
import type { Persona } from "@/lib/equipo";

export function Responsable({
  nivel,
  id,
  carpetaId,
  quien,
  propio,
  equipo,
  alGuardar,
}: {
  nivel: "cliente" | "carpeta" | "archivo";
  id: string;
  /** Solo para un archivo: su carpeta, para poder comprobarlo. */
  carpetaId?: string;
  /** Quién lleva esto, ya heredado. */
  quien: string | null;
  /** Está puesto acá, no heredado de arriba. */
  propio: boolean;
  equipo: Persona[];
  alGuardar?: () => void;
}) {
  const [guardando, guardar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cambiar(personaId: string) {
    guardar(async () => {
      const r = await guardarResponsable(nivel, id, personaId, carpetaId);
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
        value={quien ?? ""}
        disabled={guardando}
        onChange={(e) => cambiar(e.target.value)}
        aria-label="Quién lo lleva"
        className="min-h-toque border border-linea bg-lienzo px-2 text-menudo font-bold
                   focus:border-acento focus:outline-none disabled:opacity-40"
      >
        <option value="">sin asignar</option>
        {equipo.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.nombre}
          </option>
        ))}
      </select>

      {!propio && quien !== null && (
        <span className="text-micro font-extrabold uppercase tracking-wider text-apagado">
          heredado
        </span>
      )}

      {equipo.length === 0 && (
        <span className="text-menudo text-espera">Cargá gente en «Equipo».</span>
      )}

      {error && <span className="text-menudo font-semibold text-alerta">{error}</span>}
    </div>
  );
}
