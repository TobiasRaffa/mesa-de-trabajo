import { beforeEach, describe, expect, it, vi } from "vitest";

// Drive se reemplaza por un doble: se prueba una sola decisión —lo que está en
// la papelera ya no es una pieza—, no la conexión con Google.
// La carpeta de trabajo, en Drive, está vacía: lo único que aparece es lo mudado.
vi.mock("@/lib/google", () => ({ archivosDe: vi.fn(async () => []), metadatosArchivo: vi.fn() }));
vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const guardado = memoriaDePruebas.ver("piezas");

import { metadatosArchivo } from "@/lib/google";
const { piezasDeLaCarpeta } = await import("@/lib/piezas");

const pedir = vi.mocked(metadatosArchivo);

const CARPETA = "trabajo";

/** Una pieza aprobada cuyo archivo la aplicación mudó a «Entregas finales». */
function mudada(archivo: string) {
  guardado[`${CARPETA}::${archivo}.pdf`] = {
    carpetaId: CARPETA,
    estado: "final",
    ronda: 1,
    rondasExtra: 0,
    cambios: [],
    enviada: false,
    mudada: true,
    archivoMudado: archivo,
    historia: [],
  };
}

const archivo = (id: string, trashed?: boolean) =>
  ({ id, name: `${id}.pdf`, mimeType: "application/pdf", parents: ["finales"], trashed }) as never;

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
  vi.clearAllMocks();
});

describe("lo mudado que después se tiró a la papelera", () => {
  it("no vuelve a aparecer como pieza de su carpeta", async () => {
    mudada("tirado");
    pedir.mockResolvedValue(archivo("tirado", true));

    expect(await piezasDeLaCarpeta(CARPETA)).toEqual([]);
  });

  it("lo mudado que sigue en Drive sí aparece", async () => {
    mudada("vivo");
    pedir.mockResolvedValue(archivo("vivo", false));

    expect((await piezasDeLaCarpeta(CARPETA)).map((a) => a.id)).toEqual(["vivo"]);
  });
});
