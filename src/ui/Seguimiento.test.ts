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
    [[1], "V1"],
    [[1, 2], "V2"],
    [[1, 2, 3], "V3"],
  ])("con las vueltas %j dice «%s»", (vueltas, dice) => {
    expect(pasoActual(vueltas, 0, INCLUIDAS, false)).toBe(dice);
  });

  it("dice el número del archivo, aunque haya un salto", () => {
    // **Es el nombre que tiene el archivo en Drive.** Se numeraban de corrido
    // para que el cliente no viera huecos, y el precio era peor que el hueco:
    // veía «V4» sobre un archivo llamado «V5_stickers.jpeg», y al hablar con
    // la agencia cada uno nombraba otra cosa.
    expect(pasoActual([1, 2, 4, 5], 0, INCLUIDAS, false)).toBe("V5");
  });

  it("aprobada lo tapa todo", () => {
    expect(pasoActual([1, 2], 0, INCLUIDAS, true)).toBe("Aprobada");
  });

  it("sin ninguna versión todavía dice V1", () => {
    // No debería pasar —una pieza sin archivos no se muestra— pero decir «V0»
    // sería peor que decir lo obvio.
    expect(pasoActual([], 0, INCLUIDAS, false)).toBe("V1");
  });
});

describe("cuándo se aclara que la vuelta es adicional", () => {
  it("cuando el cliente ya gastó las incluidas", () => {
    // Sigue siendo la V4: lo que cambia es que se aclara de dónde salió, para
    // que el cliente vea que fue algo aparte sin que diga la palabra factura.
    expect(pasoActual([1, 2, 3, 4], INCLUIDAS + 1, INCLUIDAS, false)).toBe(
      "V4 · adicional"
    );
  });

  it("y no por cuántos archivos haya", () => {
    // **Salía del número de versión** —«si es la V4 y entraban dos vueltas, la
    // última fue adicional»— y eso da falsos: una pieza que volvió a empezar
    // conserva sus archivos, así que una recién entregada, que el cliente
    // todavía no miró, le aparecía como «adicional».
    expect(
      pasoActual([1, 2, 3, 4], 0, INCLUIDAS, false),
      "Nadie pidió ninguna vuelta todavía: no puede haber una adicional."
    ).toBe("V4");
  });

  it("en la última incluida todavía no lo es", () => {
    expect(pasoActual([1, 2], INCLUIDAS, INCLUIDAS, false)).toBe("V2");
  });
});
