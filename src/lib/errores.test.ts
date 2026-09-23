import { describe, expect, it } from "vitest";
import { limpiarEvento, opcionesDeSentry } from "@/lib/errores";

describe("lo que sale al panel de errores", () => {
  it("no lleva el token del portal en ningún lado", () => {
    const limpio = limpiarEvento({
      request: { url: "https://mesa.test/t/WAX8PDItj0MWgeIO?x=1" },
      transaction: "/t/WAX8PDItj0MWgeIO",
      message: "falló /t/WAX8PDItj0MWgeIO/pieza",
    });
    expect(JSON.stringify(limpio)).not.toContain("WAX8PDItj0MWgeIO");
    expect(limpio.transaction).toBe("/t/[token]");
  });

  it("no lleva lo que se mandó, ni galletas, ni cabeceras, ni quién era", () => {
    const limpio = limpiarEvento({
      request: {
        url: "https://mesa.test/gestion/entrar",
        data: "clave=secreta",
        cookies: { mdt_gestion: "x" },
        headers: { authorization: "Bearer y" },
        query_string: "a=b",
      },
      user: { email: "alguien@agencia.test" },
    });
    expect(limpio).toEqual({ request: { url: "https://mesa.test/gestion/entrar" } });
  });

  it("no lleva las variables de la función que falló", () => {
    const limpio = limpiarEvento({
      exception: { values: [{ stacktrace: { frames: [{ function: "pedir", vars: { llave: "k" } }] } }] },
    });
    expect(JSON.stringify(limpio)).not.toContain("llave");
  });

  it("sin DSN no se manda nada", () => {
    expect(opcionesDeSentry().enabled).toBe(false);
  });
});
