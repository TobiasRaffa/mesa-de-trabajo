"use client";

// Sumar gente al equipo y editarla.
//
// Cada fila es un formulario suelto: se guarda una persona sin tocar las
// demás, y un error de una no borra lo que se estaba escribiendo en otra.

import { useActionState } from "react";
import {
  agregarAlEquipo,
  editarDelEquipo,
  quitarDelEquipo,
} from "@/app/(admin)/gestion/acciones";
import type { Persona } from "@/lib/equipo";

const CAMPO =
  "min-w-0 flex-1 border border-linea bg-lienzo px-3 py-2 text-normal transition-colors " +
  "placeholder:text-apagado focus:border-acento focus:outline-none";

const BOTON =
  "shrink-0 min-h-toque border-2 border-tinta px-4 text-normal font-bold tracking-tight " +
  "text-tinta transition-colors hover:bg-hueco disabled:opacity-40";

export function FilaDePersona({ persona }: { persona: Persona }) {
  const [estado, guardar, guardando] = useActionState(editarDelEquipo, null);
  const [estadoQuitar, quitar, quitando] = useActionState(quitarDelEquipo, null);

  return (
    <li className="border-b border-linea px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <form action={guardar} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={persona.id} />
          <input
            name="nombre"
            defaultValue={persona.nombre}
            aria-label="Nombre"
            className={CAMPO}
          />
          <input
            name="correo"
            type="email"
            defaultValue={persona.correo}
            placeholder="correo (para los avisos)"
            aria-label="Correo"
            className={CAMPO}
          />
          <button type="submit" disabled={guardando} className={BOTON}>
            Guardar
          </button>
        </form>

        <form action={quitar}>
          <input type="hidden" name="id" value={persona.id} />
          <button
            type="submit"
            disabled={quitando}
            title="Lo que tenía asignado queda sin asignar"
            className="min-h-toque px-3 text-menudo font-semibold text-apagado underline
                       underline-offset-2 transition-colors hover:text-alerta disabled:opacity-40"
          >
            Quitar
          </button>
        </form>
      </div>

      {!persona.correo && (
        <p className="mt-2 text-menudo text-espera">
          Sin correo cargado, a esta persona no le llega ningún aviso.
        </p>
      )}

      {[estado, estadoQuitar]
        .filter((r) => r && !r.ok)
        .map((r, i) => (
          <p key={i} aria-live="polite" className="mt-2 text-menudo font-semibold text-alerta">
            {r && !r.ok ? r.motivo : ""}
          </p>
        ))}
    </li>
  );
}

export function SumarPersona() {
  const [estado, sumar, sumando] = useActionState(agregarAlEquipo, null);

  return (
    <section className="mt-8 border-t-2 border-tinta pt-6">
      <h2 className="text-titulo font-extrabold tracking-tight">Sumar a alguien</h2>
      <form action={sumar} className="mt-4 flex flex-wrap items-center gap-2">
        <input name="nombre" placeholder="Nombre" aria-label="Nombre" className={CAMPO} />
        <input
          name="correo"
          type="email"
          placeholder="correo (para los avisos)"
          aria-label="Correo"
          className={CAMPO}
        />
        <button type="submit" disabled={sumando} className={BOTON}>
          Sumar
        </button>
      </form>

      {estado && !estado.ok && (
        <p aria-live="polite" className="mt-2 text-menudo font-semibold text-alerta">
          {estado.motivo}
        </p>
      )}
    </section>
  );
}
