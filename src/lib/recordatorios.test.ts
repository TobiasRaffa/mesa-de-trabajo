// Los recordatorios de plazo: cuándo toca cada uno, y que no salga dos veces.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const guardado = memoriaDePruebas.ver("recordatorios");
const avisos: Array<{ clase: string; detalle?: string }> = [];

// El doble del almacén es el compartido: cumple el contrato entero —`cambiar`
// incluido— así que lo que pasa acá dice algo de lo que va a pasar de verdad.
vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);

vi.mock("@/lib/avisar", () => ({
  avisar: async (o: { clase: string; detalle?: string }) => {
    avisos.push(o);
  },
}));

const { recordarSiHaceFalta, recordatorioQueToca } = await import("@/lib/recordatorios");

const DIA = 24 * 60 * 60 * 1000;
const entregada = new Date("2026-09-10T12:00:00-03:00");

const pieza = (extra: Partial<Parameters<typeof recordatorioQueToca>[0]> = {}) => ({
  piezaId: "carpeta::pieza.jpg",
  detalle: "la v2 de pieza",
  entregadaEl: entregada.toISOString(),
  dias: 4,
  vence: new Date(entregada.getTime() + 4 * DIA),
  esperandoAlCliente: true,
  ...extra,
});

const donde = { clienteId: "c", cliente: "Cliente", carpetaId: "k", carpeta: "Carpeta" };

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
  avisos.length = 0;
});

describe("cuál toca", () => {
  it("nada, recién entregada", () => {
    expect(recordatorioQueToca(pieza(), new Date(entregada.getTime() + DIA))).toBeNull();
  });

  it("«por vencer» pasada la mitad del plazo", () => {
    expect(recordatorioQueToca(pieza(), new Date(entregada.getTime() + 2.5 * DIA))).toBe(
      "por_vencer"
    );
  });

  it("«vencio» cumplido el plazo", () => {
    expect(recordatorioQueToca(pieza(), new Date(entregada.getTime() + 4.5 * DIA))).toBe(
      "vencio"
    );
  });

  it("nada si el cliente ya decidió", () => {
    expect(
      recordatorioQueToca(
        pieza({ esperandoAlCliente: false }),
        new Date(entregada.getTime() + 9 * DIA)
      )
    ).toBeNull();
  });

  it("nada sin entrega", () => {
    expect(recordatorioQueToca(pieza({ entregadaEl: undefined, vence: null }))).toBeNull();
  });
});

describe("cada uno sale una sola vez", () => {
  it("la primera vez avisa, la segunda no", async () => {
    const ahora = new Date(entregada.getTime() + 3 * DIA);

    expect(await recordarSiHaceFalta(pieza(), donde, ahora)).toBe("por_vencer");
    expect(await recordarSiHaceFalta(pieza(), donde, ahora)).toBeNull();
    expect(avisos.map((a) => a.clase)).toEqual(["por_vencer"]);
  });

  it("después del «por vencer» sale el «vencio», y también una sola vez", async () => {
    await recordarSiHaceFalta(pieza(), donde, new Date(entregada.getTime() + 3 * DIA));
    await recordarSiHaceFalta(pieza(), donde, new Date(entregada.getTime() + 5 * DIA));
    await recordarSiHaceFalta(pieza(), donde, new Date(entregada.getTime() + 6 * DIA));

    expect(avisos.map((a) => a.clase)).toEqual(["por_vencer", "vencio"]);
  });

  it("una entrega nueva de la misma pieza vuelve a avisar", async () => {
    await recordarSiHaceFalta(pieza(), donde, new Date(entregada.getTime() + 3 * DIA));

    const otra = new Date(entregada.getTime() + 10 * DIA);
    const denuevo = pieza({
      entregadaEl: otra.toISOString(),
      vence: new Date(otra.getTime() + 4 * DIA),
    });
    expect(await recordarSiHaceFalta(denuevo, donde, new Date(otra.getTime() + 3 * DIA))).toBe(
      "por_vencer"
    );
  });

  it("dice qué pieza", async () => {
    await recordarSiHaceFalta(pieza(), donde, new Date(entregada.getTime() + 3 * DIA));
    expect(avisos[0].detalle).toBe("la v2 de pieza");
  });
});
