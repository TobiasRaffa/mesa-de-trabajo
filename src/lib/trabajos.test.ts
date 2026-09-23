// Cómo se arman los trabajos de una carpeta cuando las vueltas se asignan a
// mano: el nombre sugiere, una persona decide.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { armarTrabajos, type Asignacion } from "@/lib/versiones";

const a = (id: string, name: string) => ({ id, name });
const armar = (archivos: Array<{ id: string; name: string }>, asignadas: Record<string, Asignacion> = {}) =>
  armarTrabajos(archivos, new Map(Object.entries(asignadas)));
const resumen = (r: ReturnType<typeof armar>) => ({
  trabajos: r.agrupadas.map((p) => [p.base, p.versiones.map((v) => `${v.archivo.id}:v${v.numero}`)]),
  pendientes: r.pendientes.map((p) => [p.archivo.id, p.numero, p.sugerida]),
});

describe("una V2 no se suma sola", () => {
  it("aunque el nombre coincida, espera; el nombre queda como sugerencia", () => {
    expect(resumen(armar([a("f1", "logo.jpg"), a("f2", "V2 logo.jpg")]))).toEqual({
      trabajos: [["logo.jpg", ["f1:v1"]]],
      pendientes: [["f2", 2, "logo.jpg"]],
    });
  });

  it("una que no coincide con nada espera sin sugerencia", () => {
    expect(resumen(armar([a("f1", "logo.jpg"), a("f2", "V2 banner.jpg")])).pendientes).toEqual([
      ["f2", 2, undefined],
    ]);
  });

  it("un archivo sin marca, o marcado V1, funda su trabajo como siempre", () => {
    expect(resumen(armar([a("f1", "logo.jpg"), a("f2", "V1_banner.pdf")])).trabajos).toEqual([
      ["logo.jpg", ["f1:v1"]],
      ["banner.pdf", ["f2:v1"]],
    ]);
  });
});

describe("asignada, es de ese trabajo y se le sigue el rastro", () => {
  const logo = { pieza: "logo.jpg", raices: ["f1"] };

  it("se suma con el número que se anotó", () => {
    const r = armar([a("f1", "logo.jpg"), a("f2", "V2 logo final.jpg")], {
      f2: { ...logo, version: 2 },
    });
    expect(resumen(r)).toEqual({ trabajos: [["logo.jpg", ["f1:v1", "f2:v2"]]], pendientes: [] });
  });

  it("si después renombran la V1, la V2 la sigue", () => {
    const r = armar([a("f1", "logo nuevo.jpg"), a("f2", "V2 logo.jpg")], { f2: { ...logo, version: 2 } });
    expect(resumen(r).trabajos).toEqual([["logo nuevo.jpg", ["f1:v1", "f2:v2"]]]);
  });

  it("si borran la V1, la V2 sigue siendo de «logo»: el trabajo no cambia de nombre", () => {
    const r = armar([a("f2", "V2 logo final.jpg")], { f2: { ...logo, version: 2 } });
    expect(resumen(r).trabajos).toEqual([["logo.jpg", ["f2:v2"]]]);
  });

  it("si la renombran, sigue siendo la misma vuelta del mismo trabajo", () => {
    const r = armar([a("f1", "logo.jpg"), a("f2", "V7 otra cosa.jpg")], { f2: { ...logo, version: 2 } });
    expect(resumen(r).trabajos).toEqual([["logo.jpg", ["f1:v1", "f2:v2"]]]);
  });

  it("«no es una vuelta»: la marca es parte del nombre y es un trabajo propio", () => {
    const r = armar([a("f1", "Hario V60.jpg")], { f1: { pieza: null } });
    expect(resumen(r)).toEqual({ trabajos: [["Hario V60.jpg", ["f1:v1"]]], pendientes: [] });
    expect(r.agrupadas[0].titulo).toBe("Hario V60");
  });

  it("un archivo sin marca también se puede sumar a otro trabajo (unirlos)", () => {
    const r = armar([a("f1", "stickers.pdf"), a("f2", "stickers.jpeg")], {
      f2: { pieza: "stickers.pdf", raices: ["f1"], version: 2 },
    });
    expect(resumen(r).trabajos).toEqual([["stickers.pdf", ["f1:v1", "f2:v2"]]]);
  });
});

// --- Lo que ya estaba sumado antes de que las vueltas se asignaran a mano ---

vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);
const drive = vi.hoisted(() => ({ archivos: [] as Array<{ id: string; name: string; mimeType: string }> }));
vi.mock("@/lib/google", async (original) => ({
  ...(await original<typeof import("@/lib/google")>()),
  archivosDe: vi.fn(async () => drive.archivos),
}));

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const { trabajosDeLaCarpeta } = await import("@/lib/trabajos");
const { asignarVuelta } = await import("@/lib/asignaciones");

const ficha = (archivos: string[]) => ({
  carpetaId: "c",
  estado: "entregada",
  ronda: 0,
  rondasExtra: 0,
  cambios: [],
  enviada: false,
  mudada: false,
  archivos,
  historia: [],
});

beforeEach(() => memoriaDePruebas.vaciar());

describe("las vueltas que ya estaban sumadas", () => {
  it("siguen en su trabajo: estar anotada en la pieza es estar asignada", async () => {
    drive.archivos = [
      { id: "f1", name: "logo.jpg", mimeType: "image/jpeg" },
      { id: "f2", name: "V2 logo.jpg", mimeType: "image/jpeg" },
      { id: "f3", name: "V3 logo.jpg", mimeType: "image/jpeg" },
    ];
    memoriaDePruebas.ver("piezas")["c::logo.jpg"] = ficha(["f1", "f2"]);

    const { agrupadas, pendientes } = await trabajosDeLaCarpeta("c");
    expect(agrupadas[0].versiones.map((v) => v.archivo.id)).toEqual(["f1", "f2"]);
    // La V3 es nueva: esa sí espera.
    expect(pendientes.map((p) => p.archivo.id)).toEqual(["f3"]);
  });

  it("lo que decidió una persona manda sobre lo anotado", async () => {
    drive.archivos = [
      { id: "f1", name: "logo.jpg", mimeType: "image/jpeg" },
      { id: "f2", name: "V2 logo.jpg", mimeType: "image/jpeg" },
    ];
    memoriaDePruebas.ver("piezas")["c::logo.jpg"] = ficha(["f1", "f2"]);
    await asignarVuelta("c", "f2", { pieza: null }, "Nari");

    const { agrupadas } = await trabajosDeLaCarpeta("c");
    expect(agrupadas.map((p) => p.base)).toEqual(["logo.jpg", "V2 logo.jpg"]);
  });
});
