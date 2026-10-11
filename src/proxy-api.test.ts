// Las APIs atienden solo a esta aplicación.
//
// Lo que se prueba: un pedido que sale de una página de otro sitio se rechaza
// antes de llegar a la ruta; uno de la propia aplicación, o uno sin navegador
// (la tarea diaria), pasa.

import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);

const { proxy } = await import("@/proxy");

const pedir = (headers: Record<string, string>, ruta = "/api/archivo/abc") =>
  proxy(new NextRequest(`https://mesa.test${ruta}`, { headers: { host: "mesa.test", ...headers } }));

describe("las APIs y el origen del pedido", () => {
  it("deja pasar lo que pide la propia aplicación", async () => {
    const r = await pedir({ "sec-fetch-site": "same-origin", origin: "https://mesa.test" });
    expect(r.status).toBe(200);
  });

  it("deja pasar un pedido sin navegador, como la tarea diaria", async () => {
    const r = await pedir({}, "/api/tareas");
    expect(r.status).toBe(200);
  });

  it("rechaza lo que manda una página de otro sitio", async () => {
    const r = await pedir({ "sec-fetch-site": "cross-site", origin: "https://malo.example" });
    expect(r.status).toBe(403);
  });

  it("rechaza un Origin ajeno aunque no venga Sec-Fetch-Site", async () => {
    const r = await pedir({ origin: "https://malo.example" });
    expect(r.status).toBe(403);
  });

  it("rechaza un subdominio hermano: el portal no le pide a la gestión", async () => {
    const r = await pedir({ "sec-fetch-site": "same-site", origin: "https://portal.mesa.test" });
    expect(r.status).toBe(403);
  });
});
