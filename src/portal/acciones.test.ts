import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Qué puede hacer el cliente y qué queda anotado viven en una sola tabla.
// Esta prueba mira el archivo y no lo importa a propósito: importarlo arrastra
// Drive, el almacén y las galletas, y lo que hay que comprobar es una decisión
// escrita, no un comportamiento.
const FUENTE = readFileSync(
  path.join(process.cwd(), "src", "portal", "acciones.ts"),
  "utf8"
);

describe("lo que el cliente puede hacer queda anotado", () => {
  const tabla = FUENTE.slice(
    FUENTE.indexOf("const DESDE_EL_PORTAL"),
    FUENTE.indexOf("};", FUENTE.indexOf("const DESDE_EL_PORTAL"))
  );

  it("cada acción del cliente dice qué anota, aunque sea nada", () => {
    // Pedir una revisión adicional estaba permitido y no se anotaba: la pieza
    // pasaba a esperar una decisión de la agencia —que puede costar plata— sin
    // dejar rastro de quién la pidió ni cuándo.
    const decididos = [...tabla.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
    expect(decididos).toEqual([
      "abrir",
      "aprobar",
      "pedir_cambios",
      "descartar_cambios",
      "pedir_revision_extra",
      "cerrar_revision",
    ]);
  });

  it("las que cambian algo dejan rastro", () => {
    // `abrir` y `cerrar_revision` son las dos excepciones, y las dos están
    // explicadas al lado: una es ruido, la otra la anota quien la cierra.
    for (const accion of ["aprobar", "pedir_cambios", "descartar_cambios", "pedir_revision_extra"]) {
      expect(tabla, `«${accion}» tiene que anotar algo`).toContain(`${accion}: "`);
    }
  });

  it("no quedó ningún «if» suelto decidiendo lo mismo", () => {
    // Eran cuatro condiciones separadas de la lista de permitidos, y por eso
    // se desincronizaron. Si vuelven, esta prueba avisa.
    expect(FUENTE).not.toMatch(/if \(evento\.tipo === "[^"]+"\) pieza = anotar/);
  });
});
