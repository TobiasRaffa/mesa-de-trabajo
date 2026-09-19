// Dónde arranca la conversación al abrirla: en el primero sin leer.

import { describe, expect, it } from "vitest";
import { indiceDelPrimerSinLeer, sigueALaAnterior, type Mensaje } from "@/ui/Conversacion";

const m = (
  id: string,
  de: Mensaje["de"],
  cuando = "2026-09-18T00:00:00.000Z",
  quien: string = de
): Mensaje => ({ id, de, quien, texto: id, cuando });

describe("mensajes seguidos de la misma persona", () => {
  it("el segundo sigue al primero si es de la misma persona y de corrido", () => {
    const a = m("1", "cliente", "2026-09-18T12:00:00.000Z");
    const b = m("2", "cliente", "2026-09-18T12:03:00.000Z");
    expect(sigueALaAnterior(a, b)).toBe(true);
  });

  it("cambia de persona, cambia de rótulo", () => {
    const a = m("1", "cliente", "2026-09-18T12:00:00.000Z");
    const b = m("2", "agencia", "2026-09-18T12:00:30.000Z");
    expect(sigueALaAnterior(a, b)).toBe(false);
    // Dos de la agencia con distinta firma también son dos personas.
    const c = m("3", "agencia", "2026-09-18T12:01:00.000Z", "Nari");
    expect(sigueALaAnterior(b, c)).toBe(false);
  });

  it("horas después sigue siendo la misma racha: lo que la corta es el otro", () => {
    const a = m("1", "cliente", "2026-09-18T09:00:00.000Z");
    const b = m("2", "cliente", "2026-09-18T18:00:00.000Z");
    expect(sigueALaAnterior(a, b)).toBe(true);
  });

  it("al cambiar el día vuelve a decir la fecha", () => {
    const a = m("1", "cliente", "2026-09-18T18:00:00.000Z");
    const b = m("2", "cliente", "2026-09-19T18:00:00.000Z");
    expect(sigueALaAnterior(a, b)).toBe(false);
  });

  it("los avisos de la aplicación cortan la racha", () => {
    const a = m("1", "cliente", "2026-09-18T12:00:00.000Z");
    const s = m("2", "sistema", "2026-09-18T12:00:10.000Z");
    const b = m("3", "cliente", "2026-09-18T12:00:20.000Z");
    expect(sigueALaAnterior(a, s)).toBe(false);
    expect(sigueALaAnterior(s, b)).toBe(false);
  });

  it("el primero no sigue a nadie", () => {
    expect(sigueALaAnterior(undefined, m("1", "cliente"))).toBe(false);
  });
});

describe("el primero sin leer", () => {
  it("sin nada sin leer no hay dónde ir: se va al final", () => {
    expect(indiceDelPrimerSinLeer([m("a", "cliente")], "agencia", 0)).toBeNull();
    expect(indiceDelPrimerSinLeer([], "agencia", 3)).toBeNull();
  });

  it("cuenta desde el final solo los mensajes del otro lado", () => {
    const hilo = [
      m("1", "cliente"),
      m("2", "agencia"),
      m("3", "cliente"), // ← el primero de los dos sin leer
      m("4", "sistema"),
      m("5", "agencia"),
      m("6", "cliente"),
    ];
    expect(indiceDelPrimerSinLeer(hilo, "agencia", 2)).toBe(2);
  });

  it("del lado del cliente, lo sin leer es lo que dijo la agencia", () => {
    const hilo = [m("1", "agencia"), m("2", "cliente"), m("3", "agencia")];
    expect(indiceDelPrimerSinLeer(hilo, "cliente", 1)).toBe(2);
    expect(indiceDelPrimerSinLeer(hilo, "cliente", 2)).toBe(0);
  });

  it("si faltan más de los que hay a la vista, arranca por el principio", () => {
    const hilo = [m("1", "agencia"), m("2", "cliente")];
    expect(indiceDelPrimerSinLeer(hilo, "agencia", 5)).toBe(0);
  });
});
