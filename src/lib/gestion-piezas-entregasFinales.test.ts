import { beforeEach, describe, expect, it, vi } from "vitest";

// Drive se reemplaza por un doble: se prueba qué decide la vuelta desde
// «Entregas finales», no la conexión con Google.
vi.mock("@/lib/google", () => ({
  subcarpetasDe: vi.fn(),
  metadatosArchivo: vi.fn(),
  moverArchivo: vi.fn(async () => ({})),
}));

import { metadatosArchivo, moverArchivo, subcarpetasDe } from "@/lib/google";
import { devolverDesdeFinales } from "@/lib/entregasFinales";

const carpetas = vi.mocked(subcarpetasDe);
const metadatos = vi.mocked(metadatosArchivo);
const mover = vi.mocked(moverArchivo);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("devolver desde «Entregas finales»", () => {
  it("si el archivo ya está en su carpeta, está devuelto aunque no haya «Entregas finales»", async () => {
    // **Preguntaba por la carpeta de finales antes de mirar dónde estaba el
    // archivo.** Si alguien lo devolvió a mano y después borró o renombró
    // «Entregas finales», contestaba que no se pudo: la pieza reabierta quedaba
    // `mudada` y el portal la escondía, con el plazo corriendo igual.
    carpetas.mockResolvedValue([{ id: "t1", name: "Trabajo" }] as never);
    metadatos.mockResolvedValue({ id: "F", name: "stickers.jpg", mimeType: "image/jpeg", parents: ["t1"] });

    expect(await devolverDesdeFinales("cli", "F", "t1")).toEqual({ movida: true });
    expect(mover).not.toHaveBeenCalled();
  });

  it("sin «Entregas finales» y con el archivo en otro lado, sigue diciendo que no", async () => {
    carpetas.mockResolvedValue([{ id: "t1", name: "Trabajo" }] as never);
    metadatos.mockResolvedValue({ id: "F", name: "stickers.jpg", mimeType: "image/jpeg", parents: ["otra"] });

    const r = await devolverDesdeFinales("cli", "F", "t1");
    expect(r.movida).toBe(false);
    expect(mover).not.toHaveBeenCalled();
  });

  it("desde «Entregas finales» lo mueve a su carpeta", async () => {
    carpetas.mockResolvedValue([
      { id: "t1", name: "Trabajo" },
      { id: "fin", name: "Entregas finales" },
    ] as never);
    metadatos.mockResolvedValue({ id: "F", name: "stickers.jpg", mimeType: "image/jpeg", parents: ["fin"] });

    expect(await devolverDesdeFinales("cli", "F", "t1")).toEqual({ movida: true });
    expect(mover).toHaveBeenCalledWith("F", "fin", "t1");
  });
});
