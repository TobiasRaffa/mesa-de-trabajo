import { describe, expect, it } from "vitest";
import { pasoActual } from "@/ui/Seguimiento";

const INCLUIDAS = 2;

describe("qué versión se le muestra al cliente", () => {
  // **La versión la marca el archivo, no la intención.** Cuando el cliente
  // manda sus cambios, la ronda avanza en el acto —en su propia pantalla,
  // antes incluso de que el servidor conteste— pero la versión siguiente
  // todavía no está hecha. Con la ronda mandando, el cliente apretaba «enviar
  // revisión» sobre la V2 y la pantalla le decía «V3» en el mismo segundo,
  // encima del mismo archivo.
  it.each([
    [1, "V1"],
    [2, "V2"],
    [3, "V3"],
  ])("con %i versiones dice «%s»", (versiones, dice) => {
    expect(pasoActual(versiones, INCLUIDAS, false)).toBe(dice);
  });

  it("aprobada lo tapa todo", () => {
    expect(pasoActual(2, INCLUIDAS, true)).toBe("Aprobada");
  });

  it("sin ninguna versión todavía dice V1", () => {
    // No debería pasar —una pieza sin archivos no se muestra— pero decir «V0»
    // sería peor que decir lo obvio.
    expect(pasoActual(0, INCLUIDAS, false)).toBe("V1");
  });

  it("lo que sale de una revisión adicional se nota", () => {
    // Sigue siendo la V4: lo que cambia es que se aclara de dónde salió, para
    // que el cliente vea que fue algo aparte sin que diga la palabra factura.
    expect(pasoActual(4, INCLUIDAS, false)).toBe("V4 · adicional");
  });
});
