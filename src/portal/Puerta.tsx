"use client";

// Donde el cliente escribe su tag.
//
// Es la segunda mitad del acceso. El link solo no alcanza: se reenvía sin
// querer, queda en un chat de grupo, lo ve quien mira el teléfono de al lado.
// El tag es lo que la agencia le pasó por otro lado.
//
// No dice de qué cliente es el link. Una pantalla que saludara «Hola, Café
// Otoño» ya habría contado la mitad de lo que se está protegiendo.

import { useActionState } from "react";
import { entrarConTag } from "@/portal/acceso";
import { Boton } from "@/ui/Boton";
import { IconoEnviar } from "@/ui/Icono";
import { Marca } from "@/ui/Marca";

export function Puerta({ token }: { token: string }) {
  const [estado, entrar, esperando] = useActionState(entrarConTag, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-papel p-6">
      <div className="w-full max-w-md">
        <Marca />
        <h1 className="mt-8 text-grande font-extrabold leading-none tracking-tighter">
          ¿Cuál es tu clave?
        </h1>

        <form action={entrar} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <input
            type="text"
            name="tag"
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-label="Tu clave"
            className="min-h-toque w-full border-2 border-tinta bg-lienzo px-4 text-guia
                       font-bold tracking-tight transition-colors placeholder:font-normal
                       placeholder:text-apagado focus:border-acento focus:outline-none
                       focus:ring-4 focus:ring-acento-tenue"
          />

          {/* **Qué es la clave, no un ejemplo de clave.** El ejemplo era
              «café otoño», que es el nombre de un cliente real de la agencia:
              cualquier otro cliente que abría su puerta lo leía. Y un
              placeholder con forma de clave se confunde con la clave. */}
          <p className="text-menudo text-tinta-suave">
            Es la palabra que te pasó el equipo junto con este link.
          </p>

          {estado && !estado.ok && (
            <p
              aria-live="polite"
              className="border-l-4 border-alerta bg-alerta-tenue px-4 py-3 text-normal font-semibold text-alerta"
            >
              {estado.motivo}
            </p>
          )}

          <Boton ancho disabled={esperando}>
            <IconoEnviar />
            {esperando ? "Un segundo…" : "Entrar"}
          </Boton>
        </form>

        <p className="mt-6 text-menudo text-apagado">
          Si no la tenés o no te la acordás, pedísela al equipo por donde le escribís
          siempre.
        </p>
      </div>
    </div>
  );
}
