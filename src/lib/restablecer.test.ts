// El link para elegir contraseña nueva.
//
// Lo que se prueba: vence, sirve una sola vez, y en el almacén nunca queda el
// token en limpio, solo su huella.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const guardado = memoriaDePruebas.ver("restablecer");

vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);

const {
  crearLinkDeRestablecer,
  gastarLinkDeRestablecer,
  huellaDelToken,
  personaDelLink,
  VIGENCIA_MS,
} = await import("@/lib/restablecer");

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
  vi.useRealTimers();
});

describe("el link de restablecer", () => {
  it("sirve para la persona que lo pidió", async () => {
    const token = await crearLinkDeRestablecer("nari");
    expect(await personaDelLink(token)).toBe("nari");
  });

  it("en el almacén no queda el token en limpio, solo su huella", async () => {
    const token = await crearLinkDeRestablecer("nari");
    expect(guardado[huellaDelToken(token)]).toBeDefined();
    expect(guardado[token]).toBeUndefined();
    expect(JSON.stringify(guardado)).not.toContain(token);
  });

  it("después de gastarlo ya no sirve, ni una segunda vez", async () => {
    const token = await crearLinkDeRestablecer("nari");
    await gastarLinkDeRestablecer(token);
    expect(await personaDelLink(token)).toBeNull();
  });

  it("vence a los treinta minutos", async () => {
    vi.useFakeTimers();
    const token = await crearLinkDeRestablecer("nari");
    vi.setSystemTime(Date.now() + VIGENCIA_MS + 1000);
    expect(await personaDelLink(token)).toBeNull();
    vi.useRealTimers();
  });

  it("un token inventado no abre nada", async () => {
    await crearLinkDeRestablecer("nari");
    expect(await personaDelLink("cualquier-cosa")).toBeNull();
    expect(await personaDelLink("")).toBeNull();
  });

  it("pedir de nuevo deja vivo solo el último link", async () => {
    const primero = await crearLinkDeRestablecer("nari");
    const segundo = await crearLinkDeRestablecer("nari");
    expect(await personaDelLink(segundo)).toBe("nari");
    expect(await personaDelLink(primero)).toBeNull();
  });

  it("pedir para otra persona no toca el link de la primera", async () => {
    const deNari = await crearLinkDeRestablecer("nari");
    await crearLinkDeRestablecer("otra");
    expect(await personaDelLink(deNari)).toBe("nari");
  });
});
