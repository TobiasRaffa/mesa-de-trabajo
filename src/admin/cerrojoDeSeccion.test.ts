import { beforeEach, describe, expect, it, vi } from "vitest";

// El segundo cerrojo de las acciones que no son de Admin, probado en vivo.
//
// Una server action se invoca desde cualquier ruta —el `Next-Action` la
// encuentra por su identificador, no por la dirección del POST—, así que la
// separación por sección de la puerta no la alcanza. Cada acción vuelve a
// preguntar con `puedoAlgunaDe`. Acá se comprueba que **de verdad frena**: con
// la sección, pasa; sin ella, contesta «no es tuyo» antes de tocar nada.

const { puedoAlgunaDe, esClienteReal, contenidoDe } = vi.hoisted(() => ({
  puedoAlgunaDe: vi.fn(async () => true),
  esClienteReal: vi.fn(async () => true),
  contenidoDe: vi.fn(async () => ({ carpetas: [], archivos: [] })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/sesion", () => ({
  puedoAlgunaDe,
  puedoVer: vi.fn(async () => true),
  firmaDeAgencia: vi.fn(async () => "El equipo"),
  contrasenaDeQuienEsta: vi.fn(async () => true),
}));

vi.mock("@/admin/datos/clientes", () => ({
  esClienteReal,
  misClientes: vi.fn(async () => [{ id: "cliente" }]),
  // Los apagados también: es lo que mira `esClienteReal` de las acciones, para
  // que apagar un cliente no sea un camino de ida.
  todosMisClientes: vi.fn(async () => [{ id: "cliente" }]),
  esCarpetaMia: vi.fn(async () => true),
  clienteDeMiCarpeta: vi.fn(async () => ({ id: "cliente" })),
  miCliente: vi.fn(async () => ({ id: "cliente" })),
  misCarpetas: vi.fn(async () => new Set<string>()),
}));

vi.mock("@/admin/datos/arbol", () => ({
  contenidoDe,
  heredadoDelCliente: vi.fn(async () => ({ dias: 1, responsable: null })),
}));

import { abrirCliente } from "@/app/(admin)/gestion/acciones";

beforeEach(() => {
  puedoAlgunaDe.mockReset();
  esClienteReal.mockReset();
  esClienteReal.mockResolvedValue(true);
  contenidoDe.mockClear();
});

describe("el cerrojo de sección de las acciones", () => {
  it("frena a quien no entra a la sección, antes de tocar el cliente", async () => {
    puedoAlgunaDe.mockResolvedValue(false);

    const r = await abrirCliente("cliente");

    expect(r.ok).toBe(false);
    // No llegó siquiera a mirar si el cliente existe: el cerrojo va primero.
    expect(esClienteReal).not.toHaveBeenCalled();
    expect(contenidoDe).not.toHaveBeenCalled();
  });

  it("deja pasar a quien sí entra a la sección", async () => {
    puedoAlgunaDe.mockResolvedValue(true);

    const r = await abrirCliente("cliente");

    expect(r.ok).toBe(true);
    expect(contenidoDe).toHaveBeenCalled();
  });
});
