import { describe, expect, it } from "vitest";
import { diaDe, esDiaValido, fechaDeDia } from "@/lib/publicaciones";

describe("esDiaValido", () => {
  it("acepta un día normal", () => {
    expect(esDiaValido("2026-09-12")).toBe(true);
  });

  it.each(["12/09/2026", "2026-9-12", "2026-09-12T00:00:00Z", "", "ayer", "0000-00-00"])(
    "rechaza «%s»",
    (mal) => {
      expect(esDiaValido(mal)).toBe(false);
    }
  );

  it.each([null, undefined, 20260912, {}, []])("rechaza lo que no es texto", (mal) => {
    expect(esDiaValido(mal)).toBe(false);
  });

  it("RECHAZA un día que no existe", () => {
    // `new Date` acepta el 31 de febrero y lo corre al 3 de marzo. Sin este
    // control, se guardaría una fecha que después aparece en otro lado.
    expect(esDiaValido("2026-02-31")).toBe(false);
    expect(esDiaValido("2026-13-01")).toBe(false);
    expect(esDiaValido("2026-04-31")).toBe(false);
  });

  it("acepta el 29 de febrero de un año bisiesto, y rechaza el de uno que no", () => {
    expect(esDiaValido("2028-02-29")).toBe(true);
    expect(esDiaValido("2026-02-29")).toBe(false);
  });
});

describe("ida y vuelta entre día y fecha", () => {
  it("una fecha vuelve al mismo día", () => {
    expect(diaDe(new Date(2026, 8, 12))).toBe("2026-09-12");
  });

  it("un día vuelve a la misma fecha, en el calendario de acá", () => {
    const fecha = fechaDeDia("2026-09-12");
    expect(fecha.getFullYear()).toBe(2026);
    expect(fecha.getMonth()).toBe(8);
    expect(fecha.getDate()).toBe(12);
  });

  it("NO se corre un día al convertir", () => {
    // Es el error clásico: `new Date("2026-09-12")` es medianoche UTC, que en
    // Buenos Aires es el 11 a las 21. La pieza saldría un día antes.
    expect(diaDe(fechaDeDia("2026-09-12"))).toBe("2026-09-12");
    expect(diaDe(fechaDeDia("2026-01-01"))).toBe("2026-01-01");
    expect(diaDe(fechaDeDia("2026-12-31"))).toBe("2026-12-31");
  });

  it("rellena con ceros los meses y días de una cifra", () => {
    expect(diaDe(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
