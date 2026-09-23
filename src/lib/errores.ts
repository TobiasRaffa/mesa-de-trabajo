// Adónde van los errores de producción.
//
// En la computadora un error se ve en la consola, que alguien tiene delante.
// En Netlify la consola es un registro que nadie abre: una pantalla que se cae
// para un cliente, o un recordatorio que no sale, pasa sin que nadie se entere
// hasta que alguien se queja. Con Sentry cada error llega a un panel, con la
// pantalla donde pasó, y avisa por correo la primera vez que aparece.
//
// **Es opcional**: sin `NEXT_PUBLIC_SENTRY_DSN` no se manda nada y la
// aplicación anda igual. Está en DESPLIEGUE.md cómo sacar el DSN.
//
// **Lo que sale de acá lo lee un tercero**, así que se limpia antes:
//
//   - **El token del portal** va en la dirección (`/t/<token>`) y es la mitad
//     de la llave de un cliente: se reemplaza en todo el evento.
//   - **Lo que se mandó en el pedido** —el cuerpo de un formulario puede ser la
//     contraseña de alguien entrando—, las galletas y las cabeceras (la llave
//     de la tarea diaria viaja en una) no se mandan nunca.
//   - Ni las variables de la función que falló, que pueden ser una llave.
//   - Nada de medir tiempos ni grabar sesiones: solo errores.

import type { BrowserOptions, NodeOptions } from "@sentry/nextjs";

/** El DSN, si está. Es público por diseño: solo sirve para mandar errores. */
export const dsnDeSentry = (): string | undefined =>
  process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;

const TOKEN_DEL_PORTAL = /\/t\/[A-Za-z0-9_-]+/g;

/** Saca de un evento lo que no tiene por qué salir de la aplicación. */
export function limpiarEvento<E extends object>(evento: E): E {
  const e = evento as E & {
    request?: { data?: unknown; cookies?: unknown; headers?: unknown; query_string?: unknown };
    user?: unknown;
  };
  if (e.request) {
    delete e.request.data;
    delete e.request.cookies;
    delete e.request.headers;
    delete e.request.query_string;
  }
  delete e.user;
  // Por si alguna integración las junta igual: las variables de cada función.
  for (const valor of (e as { exception?: { values?: unknown[] } }).exception?.values ?? []) {
    for (const cuadro of (valor as { stacktrace?: { frames?: Array<{ vars?: unknown }> } })
      .stacktrace?.frames ?? []) {
      delete cuadro.vars;
    }
  }
  // Una sola pasada por todo el texto del evento: el token aparece en la
  // dirección, en el nombre de la transacción, en las migas y en los mensajes,
  // y buscarlo campo por campo es dejar alguno afuera.
  return JSON.parse(JSON.stringify(e).replace(TOKEN_DEL_PORTAL, "/t/[token]")) as E;
}

/** Lo que comparten el servidor y el navegador. */
export function opcionesDeSentry(): NodeOptions & BrowserOptions {
  return {
    dsn: dsnDeSentry(),
    enabled: Boolean(dsnDeSentry()),
    environment: process.env.NODE_ENV,
    // **Sentry junta todo por omisión**, incluidas las variables de cada
    // función del error: con eso viajaban la llave de Supabase o la contraseña
    // que alguien acababa de escribir. Se apaga cada cosa por nombre.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
    },
    tracesSampleRate: 0,
    beforeSend: (evento) => limpiarEvento(evento),
    beforeBreadcrumb: (miga) => limpiarEvento(miga),
  };
}

/**
 * Manda al panel un error que atajó una pantalla.
 *
 * Los que tienen `digest` vienen del servidor y ya los mandó
 * `onRequestError` (`src/instrumentation.ts`): mandarlos de nuevo desde el
 * navegador los contaría dos veces, y sin el detalle, que el navegador no ve.
 */
export function reportarError(error: Error & { digest?: string }): void {
  if (!dsnDeSentry() || error.digest) return;
  void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
}
