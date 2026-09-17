"use client";

// Sumar gente al equipo y editarla.
//
// Los campos no se pueden escribir de una: hay que apretar **Editar**. Una
// lista de campos abiertos invita a cambiar algo sin querer al pasar el mouse,
// y acá lo que se cambia es a dónde le llegan los avisos a alguien.
//
// Cada fila es un formulario suelto: se guarda una persona sin tocar las
// demás, y un error de una no borra lo que se estaba escribiendo en otra.

import { useActionState, useState } from "react";
import {
  agregarAlEquipo,
  editarDelEquipo,
  ponerClaveDePersona,
  quitarDelEquipo,
} from "@/app/(admin)/gestion/acciones";
import type { Persona } from "@/lib/equipo";
import { LARGO_MINIMO_DE_CLAVE } from "@/dominio/claves";

const CAMPO =
  "min-w-0 flex-1 border border-linea bg-lienzo px-3 py-2 text-normal transition-colors " +
  "placeholder:text-apagado focus:border-acento focus:outline-none";

const BOTON =
  "shrink-0 min-h-toque border-2 border-tinta px-4 text-normal font-bold tracking-tight " +
  "text-tinta transition-colors hover:bg-hueco disabled:opacity-40";

export function FilaDePersona({
  persona,
  tieneClave,
}: {
  persona: Persona;
  /** Si ya puede entrar. Sin contraseña, existe en la lista pero no entra. */
  tieneClave: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, guardar, guardando] = useActionState(editarDelEquipo, null);
  const [estadoQuitar, quitar, quitando] = useActionState(quitarDelEquipo, null);

  if (!editando) {
    return (
      <li className="flex flex-wrap items-center gap-3 border-b border-linea px-4 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold tracking-tight">{persona.nombre}</p>
          <p className="mt-0.5 text-menudo text-apagado">
            {persona.correo || "sin correo"}
            {persona.enDrive && ` · en Drive: ${persona.enDrive}`}
            {persona.avisaDeTodo && " · recibe todos los avisos"}
          </p>
          {/* **Sin contraseña existe en la lista pero no entra.** Se le puede
              asignar trabajo y le llegan los avisos, pero la puerta no la
              conoce. Decirlo acá evita el «no me deja entrar» de mañana. */}
          {!tieneClave && (
            <p className="mt-1 text-micro font-extrabold uppercase tracking-wider text-espera">
              todavía no puede entrar: ponele una contraseña
            </p>
          )}
        </div>
        <button type="button" onClick={() => setEditando(true)} className={BOTON}>
          Editar
        </button>
      </li>
    );
  }

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
            placeholder="correo"
            aria-label="Correo"
            className={CAMPO}
          />
          {/* Cómo la muestra Google cuando comenta encima de un archivo. Es lo
              que hace que sus notas en Drive no entren a la lista de cambios
              del cliente. Vacío se usa el nombre de acá al lado. */}
          <input
            name="enDrive"
            defaultValue={persona.enDrive ?? ""}
            placeholder="cómo aparece en Drive"
            aria-label="Cómo aparece en Drive"
            className={CAMPO}
          />
          <label className="flex items-center gap-2 text-menudo font-semibold">
            <input
              type="checkbox"
              name="avisaDeTodo"
              value="si"
              defaultChecked={persona.avisaDeTodo}
              className="h-4 w-4 accent-[var(--color-acento)]"
            />
            Recibe todo
          </label>
          <button type="submit" disabled={guardando} className={BOTON}>
            Guardar
          </button>
        </form>

        <button type="button" onClick={() => setEditando(false)} className={BOTON}>
          Cancelar
        </button>

        <Clave persona={persona} tieneClave={tieneClave} />

        <form action={quitar}>
          <input type="hidden" name="id" value={persona.id} />
          <button
            type="submit"
            disabled={quitando}
            className="min-h-toque px-3 text-menudo font-semibold text-apagado underline
                       underline-offset-2 transition-colors hover:text-alerta disabled:opacity-40"
          >
            Quitar
          </button>
        </form>
      </div>

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
  const [abierto, setAbierto] = useState(false);
  const [estado, sumar, sumando] = useActionState(agregarAlEquipo, null);

  if (!abierto) {
    return (
      <div className="mt-8 border-t-2 border-tinta pt-6">
        <button type="button" onClick={() => setAbierto(true)} className={BOTON}>
          Agregar a alguien
        </button>
      </div>
    );
  }

  return (
    <section className="mt-8 border-t-2 border-tinta pt-6">
      <form action={sumar} className="flex flex-wrap items-center gap-2">
        <input name="nombre" placeholder="Nombre" aria-label="Nombre" className={CAMPO} />
        <input
          name="correo"
          type="email"
          placeholder="correo"
          aria-label="Correo"
          className={CAMPO}
        />
        <input
          name="enDrive"
          placeholder="cómo aparece en Drive"
          aria-label="Cómo aparece en Drive"
          className={CAMPO}
        />
        <label className="flex items-center gap-2 text-menudo font-semibold">
          <input
            type="checkbox"
            name="avisaDeTodo"
            value="si"
            className="h-4 w-4 accent-[var(--color-acento)]"
          />
          Recibe todo
        </label>
        <button type="submit" disabled={sumando} className={BOTON}>
          Agregar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={BOTON}>
          Cancelar
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

/**
 * Ponerle o cambiarle la contraseña a alguien.
 *
 * **No pide la anterior.** Son tres personas en una oficina que ya comparten
 * los clientes, los archivos y la caja; la que se la olvida gira la silla. Y
 * quien está escribiendo acá ya entró: pedirle otra contraseña para cambiar
 * una no agrega nada que la puerta no haya preguntado.
 */
function Clave({ persona, tieneClave }: { persona: Persona; tieneClave: boolean }) {
  const [estado, poner, poniendo] = useActionState(ponerClaveDePersona, null);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={BOTON}>
        {tieneClave ? "Cambiar contraseña" : "Poner contraseña"}
      </button>
    );
  }

  return (
    <form action={poner} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={persona.id} />
      <input
        name="clave"
        type="password"
        autoComplete="new-password"
        minLength={LARGO_MINIMO_DE_CLAVE}
        placeholder={`contraseña nueva (${LARGO_MINIMO_DE_CLAVE} o más)`}
        aria-label={`Contraseña de ${persona.nombre}`}
        className={CAMPO}
      />
      <button type="submit" disabled={poniendo} className={BOTON}>
        {poniendo ? "…" : "Guardar"}
      </button>
      <button type="button" onClick={() => setAbierto(false)} className={BOTON}>
        Cancelar
      </button>
      {estado && (
        <span
          aria-live="polite"
          className={`text-menudo font-semibold ${
            estado.ok ? "text-acento" : "text-alerta"
          }`}
        >
          {estado.ok ? "Lista." : estado.motivo}
        </span>
      )}
    </form>
  );
}
