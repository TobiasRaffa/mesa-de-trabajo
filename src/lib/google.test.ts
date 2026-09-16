import { describe, expect, it } from "vitest";
import { hojaDelAncla } from "@/lib/google";

// `anchor` es, por contrato de Google, una cadena opaca: dice que representa
// una región del archivo y no promete ninguna forma. Estas pruebas fijan la
// única promesa que sí hacemos nosotros: **o sale la hoja correcta, o no sale
// nada**. Una hoja inventada manda a mirar la página equivocada con la misma
// seguridad que si estuviera bien, y eso es peor que no decirla.

describe("en qué hoja del PDF está un comentario", () => {
  it("la saca de la forma que usa Drive hoy", () => {
    expect(hojaDelAncla('{"r":"head","a":[{"page":{"n":7}}]}')).toBe(7);
  });

  it("también si la hoja viene como número suelto", () => {
    expect(hojaDelAncla('{"a":[{"page":3}]}')).toBe(3);
  });

  it("la encuentra por más hondo que esté", () => {
    expect(hojaDelAncla('{"a":[{"x":{"y":[{"pageNumber":12}]}}]}')).toBe(12);
  });

  it("un ancla vacía no dice nada", () => {
    expect(hojaDelAncla("")).toBeUndefined();
  });

  it("un ancla que no es JSON no rompe ni inventa", () => {
    // Pasa con los documentos de Google, donde el ancla es otra cosa.
    expect(hojaDelAncla("kix.abc123")).toBeUndefined();
  });

  it("un ancla sin hoja adentro no inventa una", () => {
    expect(hojaDelAncla('{"r":"head","a":[{"line":{"n":4}}]}')).toBeUndefined();
  });

  it("una hoja cero o negativa se descarta", () => {
    // Las hojas se cuentan desde 1: un cero es que se leyó otra cosa.
    expect(hojaDelAncla('{"a":[{"page":{"n":0}}]}')).toBeUndefined();
    expect(hojaDelAncla('{"a":[{"page":-2}]}')).toBeUndefined();
  });

  it("una hoja que no es entera se descarta", () => {
    expect(hojaDelAncla('{"a":[{"page":2.5}]}')).toBeUndefined();
  });
});
