import { describe, expect, it } from "vitest";
import {
  agruparVersiones,
  hastaLoEntregado,
  leerNombre,
  rarezasDeNombres,
} from "@/lib/versiones";

const a = (id: string, name: string) => ({ id, name });
const pieza = (...nombres: string[]) =>
  agruparVersiones(nombres.map((n, i) => a(`f${i}`, n)));

describe("lo que se le muestra al cliente: hasta lo entregado", () => {
  const [stickers] = pieza("stickers.jpg", "stickers V2.jpg", "stickers V3.jpg");

  it("sin nada entregado, todas", () => {
    expect(hastaLoEntregado(stickers.versiones, {}).map((v) => v.numero)).toEqual([1, 2, 3]);
  });

  it("por número, las que no pasan de la entregada", () => {
    expect(hastaLoEntregado(stickers.versiones, { version: 2 }).map((v) => v.numero)).toEqual([1, 2]);
  });

  it("con el archivo entregado, ese y lo anterior, aunque otro diga el mismo número", () => {
    // Se entregó «9304 V2.jpeg» (f1) y después alguien subió otro que también
    // dice ser la V2. Por número el cliente veía el nuevo, que nadie le entregó.
    const [p] = pieza("9304.jpeg", "9304 V2.jpeg", "V2 9304.jpeg");
    const vistas = hastaLoEntregado(p.versiones, { version: 2, archivo: "f1" });
    expect(vistas.map((v) => v.archivo.id)).toEqual(["f0", "f1"]);
    expect(hastaLoEntregado(p.versiones, { version: 2 }).at(-1)!.archivo.id).toBe("f2");
  });

  it("si el archivo entregado ya no está, vuelve al número", () => {
    expect(
      hastaLoEntregado(stickers.versiones, { version: 2, archivo: "borrado" }).map((v) => v.numero)
    ).toEqual([1, 2]);
  });
});

describe("lo raro en los nombres", () => {
  it("una pieza normal no tiene nada raro", () => {
    expect(rarezasDeNombres(pieza("a.jpg", "V2 a.jpg", "a V3.jpg")[0].versiones)).toEqual({});
  });

  it("dos archivos que dicen ser la misma vuelta", () => {
    const r = rarezasDeNombres(pieza("9304.jpeg", "9304 V1.jpeg")[0].versiones);
    expect(r.repetida).toEqual({
      numero: 1,
      nombres: ["9304.jpeg", "9304 V1.jpeg"],
      tomada: "9304 V1.jpeg",
    });
  });

  it("la misma vuelta en dos formatos también se avisa", () => {
    const r = rarezasDeNombres(pieza("banner.pdf", "V2 banner.pdf", "V2 banner.jpg")[0].versiones);
    expect(r.repetida?.numero).toBe(2);
  });

  it("un número que es parte del nombre: «Hario V60» y «V4x4 camioneta»", () => {
    expect(rarezasDeNombres(pieza("Hario V60.jpg")[0].versiones).salto).toEqual({
      desde: null,
      hasta: 60,
      nombre: "Hario V60.jpg",
    });
    expect(rarezasDeNombres(pieza("V4x4 camioneta.jpg")[0].versiones).salto?.hasta).toBe(4);
  });

  it("un salto grande entre vueltas", () => {
    expect(rarezasDeNombres(pieza("a.jpg", "V5 a.jpg")[0].versiones).salto).toEqual({
      desde: 1,
      hasta: 5,
      nombre: "V5 a.jpg",
    });
    // Saltear una sola es un descuido común: no se avisa.
    expect(rarezasDeNombres(pieza("a.jpg", "V3 a.jpg")[0].versiones).salto).toBeUndefined();
    expect(rarezasDeNombres(pieza("V2 a.jpg")[0].versiones).salto).toBeUndefined();
  });

  it("lo que se sugiere para arreglarlo de verdad deja de leerse como vuelta", () => {
    expect(leerNombre("Hario V-60.jpg").marcado).toBe(false);
    expect(leerNombre("V-4x4 camioneta.jpg").marcado).toBe(false);
  });
});
