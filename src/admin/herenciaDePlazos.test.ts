// A qué se le pone el plazo, y qué queda heredando de nuevo debajo.
//
// **Una pieza no es un archivo de Drive, y confundirlos rompía esto entero.**
// `nivelReal` comprobaba el identificador que llegaba de la pantalla contra los
// archivos crudos de la carpeta —los que devuelve Drive, con el identificador
// que les puso Google—, pero lo que viaja por la aplicación es la identidad de
// la pieza, `carpeta::nombre`, que junta todas sus vueltas en una sola cosa. Un
// identificador de Drive nunca lleva `::`, así que la comparación daba **siempre
// que no**: poner días o responsable a una pieza suelta fallaba siempre, y el
// «borra lo que haya debajo» no borraba nada, en silencio.
//
// Convivió con 634 pruebas en verde porque no había ninguna que llamara a esto.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { ponerPlazo, piezasDeLaCarpeta, esCarpetaMia, subcarpetasDe } = vi.hoisted(() => ({
  ponerPlazo: vi.fn(async () => {}),
  piezasDeLaCarpeta: vi.fn(),
  esCarpetaMia: vi.fn(async () => true),
  // Drive: por omisión, ninguna carpeta tiene subcarpetas.
  subcarpetasDe: vi.fn(async (_id: string): Promise<Array<{ id: string; name: string }>> => []),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/google", async (original) => ({
  ...(await original<typeof import("@/lib/google")>()),
  subcarpetasDe,
}));

vi.mock("@/lib/sesion", () => ({
  puedoAlgunaDe: vi.fn(async () => true),
  puedoVer: vi.fn(async () => true),
  firmaDeAgencia: vi.fn(async () => "El equipo"),
  contrasenaDeQuienEsta: vi.fn(async () => true),
}));

vi.mock("@/admin/datos/clientes", () => ({
  esCarpetaMia,
  esClienteReal: vi.fn(async () => true),
  misClientes: vi.fn(async () => [{ id: "cliente" }]),
  todosMisClientes: vi.fn(async () => [{ id: "cliente" }]),
  clienteDeMiCarpeta: vi.fn(async () => ({ id: "cliente" })),
  esDeMisClientes: vi.fn(async () => true),
  miCliente: vi.fn(async () => ({ id: "cliente" })),
  misAvisos: vi.fn(async () => []),
  misCarpetas: vi.fn(async () => new Set<string>()),
}));

// `agruparVersiones` y `conSusArchivos` quedan de verdad: **la identidad se
// calcula como en producción**, que es justo lo que esta prueba mira.
vi.mock("@/lib/piezas", async (original) => ({
  ...(await original<typeof import("@/lib/piezas")>()),
  piezasDeLaCarpeta,
}));

vi.mock("@/lib/plazos", async (original) => ({
  ...(await original<typeof import("@/lib/plazos")>()),
  ponerPlazo,
}));

const { guardarDiasDeRevision } = await import("@/app/(admin)/gestion/acciones");

const CARPETA = "carpeta-de-trabajo";

/** Drive devuelve archivos: dos vueltas de una pieza, y otra pieza aparte. */
function conArchivos(nombres: string[]) {
  piezasDeLaCarpeta.mockResolvedValue(
    nombres.map((name, i) => ({
      id: `drive-${i}`,
      name,
      mimeType: "image/jpeg",
      modifiedTime: "2026-09-01T10:00:00Z",
    }))
  );
}

beforeEach(() => {
  ponerPlazo.mockClear();
  esCarpetaMia.mockResolvedValue(true);
  subcarpetasDe.mockReset();
  subcarpetasDe.mockResolvedValue([]);
});

describe("ponerle el plazo a una pieza suelta", () => {
  it("acepta la identidad de la pieza, que es lo que manda la pantalla", async () => {
    conArchivos(["stickers.jpg", "V2 stickers.jpg"]);

    const r = await guardarDiasDeRevision("archivo", `${CARPETA}::stickers.jpg`, 7, CARPETA);

    expect(
      r.ok,
      "La pantalla manda `carpeta::nombre`, no un identificador de Drive."
    ).toBe(true);
    expect(ponerPlazo).toHaveBeenCalledWith(`${CARPETA}::stickers.jpg`, 7, []);
  });

  it("rechaza una pieza que no está en esa carpeta", async () => {
    conArchivos(["stickers.jpg"]);

    const r = await guardarDiasDeRevision("archivo", `${CARPETA}::banner.png`, 7, CARPETA);

    expect(r.ok).toBe(false);
    expect(ponerPlazo).not.toHaveBeenCalled();
  });

  it("rechaza un identificador de Drive, que ya no es lo que se usa", async () => {
    conArchivos(["stickers.jpg"]);

    const r = await guardarDiasDeRevision("archivo", "drive-0", 7, CARPETA);

    expect(r.ok).toBe(false);
  });
});

describe("el plazo de la carpeta borra lo que haya puesto debajo", () => {
  it("lo de abajo son las piezas, una por nombre y no una por archivo", async () => {
    // Dos vueltas de «stickers» y una de «banner»: **dos** piezas, tres
    // archivos. Pasando identificadores de Drive se mandaban tres cosas que no
    // existen, y los plazos propios de las piezas quedaban intactos.
    conArchivos(["stickers.jpg", "V2 stickers.jpg", "banner.png"]);

    const r = await guardarDiasDeRevision("carpeta", CARPETA, 10);

    expect(r.ok).toBe(true);
    const [, , debajo] = ponerPlazo.mock.calls[0] as unknown as [string, number, string[]];
    expect([...debajo].sort()).toEqual([`${CARPETA}::banner.png`, `${CARPETA}::stickers.jpg`]);
  });
});

describe("lo de arriba borra lo de abajo, a cualquier hondura", () => {
  // **`nivelReal` bajaba un solo escalón.** Para el cliente juntaba sus
  // carpetas y las piezas de cada una; para una carpeta, solo sus piezas. Una
  // subcarpeta de segundo nivel —«Banners / Septiembre»— y lo de adentro
  // quedaban con el plazo o el responsable viejo, y nada en la pantalla decía
  // de dónde salía.
  //
  // Drive: cliente → b (con logo.png) → s (con post.png).
  beforeEach(() => {
    subcarpetasDe.mockImplementation(async (id: string) =>
      id === "cliente" ? [{ id: "b", name: "Banners" }] : id === "b" ? [{ id: "s", name: "Septiembre" }] : []
    );
    piezasDeLaCarpeta.mockImplementation(async (id: string) =>
      id === "b"
        ? [{ id: "d-logo", name: "logo.png", mimeType: "image/png" }]
        : id === "s"
          ? [{ id: "d-post", name: "post.png", mimeType: "image/png" }]
          : []
    );
  });

  it("el plazo del cliente deja heredando también a la subcarpeta de segundo nivel", async () => {
    const r = await guardarDiasDeRevision("cliente", "cliente", 5);

    expect(r.ok).toBe(true);
    const [, , debajo] = ponerPlazo.mock.calls[0] as unknown as [string, number, string[]];
    expect([...debajo].sort()).toEqual(["b", "b::logo.png", "s", "s::post.png"]);
  });

  it("el de una carpeta, a sus subcarpetas y a lo que tienen adentro", async () => {
    const r = await guardarDiasDeRevision("carpeta", "b", 5);

    expect(r.ok).toBe(true);
    const [, , debajo] = ponerPlazo.mock.calls[0] as unknown as [string, number, string[]];
    expect([...debajo].sort()).toEqual(["b::logo.png", "s", "s::post.png"]);
  });
});
