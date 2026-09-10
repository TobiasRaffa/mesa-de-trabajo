import { describe, expect, it } from "vitest";
import { diasValidos, DIAS_POR_OMISION, plazoQueCorre } from "@/lib/dias";

describe("diasValidos", () => {
  it("acepta de 1 a 30", () => {
    expect(diasValidos(1)).toBe(true);
    expect(diasValidos(3)).toBe(true);
    expect(diasValidos(30)).toBe(true);
  });

  it.each([0, -1, 31, 100, 2.5, NaN, Infinity])("rechaza %s", (mal) => {
    expect(diasValidos(mal)).toBe(false);
  });

  it.each(["3", null, undefined, {}, []])("rechaza lo que no es número", (mal) => {
    expect(diasValidos(mal)).toBe(false);
  });
});

describe("plazoQueCorre", () => {
  it("sin nada puesto, usa el de omisión", () => {
    expect(plazoQueCorre(undefined, undefined, undefined)).toBe(DIAS_POR_OMISION);
  });

  it("el del cliente se hereda hacia abajo", () => {
    expect(plazoQueCorre(undefined, undefined, 7)).toBe(7);
  });

  it("el de la carpeta le gana al del cliente", () => {
    expect(plazoQueCorre(undefined, 2, 7)).toBe(2);
  });

  it("el del archivo le gana a todos", () => {
    // Es la regla que se pidió: si la cambio a mano, toma esa.
    expect(plazoQueCorre(1, 2, 7)).toBe(1);
  });

  it("un cero puesto a mano no se confunde con «sin poner»", () => {
    // `??` y no `||`: con `||`, un cero caería al de arriba en silencio.
    expect(plazoQueCorre(0, 5, 9)).toBe(0);
  });
});
