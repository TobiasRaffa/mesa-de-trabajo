"use client";

// La pantalla de entrada de la agencia.
//
// Se parece a la del cliente a propósito —misma forma, mismo tono— pero dice
// otra cosa. Al cliente se le pide «tu clave» porque es una palabra que le
// pasaron; acá se pide la contraseña del equipo, que es una sola y compartida.
//
// No dice de quién es la aplicación ni qué hay adentro. Quien llegue de rebote
// a esta dirección no tiene por qué enterarse de nada.

import { useActionState } from "react";
import { entrarAGestion } from "@/app/(admin)/gestion/entrar/acciones";
import { Boton } from "@/ui/Boton";

export function Entrar({ volver, falta }: { volver: string; falta: boolean }) {
  const [estado, entrar, esperando] = useActionState(entrarAGestion, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-papel p-6">
      <div className="w-full max-w-md">
        <p className="text-micro font-extrabold uppercase tracking-widest text-apagado">
          Mesa de trabajo
        </p>
        <h1 className="mt-2 text-grande font-extrabold leading-none tracking-tighter">
          Gestión
        </h1>

        {falta ? (
          <p className="mt-6 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-normal font-semibold text-espera">
            Falta configurar <code className="font-mono">CLAVE_DE_ADMIN</code>. Sin eso
            no se abre nada, que es el lado seguro del error. Está explicado en{" "}
            <code className="font-mono">.env.example</code>.
          </p>
        ) : (
          <form action={entrar} className="mt-6 flex flex-col gap-3">
            <input type="hidden" name="volver" value={volver} />
            <input
              type="password"
              name="contrasena"
              autoFocus
              autoComplete="current-password"
              aria-label="Contraseña del equipo"
              className="min-h-toque w-full border-2 border-tinta bg-lienzo px-4 text-guia
                         font-bold tracking-tight transition-colors placeholder:font-normal
                         placeholder:text-apagado focus:border-acento focus:outline-none
                         focus:ring-4 focus:ring-acento-tenue"
              placeholder="La contraseña del equipo"
            />

            {estado && !estado.ok && (
              <p
                role="alert"
                className="border-l-4 border-alerta bg-alerta-tenue px-4 py-3 text-normal font-semibold text-alerta"
              >
                {estado.motivo}
              </p>
            )}

            <Boton ancho disabled={esperando}>
              {esperando ? "Un segundo…" : "Entrar"}
            </Boton>
          </form>
        )}
      </div>
    </div>
  );
}
