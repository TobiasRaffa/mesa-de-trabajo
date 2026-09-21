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
// **No dice si el número es propio o heredado, y es a propósito.** Lo decía,
// con el argumento de que un «3» no distingue entre «alguien eligió tres» y
// «nadie eligió nada». El rótulo «heredado» se sacó al rediseñar: lo que
// importa es el plazo que corre, y una etiqueta al lado de cada número era
// ruido en una pantalla que ya tiene mucho. Quedaba la propiedad declarada y
// calculada en cuatro pantallas, sin que nadie la dibujara.

import { useState, useTransition } from "react";
import { guardarDiasDeRevision } from "@/app/(admin)/gestion/acciones";
import { DIAS_POSIBLES } from "@/lib/dias";
import { CAMPO, GUARDAR } from "@/admin/estilos";

export function DiasDeRevision({
  nivel,
  id,
  carpetaId,
  dias,
  alGuardar,
}: {
  nivel: "cliente" | "carpeta" | "archivo";
  id: string;
  /** Solo para un archivo: su carpeta, para poder comprobarlo. */
  carpetaId?: string;
  dias: number;
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
      ) : null}

      {error && <span className="text-menudo font-semibold text-alerta">{error}</span>}
    </div>
  );
}
