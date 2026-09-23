import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/permisos", () => ({ quienPideDe: vi.fn(async () => ({ rol: "agencia" })) }));
vi.mock("@/lib/google", () => ({
  subcarpetasDe: vi.fn(),
  datosDeCarpeta: vi.fn(async () => ({ name: "Cliente" })),
}));
vi.mock("@/lib/ajustes", () => ({ esCarpetaReservada: () => false }));
vi.mock("@/lib/piezas", () => ({
  EN_PALABRAS: {},
  piezasDeLaCarpeta: vi.fn(async () => []),
  estadosDe: vi.fn(async () => ({})),
}));
vi.mock("@/lib/versiones", () => ({
  agruparVersiones: () => [],
  conSusArchivos: () => [],
}));

const { subcarpetasDe } = await import("@/lib/google");
const { historialDelCliente } = await import("@/admin/datos/historial");
const { GET } = await import("@/app/api/historial/[clienteId]/route");

const subcarpetas = vi.mocked(subcarpetasDe);

beforeEach(() => {
  subcarpetas.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("el historial cuando Drive no contesta", () => {
  // **Una planilla vacía que se baja «bien» es peor que un error.** Este
  // archivo es para cobrar vueltas y discutir qué se aprobó: con la llave
  // vencida salía un CSV con solo los títulos y status 200, y nadie se
  // enteraba de que faltaba todo.
  it("si no se puede leer la carpeta del cliente, falla", async () => {
    subcarpetas.mockRejectedValue(new Error("Drive: invalid_grant (llave vencida)"));
    await expect(historialDelCliente("cli1")).rejects.toThrow("invalid_grant");
  });

  it("la ruta contesta 502 en vez de un CSV vacío", async () => {
    subcarpetas.mockRejectedValue(new Error("Drive: invalid_grant (llave vencida)"));

    const r = await GET(new Request("http://x/api/historial/cli1"), {
      params: Promise.resolve({ clienteId: "cli1" }),
    });

    expect(r.status).toBe(502);
    expect(await r.text()).toBe("No se pudo armar el historial");
  });

  it("una subcarpeta que falla no se lleva puestas a las demás", async () => {
    // Lo de más abajo sigue como estaba: omitir una carpeta que no se deja
    // leer es una decisión, no un olvido.
    subcarpetas.mockImplementation(async (id: string) => {
      if (id === "cli1") return [{ id: "a", name: "A" }] as never;
      throw new Error("sin permiso");
    });
    await expect(historialDelCliente("cli1")).resolves.toEqual([]);
  });
});
