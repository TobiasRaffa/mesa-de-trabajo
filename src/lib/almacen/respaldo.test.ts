import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { losQueSobran, nombreDelRespaldo, respaldar } from "@/lib/almacen/respaldo";

describe("el nombre del respaldo", () => {
  it("lleva el día de Buenos Aires, no el del servidor", () => {
    // 01:30 UTC del 24 son las 22:30 del 23 en Buenos Aires.
    expect(nombreDelRespaldo(new Date("2026-09-24T01:30:00Z"))).toBe("respaldo-2026-09-23.json.gz");
  });
});

describe("los que sobran", () => {
  it("se borran los más viejos, pasados los que se guardan", () => {
    const nombres = ["respaldo-2026-09-03.json.gz", "respaldo-2026-09-01.json.gz", "respaldo-2026-09-02.json.gz"];
    expect(losQueSobran(nombres, 2)).toEqual(["respaldo-2026-09-01.json.gz"]);
    expect(losQueSobran(nombres, 5)).toEqual([]);
  });

  it("no toca nada que no sea un respaldo suyo", () => {
    expect(losQueSobran(["otra-cosa.txt", "respaldo-2026-09-01.json.gz"], 0)).toEqual([
      "respaldo-2026-09-01.json.gz",
    ]);
  });
});

describe("respaldar", () => {
  const pedidos: Array<{ url: string; init: RequestInit }> = [];
  let hayDeposito = false;

  beforeEach(() => {
    pedidos.length = 0;
    hayDeposito = false;
    vi.stubEnv("SUPABASE_URL", "https://base.test");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "llave");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        pedidos.push({ url, init });
        if (url.includes("/rest/v1/documentos")) {
          return new Response(JSON.stringify([{ coleccion: "clientes", id: "a", datos: { nombre: "A" } }]));
        }
        if (url.endsWith("/storage/v1/bucket")) {
          hayDeposito = true;
          return new Response("{}");
        }
        if (url.includes("/storage/v1/object/list/")) {
          const viejos = Array.from({ length: 32 }, (_, i) => ({
            name: `respaldo-2026-08-${String(i + 1).padStart(2, "0")}.json.gz`,
          }));
          return new Response(JSON.stringify(viejos));
        }
        if (url.includes("/storage/v1/object/respaldos/")) {
          return hayDeposito
            ? new Response("{}")
            : new Response(JSON.stringify({ error: "Bucket not found" }), { status: 404 });
        }
        return new Response("{}");
      })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("la primera vez crea el depósito, privado, y sube la tabla entera", async () => {
    const hecho = await respaldar(new Date("2026-09-23T12:00:00Z"));
    expect(hecho).toMatchObject({ archivo: "respaldo-2026-09-23.json.gz", filas: 1 });

    const creado = pedidos.find((p) => p.url.endsWith("/storage/v1/bucket"))!;
    expect(JSON.parse(String(creado.init.body))).toMatchObject({ id: "respaldos", public: false });

    const subidas = pedidos.filter((p) => p.url.endsWith("/respaldos/respaldo-2026-09-23.json.gz"));
    const ultima = subidas.at(-1)!;
    const contenido = JSON.parse(gunzipSync(ultima.init.body as Uint8Array).toString());
    expect(contenido.filas).toEqual([{ coleccion: "clientes", id: "a", datos: { nombre: "A" } }]);
  });

  it("deja los últimos treinta y borra el resto", async () => {
    hayDeposito = true;
    const hecho = await respaldar(new Date("2026-09-23T12:00:00Z"));
    expect(hecho.borrados).toBe(2);
    const borrado = pedidos.find((p) => p.init.method === "DELETE")!;
    expect(JSON.parse(String(borrado.init.body)).prefixes).toEqual([
      "respaldo-2026-08-01.json.gz",
      "respaldo-2026-08-02.json.gz",
    ]);
  });

  it("si no puede subir, falla: un respaldo que no se guardó no se da por hecho", async () => {
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).includes("/rest/v1/")
        ? new Response("[]")
        : new Response("no", { status: 500 })
    );
    await expect(respaldar()).rejects.toThrow(/500/);
  });
});
