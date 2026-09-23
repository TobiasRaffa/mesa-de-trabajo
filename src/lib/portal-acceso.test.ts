// Por dónde entró un navegador con links de carpeta.
//
// Dos cosas que pasaron:
//
//   - **Apagar una carpeta no cortaba a quien ya había entrado.** La puerta
//     dejaba de abrir, pero con la galleta —dura treinta días— las acciones,
//     los archivos y el chat seguían andando.
//   - **Con dos links de carpeta del mismo cliente, valía solo el primero.** Las
//     dos carpetas abrían, pero en la segunda todo contestaba «No encontramos
//     esa carpeta.».

import { beforeEach, describe, expect, it, vi } from "vitest";

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);

vi.mock("@/lib/clientes", () => ({
  clientesHabilitados: vi.fn(async () => [
    { id: "cli", nombre: "Cafe Otono", habilitado: true, token: "token-del-cliente", tag: "t" },
  ]),
}));
vi.mock("@/lib/google", () => ({
  subcarpetasDe: vi.fn(async (id: string) =>
    id === "cli"
      ? [
          { id: "sept", name: "Septiembre" },
          { id: "oct", name: "Octubre" },
        ]
      : []
  ),
}));

const { entradaDe, nombreDeGalleta, valorDeGalleta } = await import("@/lib/acceso");
const { linkDeCarpeta, mostrarUOcultar } = await import("@/lib/ajustes");

/** Un frasco de galletas con las de estos links, firmadas como las firma la puerta. */
async function galletasDe(...tokens: string[]) {
  const frasco = new Map<string, { value: string }>();
  for (const token of tokens) {
    frasco.set(await nombreDeGalleta(token), { value: await valorDeGalleta(token) });
  }
  return { get: (nombre: string) => frasco.get(nombre) };
}

beforeEach(() => {
  const ajustes = memoriaDePruebas.ver("ajustes");
  for (const k of Object.keys(ajustes)) delete ajustes[k];
});

describe("apagar una carpeta corta también a quien ya entró", () => {
  it("con la carpeta escondida, la galleta de su link ya no abre nada", async () => {
    const token = await linkDeCarpeta("sept");
    const galletas = await galletasDe(token);
    expect((await entradaDe(galletas))?.carpeta).toBe("sept");

    await mostrarUOcultar("sept", false);

    expect(
      await entradaDe(galletas),
      "La puerta ya no abre; las acciones y /api tampoco pueden."
    ).toBeNull();
  });
});

describe("dos links de carpeta del mismo cliente", () => {
  it("la entrada lleva las dos carpetas, no solo la primera", async () => {
    const tSept = await linkDeCarpeta("sept");
    const tOct = await linkDeCarpeta("oct");

    const entrada = await entradaDe(await galletasDe(tSept, tOct));

    expect(entrada?.cliente.id).toBe("cli");
    expect([...(entrada?.carpetas ?? [])].sort()).toEqual(["oct", "sept"]);
    // La primera sigue siendo la de siempre, para quien todavía mire una sola.
    expect(entrada?.carpetas).toContain(entrada?.carpeta);
  });

  it("una de las dos escondida: queda la otra", async () => {
    const tSept = await linkDeCarpeta("sept");
    const tOct = await linkDeCarpeta("oct");
    await mostrarUOcultar("sept", false);

    const entrada = await entradaDe(await galletasDe(tSept, tOct));
    expect(entrada?.carpeta).toBe("oct");
    expect(entrada?.carpetas).toEqual(["oct"]);
  });
});
