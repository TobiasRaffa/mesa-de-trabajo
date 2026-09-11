import { beforeEach, describe, expect, it, vi } from "vitest";

// Drive y el almacén se reemplazan por dobles: acá se prueba **qué hace la
// acción con lo que le llega**, no la conexión con Google.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/carpetas", () => ({
  esCarpetaDelCliente: vi.fn(async () => true),
  esCarpetaReservada: vi.fn(() => false),
  idsDeCarpetasReales: vi.fn(async () => new Set<string>()),
  olvidarCarpetas: vi.fn(),
  clienteDeCarpeta: vi.fn(async () => null),
}));
vi.mock("@/lib/piezas", () => ({ piezasDeLaCarpeta: vi.fn() }));
vi.mock("@/lib/publicaciones", async () => {
  const real = await vi.importActual<typeof import("@/lib/publicaciones")>(
    "@/lib/publicaciones"
  );
  return { ...real, guardarPublicaciones: vi.fn(async () => {}) };
});

import { guardarCalendario } from "@/app/(admin)/gestion/acciones";
import { piezasDeLaCarpeta } from "@/lib/piezas";
import { guardarPublicaciones } from "@/lib/publicaciones";

const enLaCarpeta = vi.mocked(piezasDeLaCarpeta);
const guardado = vi.mocked(guardarPublicaciones);

const archivo = (id: string) => ({ id, name: `${id}.jpeg`, mimeType: "image/jpeg" });

/** Cómo se llama una pieza: la carpeta más el nombre sin el sufijo de vuelta. */
const pieza = (nombre: string) => `carpeta-1::${nombre}.jpeg`;

beforeEach(() => {
  enLaCarpeta.mockReset();
  guardado.mockReset();
  guardado.mockResolvedValue(undefined);
});

describe("guardarCalendario", () => {
  it("guarda las fechas de las piezas de la carpeta", async () => {
    enLaCarpeta.mockResolvedValue([archivo("a"), archivo("b")]);

    const r = await guardarCalendario("carpeta-1", [
      { pieza: pieza("a"), dia: "2026-09-18" },
      { pieza: pieza("b"), dia: null },
    ]);

    expect(r.ok).toBe(true);
    expect(guardado).toHaveBeenCalledWith({
      [pieza("a")]: "2026-09-18",
      [pieza("b")]: null,
    });
  });

  /**
   * Este es **el** caso. Aprobar muda el archivo a «Entregas finales», así que
   * el listado crudo de Drive deja de incluirlo. La versión anterior lo
   * salteaba con un `continue` y después contestaba que sí: la pantalla decía
   * «Listo, el cliente ya lo ve así» y no se había guardado nada.
   */
  it("cuenta con las piezas ya aprobadas, que Drive no lista", async () => {
    // `piezasDeLaCarpeta` las incluye; `archivosDe` no. Por eso se usa esta.
    enLaCarpeta.mockResolvedValue([archivo("suelta"), archivo("aprobada")]);

    const r = await guardarCalendario("carpeta-1", [
      { pieza: pieza("aprobada"), dia: "2026-09-18" },
    ]);

    expect(r.ok).toBe(true);
    expect(guardado).toHaveBeenCalledWith({ [pieza("aprobada")]: "2026-09-18" });
  });

  it("NO dice que guardó cuando hay algo que no puede guardar", async () => {
    // Descartar en silencio y contestar que sí es lo peor que puede hacer una
    // acción: el que la usó cree que quedó hecho.
    enLaCarpeta.mockResolvedValue([archivo("a")]);

    const r = await guardarCalendario("carpeta-1", [
      { pieza: pieza("a"), dia: "2026-09-18" },
      { pieza: "carpeta-9::de-otra-carpeta.jpeg", dia: "2026-09-19" },
    ]);

    expect(r.ok).toBe(false);
    expect(guardado).not.toHaveBeenCalled();
  });

  it("rechaza una fecha que no existe, sin guardar nada", async () => {
    enLaCarpeta.mockResolvedValue([archivo("a")]);

    const r = await guardarCalendario("carpeta-1", [
      { pieza: pieza("a"), dia: "2026-02-31" },
    ]);

    expect(r.ok).toBe(false);
    expect(guardado).not.toHaveBeenCalled();
  });

  it("rechaza una tanda absurda de cambios", async () => {
    enLaCarpeta.mockResolvedValue([archivo("a")]);
    const muchos = Array.from({ length: 501 }, () => ({
      pieza: pieza("a"),
      dia: "2026-09-18",
    }));

    const r = await guardarCalendario("carpeta-1", muchos);

    expect(r.ok).toBe(false);
    expect(guardado).not.toHaveBeenCalled();
  });
});
