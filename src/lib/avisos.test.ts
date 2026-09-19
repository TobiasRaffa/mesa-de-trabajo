// Cuándo un aviso es la continuación del anterior.

import { describe, expect, it } from "vitest";
import { continuaA, VENTANA_DE_RACHA } from "@/lib/avisos";

const ahora = new Date("2026-09-18T12:10:00.000Z");
const hace = (ms: number) => new Date(ahora.getTime() - ms).toISOString();

const escribio = { clase: "escribio" as const, clienteId: "cafe" };

describe("mensajes seguidos son un solo aviso", () => {
  it("se suma al anterior si es del mismo cliente, sin ver y dentro de la ventana", () => {
    const anterior = { ...escribio, cuando: hace(2 * 60 * 1000), visto: false };
    expect(continuaA(anterior, escribio, ahora)).toBe(true);
  });

  it("no se suma si alguien ya lo vio: lo nuevo tiene que volver a avisar", () => {
    const anterior = { ...escribio, cuando: hace(60 * 1000), visto: true };
    expect(continuaA(anterior, escribio, ahora)).toBe(false);
  });

  it("pasada la ventana es otra novedad", () => {
    const anterior = { ...escribio, cuando: hace(VENTANA_DE_RACHA + 1), visto: false };
    expect(continuaA(anterior, escribio, ahora)).toBe(false);
    const justo = { ...escribio, cuando: hace(VENTANA_DE_RACHA), visto: false };
    expect(continuaA(justo, escribio, ahora)).toBe(true);
  });

  it("otro cliente u otra clase no se mezclan", () => {
    const reciente = { cuando: hace(1000), visto: false };
    expect(continuaA({ ...escribio, ...reciente }, { ...escribio, clienteId: "otro" }, ahora)).toBe(
      false
    );
    expect(
      continuaA({ clase: "aprobo", clienteId: "cafe", ...reciente }, escribio, ahora)
    ).toBe(false);
  });

  it("una fecha rota no se suma a nada", () => {
    expect(continuaA({ ...escribio, cuando: "ayer", visto: false }, escribio, ahora)).toBe(false);
  });
});
