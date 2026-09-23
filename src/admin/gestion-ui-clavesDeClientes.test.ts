import { describe, expect, it, vi } from "vitest";

// Las acciones del servidor no hacen falta para elegir qué error se muestra, y
// cargarlas arrastra la base y la sesión.
vi.mock("@/app/(admin)/gestion/acciones", () => ({
  ponerTagDeCliente: vi.fn(),
  verClaveDeCliente: vi.fn(),
}));

const { falloAMostrar } = await import("@/admin/ClavesDeClientes");

const nada = { ver: null, tag: null };

describe("qué error se ve en una clave", () => {
  const malaContrasena = { ok: false, motivo: "Esa contraseña no es la tuya." };
  const cortita = { ok: false, motivo: "Poné al menos tres letras." };

  it("al cambiar se ve el error de cambiar, aunque «Ver» haya fallado antes", () => {
    // El fallo viejo de «Ver» tapaba el real: la persona reescribía su
    // contraseña una y otra vez sin enterarse de que la clave era corta.
    expect(falloAMostrar("cambiar", malaContrasena, cortita, { ver: malaContrasena, tag: null })).toBe(
      "Poné al menos tres letras."
    );
  });

  it("al reabrir no aparece el error de la vez anterior", () => {
    expect(falloAMostrar("ver", malaContrasena, null, { ver: malaContrasena, tag: null })).toBeNull();
  });

  it("un error nuevo sí se ve", () => {
    expect(falloAMostrar("ver", malaContrasena, null, nada)).toBe("Esa contraseña no es la tuya.");
  });

  it("con el panel cerrado no hay error que mostrar", () => {
    expect(falloAMostrar(null, malaContrasena, cortita, nada)).toBeNull();
  });
});
