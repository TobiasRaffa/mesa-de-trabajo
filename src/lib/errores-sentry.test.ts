// Lo que de verdad sale por la red cuando hay un error, con el SDK real de
// Sentry y un receptor local en lugar del panel.
//
// Las pruebas de `limpiarEvento` miran la función; esta mira el cable. Sentry
// cambia qué junta por omisión de una versión a otra —la 11 empezó a mandar
// las variables de cada función—, y esto es lo que avisa si una actualización
// vuelve a abrir algo.

import { createServer } from "node:http";
import { gunzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const llegado: string[] = [];
const receptor = createServer((pedido, respuesta) => {
  const partes: Buffer[] = [];
  pedido.on("data", (p) => partes.push(p));
  pedido.on("end", () => {
    const cuerpo = Buffer.concat(partes);
    llegado.push(
      pedido.headers["content-encoding"] === "gzip" ? gunzipSync(cuerpo).toString() : cuerpo.toString()
    );
    respuesta.end("{}");
  });
});

beforeAll(async () => {
  await new Promise<void>((listo) => receptor.listen(0, "127.0.0.1", listo));
  const { port } = receptor.address() as AddressInfo;
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", `http://publica@127.0.0.1:${port}/1`);
});

afterAll(() => {
  vi.unstubAllEnvs();
  receptor.close();
});

describe("un error del servidor, camino al panel", () => {
  it("llega, sin el token del portal, sin lo que se mandó y sin las variables", async () => {
    const { register, onRequestError } = await import("@/instrumentation");
    await register();

    function pedirASupabase(llave: string) {
      throw new Error(`Falló /t/WAX8PDItj0MWgeIO con ${llave.length} letras`);
    }
    // Armada en tiempo de ejecución: Sentry manda las líneas de código
    // alrededor del error, y una llave escrita literal en la prueba viajaría
    // como código, que no es lo que se está mirando.
    const llave = ["LLAVE", "SUPER", "SECRETA"].join("-");
    let error: unknown;
    try {
      pedirASupabase(llave);
    } catch (e) {
      error = e;
    }

    await onRequestError(
      error,
      {
        path: "/t/WAX8PDItj0MWgeIO?x=1",
        method: "POST",
        headers: { cookie: "mdt_gestion=GALLETA-SECRETA", authorization: "Bearer LLAVE-TAREA" },
      },
      {
        routerKind: "App Router",
        routePath: "/t/[token]",
        routeType: "action",
        renderSource: "react-server-components",
        revalidateReason: undefined,
      }
    );

    // Con toda la batería corriendo a la vez el envío puede tardar más que el
    // tope de `flush`: se espera a que llegue, en vez de suponer cuánto tarda.
    const hasta = Date.now() + 10_000;
    while (!llegado.some((x) => x.includes("Falló")) && Date.now() < hasta) {
      await new Promise((listo) => setTimeout(listo, 50));
    }
    const todo = llegado.join("\n");
    expect(todo, "No llegó nada al receptor").toContain("Falló /t/[token]");
    for (const secreto of ["WAX8PDItj0MWgeIO", "GALLETA-SECRETA", "LLAVE-TAREA", "LLAVE-SUPER-SECRETA"]) {
      expect(todo, `Salió «${secreto}»`).not.toContain(secreto);
    }
  }, 20_000);
});
