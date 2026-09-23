// Hasta dónde leyó el cliente el chat, con qué reloj.
//
// Se anotaba la hora del teléfono al abrir el chat y se comparaba con la hora
// del servidor de cada mensaje. Con el teléfono adelantado, lo que el equipo
// contestaba después no contaba como sin leer; atrasado, lo ya leído volvía a
// contar.

import { describe, expect, it, vi } from "vitest";

// La pantalla importa las acciones de servidor; acá no se llaman.
vi.mock("@/portal/acciones", () => ({}));

const { leidoAlAbrir } = await import("@/portal/Portal");

const mensaje = (de: "cliente" | "agencia", cuando: string) => ({
  id: cuando,
  de,
  quien: de,
  texto: "hola",
  cuando,
});

describe("la marca de leído sale de los mensajes, no del teléfono", () => {
  it("es la hora del servidor del último mensaje en pantalla", () => {
    const mensajes = [
      mensaje("agencia", "2026-09-18T13:00:00.000Z"),
      mensaje("cliente", "2026-09-18T13:05:00.000Z"),
    ];
    expect(leidoAlAbrir(mensajes, "")).toBe("2026-09-18T13:05:00.000Z");
  });

  it("una respuesta posterior del equipo cuenta como sin leer, con cualquier reloj", () => {
    // El teléfono va una hora adelantado: con su hora, la respuesta de las
    // 13:30 quedaba «leída» antes de llegar.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-18T14:00:00.000Z"));
    try {
      const marca = leidoAlAbrir([mensaje("agencia", "2026-09-18T13:00:00.000Z")], "");
      expect("2026-09-18T13:30:00.000Z" > marca).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sin mensajes nuevos, no retrocede", () => {
    expect(leidoAlAbrir([], "2026-09-18T13:00:00.000Z")).toBe("2026-09-18T13:00:00.000Z");
  });
});
