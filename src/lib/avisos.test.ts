// Cuándo un aviso es la continuación del anterior.

import { describe, expect, it } from "vitest";
import { continuaA, loVio, VENTANA_DE_RACHA, type Aviso } from "@/lib/avisos";

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

  it("alcanza con que lo haya visto una persona para cortar la racha", () => {
    // Si Nari abrió la bandeja entre un mensaje y el otro, el segundo tiene que
    // volver a aparecer como nuevo —para ella y para todos—, no colarse dentro
    // de un renglón que ya se leyó.
    const anterior = {
      ...escribio,
      cuando: hace(60 * 1000),
      visto: false,
      vistoPor: ["nari"],
    };
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

  it("otra carpeta del mismo cliente tampoco", () => {
    // Aprobar en «Banners» y aprobar en «Stories» dentro de los cinco minutos
    // son dos novedades: juntarlas daba un renglón que nombraba una sola de
    // las dos carpetas.
    const reciente = { ...escribio, cuando: hace(1000), visto: false, carpetaId: "banners" };
    expect(continuaA(reciente, { ...escribio, carpetaId: "stories" }, ahora)).toBe(false);
    expect(continuaA(reciente, { ...escribio, carpetaId: "banners" }, ahora)).toBe(true);
  });

  it("una fecha rota no se suma a nada", () => {
    expect(continuaA({ ...escribio, cuando: "ayer", visto: false }, escribio, ahora)).toBe(false);
  });
});

describe("visto es de cada persona, no del aviso", () => {
  const base = { ...escribio, id: "a", cuando: hace(0), visto: false } as unknown as Aviso;

  it("quien lo marcó lo tiene leído y el resto no", () => {
    const aviso = { ...base, vistoPor: ["nari"] };
    expect(loVio(aviso, "nari")).toBe(true);
    expect(loVio(aviso, "tomas")).toBe(false);
  });

  it("lo que quedó marcado del sistema viejo se lee como visto por todos", () => {
    // El día del cambio, tratar lo viejo como «sin leer» le llenaría la bandeja
    // a todo el equipo de una vez con cosas que ya se atendieron.
    const aviso = { ...base, visto: true };
    expect(loVio(aviso, "tomas")).toBe(true);
  });

  it("sin sesión no hay nada leído", () => {
    expect(loVio({ ...base, vistoPor: ["nari"] }, null)).toBe(false);
  });
});
