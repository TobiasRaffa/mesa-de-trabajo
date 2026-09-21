import { describe, expect, it } from "vitest";
import {
  calcularAviso,
  calcularVencimiento,
  diasDeDiferencia,
  plazoEnPalabras,
  situacionDelPlazo,
} from "@/lib/fechas";

// Buenos Aires está tres horas detrás del horario universal, todo el año.
// Estas pruebas usan momentos universales y esperan resultados en hora local:
// es justo el cruce donde se cometen los errores.
const utc = (iso: string) => new Date(iso);

describe("calcularVencimiento", () => {
  it("suma días corridos", () => {
    const enviada = utc("2026-09-08T14:00:00Z");
    expect(calcularVencimiento(enviada, 4).toISOString()).toBe("2026-09-12T14:00:00.000Z");
  });

  it("no saltea fines de semana", () => {
    // Días corridos y no hábiles: un viernes más cuatro cae el martes.
    const viernes = utc("2026-09-11T12:00:00Z");
    const vence = calcularVencimiento(viernes, 4);
    expect(vence.getUTCDay()).toBe(2); // martes
  });
});

describe("calcularAviso", () => {
  it("cae a la mitad del plazo", () => {
    const enviada = utc("2026-09-08T00:00:00Z");
    expect(calcularAviso(enviada, 4).toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(calcularAviso(enviada, 10).toISOString()).toBe("2026-09-13T00:00:00.000Z");
  });

  it("con plazos impares cae en el medio, no redondeado", () => {
    const enviada = utc("2026-09-08T00:00:00Z");
    // Tres días: el aviso al día y medio. Mejor un poco antes que un poco tarde.
    expect(calcularAviso(enviada, 3).toISOString()).toBe("2026-09-09T12:00:00.000Z");
  });

  it("siempre queda antes del vencimiento", () => {
    const enviada = utc("2026-09-08T00:00:00Z");
    for (const dias of [1, 2, 3, 4, 7, 10, 30]) {
      expect(calcularAviso(enviada, dias).getTime()).toBeLessThan(
        calcularVencimiento(enviada, dias).getTime()
      );
    }
  });
});

describe("diasDeDiferencia", () => {
  it("cuenta días de calendario, no de veinticuatro horas", () => {
    // Son las 23 del lunes en Buenos Aires y algo vence el martes a las 9.
    // Para una persona eso es "mañana", aunque falten diez horas.
    const lunesTarde = utc("2026-09-08T02:00:00Z"); // lunes 23:00 en Buenos Aires
    const martesTemprano = utc("2026-09-08T12:00:00Z"); // martes 09:00
    expect(diasDeDiferencia(lunesTarde, martesTemprano)).toBe(1);
  });

  it("dos momentos del mismo día dan cero", () => {
    expect(diasDeDiferencia(utc("2026-09-08T12:00:00Z"), utc("2026-09-08T20:00:00Z"))).toBe(0);
  });

  it("hacia atrás da negativo", () => {
    expect(diasDeDiferencia(utc("2026-09-10T12:00:00Z"), utc("2026-09-08T12:00:00Z"))).toBe(-2);
  });

  it("respeta el cambio de día de Buenos Aires y no el universal", () => {
    // 2026-09-09T01:00Z es todavía el 8 de septiembre en Buenos Aires (22:00).
    const aunEsElOcho = utc("2026-09-09T01:00:00Z");
    const elNueve = utc("2026-09-09T15:00:00Z");
    expect(diasDeDiferencia(aunEsElOcho, elNueve)).toBe(1);
  });
});

describe("situacionDelPlazo", () => {
  const ahora = utc("2026-09-08T15:00:00Z"); // lunes 12:00 en Buenos Aires

  it("distingue sin enviar", () => {
    expect(situacionDelPlazo(null, ahora)).toEqual({ situacion: "sin_enviar" });
  });

  it("reconoce que vence hoy", () => {
    expect(situacionDelPlazo(utc("2026-09-08T22:00:00Z"), ahora)).toEqual({
      situacion: "vence_hoy",
    });
  });

  it("cuenta los días que faltan", () => {
    expect(situacionDelPlazo(utc("2026-09-11T15:00:00Z"), ahora)).toEqual({
      situacion: "por_vencer",
      dias: 3,
    });
  });

  it("cuenta los días de atraso en positivo", () => {
    // Se guarda en positivo para que la pantalla no tenga que hacer cuentas.
    expect(situacionDelPlazo(utc("2026-09-06T15:00:00Z"), ahora)).toEqual({
      situacion: "vencido",
      dias: 2,
    });
  });
});

describe("plazoEnPalabras", () => {
  const ahora = utc("2026-09-08T15:00:00Z");

  it("escribe cada situación en castellano", () => {
    expect(plazoEnPalabras(null, ahora)).toBe("sin entregar");
    expect(plazoEnPalabras(utc("2026-09-08T22:00:00Z"), ahora)).toBe("vence hoy");
    expect(plazoEnPalabras(utc("2026-09-09T15:00:00Z"), ahora)).toBe("vence mañana");
    expect(plazoEnPalabras(utc("2026-09-11T15:00:00Z"), ahora)).toBe("vence en 3 días");
    expect(plazoEnPalabras(utc("2026-09-07T15:00:00Z"), ahora)).toBe("venció ayer");
    expect(plazoEnPalabras(utc("2026-09-06T15:00:00Z"), ahora)).toBe("venció hace 2 días");
  });

  it("nunca dice «vence en 1 días»", () => {
    // El singular mal puesto es lo primero que delata a un sistema descuidado.
    const ahora = utc("2026-09-08T15:00:00Z");
    for (let dias = -5; dias <= 5; dias++) {
      const texto = plazoEnPalabras(
        new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000),
        ahora
      );
      expect(texto).not.toMatch(/\b1 días\b/);
    }
  });
});
