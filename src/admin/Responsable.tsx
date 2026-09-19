"use client";

// Quién lleva algo.
//
// El mismo control sirve para el cliente, para una carpeta y para un archivo.
// Lo único que cambia es a qué nivel se guarda, y eso decide qué se lleva
// puesto: lo de arriba deja heredando a todo lo de abajo.
//
// **No se guarda al elegir**, por lo mismo que los días: cambiar el
// responsable de un cliente reasigna todas sus carpetas, y eso no puede pasar
// por rozar un desplegable.
//
// Dice si está puesto acá o heredado. Sin eso, ver «Nari» no distingue entre
// «alguien la puso en esta carpeta» y «la lleva porque lleva el cliente».

import { useState, useTransition } from "react";
import { guardarResponsable } from "@/app/(admin)/gestion/acciones";
import type { Persona } from "@/lib/equipo";
import { CAMPO, GUARDAR } from "@/admin/estilos";

export function Responsable({
  nivel,
  id,
  carpetaId,
  quien,
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
  const [elegido, setElegido] = useState(quien ?? "");
  const [guardando, guardar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cambio = elegido !== (quien ?? "");

  function confirmar() {
    guardar(async () => {
      const r = await guardarResponsable(nivel, id, elegido, carpetaId);
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
        value={elegido}
        disabled={guardando}
        onChange={(e) => setElegido(e.target.value)}
        aria-label="Quién lo lleva"
        className={CAMPO}
      >
        <option value="">sin asignar</option>
        {equipo.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.nombre}
          </option>
        ))}
      </select>

      {cambio ? (
        <button type="button" onClick={confirmar} disabled={guardando} className={GUARDAR}>
          {guardando ? "…" : "Guardar"}
        </button>
      ) : null}

      {equipo.length === 0 && (
        <span className="text-menudo text-espera">Cargá gente en «Equipo».</span>
      )}

      {error && <span className="text-menudo font-semibold text-alerta">{error}</span>}
    </div>
  );
}
