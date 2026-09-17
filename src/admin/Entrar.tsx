"use client";

// La pantalla de entrada del equipo.
//
// Dos campos y un botón. No hay «recordarme» —la sesión ya dura una semana— ni
// «olvidé mi contraseña»: son tres personas en una oficina, y la que la olvida
// se la pide a la de al lado, que se la cambia en Admin. Un correo de
// recuperación es un camino de entrada más para cuidar, a cambio de resolver
// algo que se resuelve girando la silla.

import { useActionState } from "react";
import { entrar } from "@/app/(admin)/gestion/entrar/acciones";

const CAMPO =
  "w-full border-2 border-tinta bg-lienzo px-3 py-2.5 text-normal transition-colors " +
  "placeholder:text-apagado focus:border-acento focus:outline-none focus:ring-4 " +
  "focus:ring-acento-tenue";

export function Entrar({
  volver,
  arrancando,
}: {
  /** A dónde ir después de entrar: de dónde lo echó la puerta. */
  volver: string;
  /** Nadie del equipo tiene contraseña todavía: entra con la del equipo. */
  arrancando: boolean;
}) {
  const [estado, mandar, yendo] = useActionState(entrar, null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <p className="text-micro font-extrabold uppercase tracking-widest text-apagado">
        Mesa de trabajo
      </p>
      <h1 className="mt-2 text-grande font-extrabold leading-none tracking-tighter">
        {arrancando ? "Primera vez" : "Entrar"}
      </h1>

      {arrancando ? (
        <p className="mt-3 text-normal text-tinta-suave">
          Todavía nadie del equipo tiene contraseña. Entrá con la clave del equipo y
          cargalas en <span className="font-bold">Admin → El equipo</span>. Desde que haya
          una, cada una entra con la suya.
        </p>
      ) : (
        <p className="mt-3 text-normal text-tinta-suave">
          Con tu correo y tu contraseña. Lo que hagas queda firmado con tu nombre.
        </p>
      )}

      <form action={mandar} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="volver" value={volver} />

        {!arrancando && (
          <label className="flex flex-col gap-1.5">
            <span className="text-micro font-extrabold uppercase tracking-widest text-apagado">
              Tu correo
            </span>
            <input
              name="correo"
              type="email"
              autoComplete="username"
              autoFocus
              required
              className={CAMPO}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-micro font-extrabold uppercase tracking-widest text-apagado">
            {arrancando ? "Clave del equipo" : "Tu contraseña"}
          </span>
          <input
            name="clave"
            type="password"
            autoComplete="current-password"
            autoFocus={arrancando}
            required
            className={CAMPO}
          />
        </label>

        <button
          type="submit"
          disabled={yendo}
          className="min-h-toque bg-acento px-5 text-normal font-bold tracking-tight
                     text-white transition-colors hover:bg-acento-hover disabled:opacity-40"
        >
          {yendo ? "Entrando…" : "Entrar"}
        </button>

        {/* Lo que dijo el servidor, acá y no en otro lado: quien aprieta el
            botón tiene que enterarse de por qué no pasó nada. */}
        {estado && !estado.ok && (
          <p
            role="alert"
            className="border-l-4 border-alerta bg-alerta-tenue px-3 py-2 text-menudo font-semibold text-alerta"
          >
            {estado.motivo}
          </p>
        )}
      </form>
    </main>
  );
}
