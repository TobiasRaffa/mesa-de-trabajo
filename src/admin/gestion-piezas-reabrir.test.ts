// Reabrir una pieza aprobada: el plazo del cliente vuelve a correr desde hoy.
//
// Drive, la sesión y el alcance se reemplazan por dobles; el almacén es el de
// memoria, que cumple el contrato entero. Lo que se mira es qué queda guardado.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { piezasDeLaCarpeta } = vi.hoisted(() => ({ piezasDeLaCarpeta: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);
vi.mock("@/lib/sesion", () => ({
  puedoAlgunaDe: vi.fn(async () => true),
  puedoVer: vi.fn(async () => true),
  firmaDeAgencia: vi.fn(async () => "El equipo"),
  contrasenaDeQuienEsta: vi.fn(async () => true),
}));
vi.mock("@/admin/datos/clientes", () => ({
  esCarpetaMia: vi.fn(async () => true),
  clienteDeMiCarpeta: vi.fn(async () => ({ id: "cliente" })),
  miCliente: vi.fn(async () => ({ id: "cliente" })),
  misCarpetas: vi.fn(async () => new Set<string>()),
  misClientes: vi.fn(async () => [{ id: "cliente" }]),
  todosMisClientes: vi.fn(async () => [{ id: "cliente" }]),
  esDeMisClientes: vi.fn(async () => true),
  misAvisos: vi.fn(async () => []),
}));
vi.mock("@/lib/piezas", async (original) => ({
  ...(await original<typeof import("@/lib/piezas")>()),
  piezasDeLaCarpeta,
}));

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const { reabrirPieza } = await import("@/app/(admin)/gestion/acciones");

const CARPETA = "carpeta-1";
const PIEZA = `${CARPETA}::stickers.jpg`;
const piezas = memoriaDePruebas.ver("piezas");

beforeEach(() => {
  memoriaDePruebas.vaciar();
  piezasDeLaCarpeta.mockResolvedValue([
    { id: "A", name: "stickers.jpg", mimeType: "image/jpeg" },
    { id: "B", name: "V2 stickers.jpg", mimeType: "image/jpeg" },
  ]);
});

describe("reabrir una pieza aprobada", () => {
  it("el plazo arranca desde la reapertura, no desde la entrega de hace semanas", async () => {
    // **Conservaba la fecha de la entrega original.** La pieza volvía a
    // esperar al cliente con un vencimiento que ya había pasado: el tablero la
    // pintaba vencida en el acto, salía el aviso de «venció» y el cliente veía
    // una fecha en el pasado.
    piezas[PIEZA] = {
      carpetaId: CARPETA,
      estado: "final",
      ronda: 1,
      rondasExtra: 0,
      cambios: [],
      enviada: false,
      mudada: false,
      entregadaEl: "2026-08-01T12:00:00.000Z",
      versionEntregada: 2,
      archivos: ["A", "B"],
      historia: [],
    };
    const antes = new Date().toISOString();

    const r = await reabrirPieza(CARPETA, PIEZA);

    expect(r.ok).toBe(true);
    const guardada = piezas[PIEZA] as { estado: string; entregadaEl?: string; versionEntregada?: number };
    expect(guardada.estado).not.toBe("final");
    expect(guardada.entregadaEl! >= antes, `entregadaEl quedó en ${guardada.entregadaEl}`).toBe(true);
    // Lo que el cliente tiene delante sigue siendo la vuelta que aprobó.
    expect(guardada.versionEntregada).toBe(2);
  });
});
