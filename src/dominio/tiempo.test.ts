// Cómo se escribe una fecha, y en la hora de quién.
//
// **La razón de que esto exista en un solo lugar cabe en una prueba.** Los
// formatos estaban copiados en nueve archivos y ninguna de las copias fijaba la
// zona horaria. Un `Intl.DateTimeFormat` sin zona usa la del servidor, y el
// servidor en internet corre en tiempo universal: cada hora que la aplicación
// mostraba estaba **tres horas adelantada**. Un mensaje escrito a las ocho y
// media de la noche decía 23:30, y nadie lo iba a notar desde una máquina de
// Buenos Aires, que es donde se desarrolla.

import { describe, expect, it } from "vitest";
import {
  diasDeDiferencia,
  enPalabrasConAnio,
  enPalabrasElDia,
  enPalabrasElDiaDe,
  enPalabrasElDiaLargo,
  enPalabrasElMes,
  enPalabrasLaFecha,
} from "@/dominio/tiempo";

describe("la hora es siempre la de Buenos Aires", () => {
  it("un mensaje de las 20:30 dice 20:30, no 23:30", () => {
    // El instante es 23:30 universal, que en Buenos Aires son las 20:30.
    expect(enPalabrasLaFecha("2026-09-17T23:30:00Z")).toContain("20:30");
  });

  it("y sigue siendo del 17, no del 18", () => {
    expect(enPalabrasLaFecha("2026-09-17T23:30:00Z")).toContain("17");
  });

  it("algo de la medianoche universal es del día anterior acá", () => {
    // 2026-09-18T01:00Z son las 22:00 del 17 en Buenos Aires.
    expect(enPalabrasElDiaDe("2026-09-18T01:00:00Z")).toBe("17 sept");
  });
});

describe("un día suelto se escribe el día que dice", () => {
  it("no se corre para atrás", () => {
    // Armado a la medianoche del servidor y leído en hora de Buenos Aires, un
    // día guardado se mostraba como el anterior: un vencimiento corrido un día
    // no se nota hasta que alguien llega tarde.
    expect(enPalabrasElDia("2026-09-17")).toBe("17 sept");
    expect(enPalabrasElDia("2026-01-01")).toBe("1 ene");
    expect(enPalabrasElDia("2026-12-31")).toBe("31 dic");
  });

  it("un día mal escrito se devuelve tal cual, sin reventar", () => {
    expect(enPalabrasElDia("cualquier cosa")).toBe("cualquier cosa");
  });
});

describe("cada formato dice lo suyo", () => {
  const CUANDO = "2026-09-17T15:00:00Z";

  it("el día, para las listas", () => {
    expect(enPalabrasElDiaDe(CUANDO)).toBe("17 sept");
  });

  it("con el año, para lo que se archiva", () => {
    expect(enPalabrasConAnio(CUANDO)).toContain("2026");
  });

  it("el mes, para el encabezado de un calendario", () => {
    expect(enPalabrasElMes(CUANDO)).toBe("septiembre de 2026");
  });

  it("el día largo, para separar una conversación", () => {
    expect(enPalabrasElDiaLargo(CUANDO)).toBe("jueves, 17 de septiembre");
  });

  it("lo que no es una fecha no escribe nada", () => {
    for (const cual of [enPalabrasElDiaDe, enPalabrasLaFecha, enPalabrasElMes]) {
      expect(cual("ayer a la tarde")).toBe("");
    }
  });
});

describe("los días se cuentan por calendario", () => {
  it("de la tarde del viernes al mediodía del domingo son dos días", () => {
    // Por reloj es uno y medio. El número que una persona usa para decidir si
    // algo está quieto hace mucho es el de calendario.
    expect(
      diasDeDiferencia(new Date("2026-09-18T21:00:00Z"), new Date("2026-09-20T15:00:00Z"))
    ).toBe(2);
  });
});

describe("cuándo se publica", () => {
  // Mediodía en Buenos Aires del 24 de septiembre.
  const ahora = new Date("2026-09-24T15:00:00Z");
  it("en futuro, en pasado, u hoy", async () => {
    const { cuandoSePublica } = await import("@/dominio/tiempo");
    expect(cuandoSePublica("2026-10-03", ahora)).toBe("se publica el 3 oct");
    expect(cuandoSePublica("2026-09-03", ahora)).toBe("se publicó el 3 sept");
    expect(cuandoSePublica("2026-09-24", ahora)).toBe("se publica hoy");
  });
  it("con el día en hora de Buenos Aires, aunque llegue como momento", async () => {
    const { cuandoSePublica } = await import("@/dominio/tiempo");
    // 01:00 UTC del 25 son las 22 del 24 en Buenos Aires: es hoy.
    expect(cuandoSePublica(new Date("2026-09-25T01:00:00Z"), ahora)).toBe("se publica hoy");
  });
});
