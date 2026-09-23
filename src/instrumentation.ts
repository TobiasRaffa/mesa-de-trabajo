// Los errores del servidor, al panel de errores.
//
// Next llama a `onRequestError` con todo lo que se cae del lado del servidor:
// una pantalla, una acción, una ruta de `/api`. Sin `NEXT_PUBLIC_SENTRY_DSN` no
// hace nada. Qué se manda y qué se limpia antes está en `src/lib/errores.ts`.

import type { Instrumentation } from "next";
import { dsnDeSentry, opcionesDeSentry } from "@/lib/errores";

export async function register() {
  if (!dsnDeSentry()) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init(opcionesDeSentry());
}

export const onRequestError: Instrumentation.onRequestError = async (...error) => {
  if (!dsnDeSentry()) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...error);
  // **En Netlify cada pedido se congela apenas contesta**, y lo que quedó por
  // mandar se pierde con él. Se espera a que salga, con un tope: un panel de
  // errores que no contesta no puede demorar una respuesta más que eso.
  await Sentry.flush(2000);
};
