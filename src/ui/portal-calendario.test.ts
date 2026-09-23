// En qué día cae cada pieza del calendario del portal, mire desde donde mire.
//
// La fecha de publicación es un día de Buenos Aires (se guarda «2026-09-12» y
// viaja como el mediodía de allá), y el calendario la ubicaba con los getters
// del huso del navegador. Desde Tokio, Sídney o Auckland, el mediodía de
// Buenos Aires ya es el día siguiente: la pieza caía en el 13 mientras el
// texto de al lado decía «sale el 12 sept». Y «hoy» lo calculaba el servidor,
// que corre en tiempo universal: de 21 a 24 h de Buenos Aires resaltaba mañana.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { fechaDeDia } from "@/lib/publicaciones";
import { enPalabrasElMes } from "@/dominio/tiempo";
import { Calendario, mismoMes, otroMes, type PiezaEnCalendario } from "@/ui/Calendario";

const HUSO_ORIGINAL = process.env.TZ;

function enHuso(huso: string) {
  process.env.TZ = huso;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-05T15:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  if (HUSO_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = HUSO_ORIGINAL;
});

const pieza = (dia: string): PiezaEnCalendario => ({
  id: `p-${dia}`,
  nombre: "posteo",
  publicaEl: fechaDeDia(dia),
  miniatura: "",
  paso: "Ronda 1",
  aprobada: false,
});

const dibujar = (mes: Date, piezas: PiezaEnCalendario[]) =>
  renderToString(createElement(Calendario, { modo: "mes", mes, piezas, onAbrir: () => {} }));

describe("la pieza cae en su día de Buenos Aires", () => {
  it.each(["Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland", "America/Argentina/Buenos_Aires"])(
    "desde %s, la del 12 cae en el 12",
    (huso) => {
      enHuso(huso);
      const html = dibujar(fechaDeDia("2026-09-12"), [pieza("2026-09-12")]);
      expect(html).toContain('aria-label="12: posteo, Ronda 1"');
      expect(html).not.toContain('aria-label="13: posteo');
    }
  );

  it("desde Tokio, la del último día del mes no se va al mes siguiente", () => {
    enHuso("Asia/Tokyo");
    const html = dibujar(fechaDeDia("2026-09-12"), [pieza("2026-09-30")]);
    expect(html).toContain('aria-label="30: posteo, Ronda 1"');
    expect(html).not.toContain("fuera de este mes");
  });
});

describe("«hoy» es el de Buenos Aires", () => {
  it("a las 22 h de Buenos Aires, con el servidor en tiempo universal, hoy es el 12", () => {
    enHuso("UTC");
    // 22:00 del 12 en Buenos Aires = 01:00 del 13 en tiempo universal.
    vi.setSystemTime(new Date("2026-09-13T01:00:00.000Z"));

    const html = dibujar(fechaDeDia("2026-09-12"), []);
    const resaltados = [...html.matchAll(/<span class="[^"]*text-acento[^"]*">(\d+)<\/span>/g)].map(
      (m) => m[1]
    );
    expect(resaltados).toEqual(["12"]);
  });
});

describe("cambiar de mes", () => {
  it("desde Sídney, el mes siguiente se llama como el que se dibuja", () => {
    enHuso("Australia/Sydney");
    const octubre = otroMes(fechaDeDia("2026-09-12"), 1);
    expect(enPalabrasElMes(octubre)).toBe(enPalabrasElMes(fechaDeDia("2026-10-15")));
    expect(mismoMes(octubre, fechaDeDia("2026-10-01"))).toBe(true);
    expect(mismoMes(octubre, fechaDeDia("2026-09-30"))).toBe(false);
  });

  it("para atrás cruza el año", () => {
    enHuso("Asia/Tokyo");
    const diciembre = otroMes(fechaDeDia("2027-01-01"), -1);
    expect(mismoMes(diciembre, fechaDeDia("2026-12-31"))).toBe(true);
  });
});
