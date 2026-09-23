import { afterEach, describe, expect, it, vi } from "vitest";
import { esLaTarea, llaveDeLaTarea } from "@/lib/tareas";

const pedido = (autorizacion?: string) =>
  new Request("http://x/api/tareas", {
    method: "POST",
    headers: autorizacion ? { authorization: autorizacion } : {},
  });

afterEach(() => vi.unstubAllEnvs());

describe("la llave de la tarea diaria", () => {
  it("la llave de la tarea abre; cualquier otra cosa, no", () => {
    vi.stubEnv("CLAVE_DE_ADMIN", "una-clave-larga-de-prueba");
    const llave = llaveDeLaTarea()!;
    expect(esLaTarea(pedido(`Bearer ${llave}`))).toBe(true);
    expect(esLaTarea(pedido())).toBe(false);
    expect(esLaTarea(pedido("Bearer una-clave-larga-de-prueba"))).toBe(false);
    expect(esLaTarea(pedido(`Bearer ${llave}x`))).toBe(false);
  });

  it("no es la clave misma: conocer la llave no la revela", () => {
    expect(llaveDeLaTarea("abc")).not.toContain("abc");
    expect(llaveDeLaTarea("abc")).not.toBe(llaveDeLaTarea("abd"));
  });

  it("sin CLAVE_DE_ADMIN no abre nada, ni con la cabecera vacía", () => {
    vi.stubEnv("CLAVE_DE_ADMIN", "");
    expect(llaveDeLaTarea()).toBeNull();
    expect(esLaTarea(pedido("Bearer "))).toBe(false);
    expect(esLaTarea(pedido())).toBe(false);
  });

  it("la tarea de Netlify calcula la misma llave que la aplicación", async () => {
    // Las dos puntas tienen que coincidir byte a byte: si una cambia la
    // etiqueta, la tarea deja de correr sin que nada falle en la compilación.
    const { readFileSync } = await import("node:fs");
    const tarea = readFileSync("netlify/functions/tarea-diaria.mjs", "utf8");
    expect(tarea).toContain('createHmac("sha256", clave).update("tarea-diaria").digest("base64url")');
    expect(llaveDeLaTarea("k")).toBe(
      (await import("node:crypto")).createHmac("sha256", "k").update("tarea-diaria").digest("base64url")
    );
  });
});
