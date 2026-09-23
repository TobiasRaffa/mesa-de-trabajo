// Qué da por leído abrir la bandeja: solo lo que se dibujó como nuevo.

import { describe, expect, it, vi } from "vitest";

// La acción del servidor no se llama acá; mockearla evita cargar el servidor.
vi.mock("@/app/(admin)/gestion/acciones", () => ({ marcarAvisosVistos: async () => {} }));

const { cualesDarPorVistas } = await import("@/admin/Bandeja");

const aviso = (id: string, loVi = false) =>
  ({ id, loVi, cuando: "2026-09-22T12:00:00.000Z" }) as Parameters<
    typeof cualesDarPorVistas
  >[0][number];

describe("abrir la bandeja marca lo que se vio", () => {
  it("las que estaban sin leer al abrir", () => {
    const avisos = [aviso("a"), aviso("b"), aviso("c", true)];
    expect(cualesDarPorVistas(avisos, new Set(["a", "b"]))).toEqual(["a", "b"]);
  });

  it("lo que llegó con la pantalla abierta no se da por leído", () => {
    // Entra por un refresco y no se dibuja entre las nuevas: marcarlo lo
    // mandaba directo a «Ya leídas» sin que nadie lo mirara.
    const avisos = [aviso("nuevo"), aviso("a")];
    expect(cualesDarPorVistas(avisos, new Set(["a"]))).toEqual(["a"]);
  });

  it("lo ya marcado no se vuelve a mandar", () => {
    const avisos = [aviso("a", true), aviso("b", true)];
    expect(cualesDarPorVistas(avisos, new Set(["a", "b"]))).toEqual([]);
  });
});
