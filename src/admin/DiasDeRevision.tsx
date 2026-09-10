"use client";

// Cuántos días tiene el cliente para revisar.
//
// El mismo control sirve para el cliente, para una carpeta y para un archivo.
// Lo único que cambia es a qué nivel se guarda, y eso decide **qué se lleva
// puesto**: lo de arriba deja heredando a todo lo de abajo.
//
// **No se guarda al elegir.** Elegir del desplegable y que eso ya borre el
// plazo de doce archivos es demasiado para un movimiento del mouse: aparece
// Guardar, y hasta apretarlo no pasa nada.
//
// Dice si el número es propio o heredado. Sin eso, un «3» no distingue entre
// «alguien eligió tres» y «nadie eligió nada».

import { useState, useTransition } from "react";
import { guardarDiasDeRevision } from "@/app/(admin)/gestion/acciones";
import { DIAS_POSIBLES } from "@/lib/dias";
import { CAMPO, ETIQUETA, GUARDAR } from "@/admin/estilos";

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
  const [elegidos, setElegidos] = useState(dias);
  const [guardando, guardar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cambio = elegidos !== dias;

  function confirmar() {
    guardar(async () => {
      const r = await guardarDiasDeRevision(nivel, id, elegidos, carpetaId);
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
        value={elegidos}
        disabled={guardando}
        onChange={(e) => setElegidos(Number(e.target.value))}
        aria-label="Días para revisar"
        className={CAMPO}
      >
        {DIAS_POSIBLES.map((d) => (
          <option key={d} value={d}>
            {d} {d === 1 ? "día" : "días"}
          </option>
        ))}
      </select>

      {cambio ? (
        <button type="button" onClick={confirmar} disabled={guardando} className={GUARDAR}>
          {guardando ? "…" : "Guardar"}
        </button>
      ) : (
        !propio && <span className={ETIQUETA}>heredado</span>
      )}

      {error && <span className="text-menudo font-semibold text-alerta">{error}</span>}
    </div>
  );
}
