import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guardia contra una hoja de estilos vacía o mutilada.
//
// Existe porque pasó: un script mal escrito abrió globals.css en modo escritura
// antes de leerlo, lo dejó en dos bytes, y la aplicación siguió compilando sin
// una sola advertencia. La pantalla se veía como una página de 1995 y nada en
// las herramientas decía por qué.
//
// Es el peor tipo de error: silencioso, y sin nada que lo detecte. Estas
// comprobaciones tardan un milisegundo y cierran esa puerta.

const CSS = readFileSync(join(import.meta.dirname, "globals.css"), "utf8");

describe("globals.css", () => {
  it("no está vacío ni mutilado", () => {
    expect(CSS.length).toBeGreaterThan(1000);
  });

  it("importa Tailwind", () => {
    expect(CSS).toContain('@import "tailwindcss"');
  });

  it("le dice a Tailwind dónde mirar", () => {
    // Sin esto, las clases que solo se usan en los grupos de rutas --(portal),
    // [token]-- no se generan, y la pantalla se ve a medio armar.
    expect(CSS).toContain("@source");
  });

  it("define el sistema visual", () => {
    expect(CSS).toContain("@theme");
    for (const token of [
      "--color-papel",
      "--color-tinta",
      "--color-acento",
      "--color-espera",
      "--color-listo",
      "--spacing-toque",
    ]) {
      expect(CSS, `falta el token ${token}`).toContain(token);
    }
  });

  it("respeta a quien pidió menos movimiento", () => {
    expect(CSS).toContain("prefers-reduced-motion");
  });

  it("deja libre el borde de la pantalla del teléfono", () => {
    expect(CSS).toContain("safe-area-inset");
  });
});
