// Dónde arranca la conversación al abrirla: en el primero sin leer.

import { describe, expect, it } from "vitest";
import { indiceDelPrimerSinLeer, juntarMensajes, sigueALaAnterior, type Mensaje } from "@/ui/Conversacion";

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

describe("juntarMensajes no pierde nada de lo que había en pantalla", () => {
  const m = (id: string, cuando: string) =>
    ({ id, de: "cliente", quien: "Cliente", texto: id, cuando }) as Mensaje;

  it("un sondeo que llega tarde no borra lo recién mandado", () => {
    const pantalla = [m("a", "2026-01-01T10:00:00Z"), m("nuevo", "2026-01-01T10:05:00Z")];
    const sondeoViejo = [m("a", "2026-01-01T10:00:00Z")];
    expect(juntarMensajes(pantalla, sondeoViejo).map((x) => x.id)).toEqual(["a", "nuevo"]);
  });

  it("la mudanza a un tramo achica el hilo y aun así entra lo nuevo", () => {
    // En pantalla, cuatro; el hilo vivo se mudó y ahora trae los dos últimos
    // más uno nuevo. Con un candado por largo, este sondeo se descartaba.
    const pantalla = ["1", "2", "3", "4"].map((id, i) => m(id, `2026-01-01T10:0${i}:00Z`));
    const hiloMudado = [m("3", "2026-01-01T10:02:00Z"), m("4", "2026-01-01T10:03:00Z"), m("5", "2026-01-01T10:04:00Z")];
    expect(juntarMensajes(pantalla, hiloMudado).map((x) => x.id)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("no repite y deja todo en orden de cuándo se dijo", () => {
    const r = juntarMensajes([m("b", "2026-01-01T10:01:00Z")], [m("a", "2026-01-01T10:00:00Z"), m("b", "2026-01-01T10:01:00Z")]);
    expect(r.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
