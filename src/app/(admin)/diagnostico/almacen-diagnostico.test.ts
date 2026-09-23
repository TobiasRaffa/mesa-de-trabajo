import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/almacen", () => ({ dondeSeGuarda: "archivos" }));
vi.mock("@/lib/entorno", () => ({ variablesFaltantes: () => [] }));
vi.mock("@/admin/datos/clientes", () => ({ misClientes: async () => [{ id: "cli1" }] }));
vi.mock("@/lib/miniaturas", () => ({ urlDeMiniatura: () => "/m" }));
vi.mock("@/lib/google", () => ({ listarCarpeta: vi.fn(), leerComentarios: vi.fn() }));

const { listarCarpeta, leerComentarios } = await import("@/lib/google");
const { default: Diagnostico } = await import("@/app/(admin)/diagnostico/page");

let registrado: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(listarCarpeta).mockReset();
  vi.mocked(leerComentarios).mockReset();
  registrado = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("lo que la pantalla manda a buscar en los registros", () => {
  // **La pantalla dice «el motivo quedó en los registros del servidor»**, y no
  // quedaba en ningún lado: la única pantalla hecha para saber por qué no anda
  // Drive escondía el porqué.
  it("si Drive no contesta, el motivo se registra", async () => {
    vi.mocked(listarCarpeta).mockRejectedValue(new Error("Drive: File not found"));

    await Diagnostico();

    expect(registrado).toHaveBeenCalled();
    expect(registrado.mock.calls.flat().map(String).join(" ")).toContain("File not found");
  });

  it("si no se leen los comentarios, el motivo se registra", async () => {
    vi.mocked(listarCarpeta).mockResolvedValue([
      { id: "f1", name: "afiche.pdf", mimeType: "application/pdf" },
    ] as never);
    vi.mocked(leerComentarios).mockResolvedValue({ ok: false, motivo: "insufficientPermissions" });

    await Diagnostico();

    expect(registrado.mock.calls.flat().map(String).join(" ")).toContain(
      "insufficientPermissions"
    );
  });
});
