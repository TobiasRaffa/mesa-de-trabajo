// La cuenta recorre todo el árbol, aunque ahora baje en paralelo.
//
// `contar` (la suma) tiene sus pruebas en `ideas.test.ts` y no depende del
// orden. Lo que se cambió es la travesía: de bajar carpeta por carpeta a
// bajarlas a la vez. Esta prueba fija que siga juntando **todas** las piezas,
// incluidas las de una subcarpeta honda, y que las carpetas reservadas no
// cuenten.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Un árbol de mentira: raíz → A, B y «Entregas Finales» (reservada); A → A1.
const SUB: Record<string, Array<{ id: string; name: string }>> = {
  raiz: [
    { id: "A", name: "A" },
    { id: "B", name: "B" },
    { id: "fin", name: "Entregas Finales" },
  ],
  A: [{ id: "A1", name: "A1" }],
  B: [],
  A1: [],
  fin: [],
};

// Cuántas piezas tiene cada carpeta. La raíz no cuenta sus propios archivos:
// la cuenta es de las subcarpetas de trabajo, como en producción.
const PIEZAS: Record<string, number> = { A: 2, B: 1, A1: 1 };

vi.mock("@/lib/google", () => ({
  subcarpetasDe: vi.fn(async (id: string) => SUB[id] ?? []),
}));
vi.mock("@/lib/ajustes", () => ({
  esCarpetaReservada: (name: string) => name === "Entregas Finales",
}));
vi.mock("@/lib/trabajos", () => ({
  trabajosDeLaCarpeta: vi.fn(async (id: string) => ({
    agrupadas: Array.from({ length: PIEZAS[id] ?? 0 }, () => ({ versiones: [{}] })),
  })),
}));
vi.mock("@/lib/versiones", () => ({
  conSusArchivos: (carpetaId: string, agrupadas: unknown[]) =>
    agrupadas.map((_, i) => ({ id: `${carpetaId}-${i}`, version: 1 })),
}));
vi.mock("@/lib/piezas", () => ({
  estadosDe: vi.fn(async (carpetaId: string, conArchivos: Array<{ id: string }>) =>
    Object.fromEntries(
      conArchivos.map((c) => [c.id, { estado: "en_curso", rondasExtra: 0, historia: [] }])
    )
  ),
}));

const { estadisticasDe } = await import("@/admin/datos/estadisticas");

beforeEach(() => vi.clearAllMocks());

describe("juntar en paralelo", () => {
  it("cuenta las piezas de todo el árbol, incluida la subcarpeta honda", async () => {
    const numeros = await estadisticasDe("raiz");
    // A(2) + B(1) + A1(1) = 4. Si A1 no se recorriera, daría 3; si «Entregas
    // Finales» contara, daría más.
    expect(numeros.piezas).toBe(4);
    expect(numeros.enJuego).toBe(4);
  });

  it("no baja a las carpetas reservadas", async () => {
    const { trabajosDeLaCarpeta } = await import("@/lib/trabajos");
    await estadisticasDe("raiz");
    const visitadas = vi.mocked(trabajosDeLaCarpeta).mock.calls.map((c) => c[0]);
    expect(visitadas).not.toContain("fin");
    expect(new Set(visitadas)).toEqual(new Set(["A", "B", "A1"]));
  });
});
