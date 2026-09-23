import { describe, expect, it, vi } from "vitest";

// Las acciones del servidor no hacen falta para decidir qué se ve, y cargarlas
// arrastra la base y la sesión.
vi.mock("@/app/(admin)/gestion/acciones", () => ({}));

const { busquedaAdentroDe, clientesALaVista } = await import("@/admin/ArbolDeClientes");

const cafe = { id: "c1", nombre: "Café Otoño" };
const panaderia = { id: "c2", nombre: "Panadería Sur" };

describe("el buscador del árbol", () => {
  it("un cliente abierto no se esconde aunque su nombre no coincida", () => {
    // Se buscaba «banners» con Café Otoño abierto y la pantalla decía «Ningún
    // cliente se llama así»: se escondía el cliente y, con él, la carpeta.
    const r = clientesALaVista([cafe, panaderia], "banners", new Set(["c1"]));
    expect(r.map((c) => c.id)).toEqual(["c1"]);
  });

  it("uno cerrado que no coincide sí se esconde", () => {
    expect(clientesALaVista([cafe, panaderia], "cafe", new Set())).toEqual([cafe]);
  });

  it("si el cliente coincidió por su nombre, lo de adentro no se filtra", () => {
    // Se buscaba «cafe», se abría Café Otoño y adentro decía «Nada acá se
    // llama así»: sus carpetas se filtraban por el nombre del cliente.
    expect(busquedaAdentroDe("Café Otoño", "cafe")).toBe("");
  });

  it("si está abierto por otra cosa, adentro se sigue buscando", () => {
    expect(busquedaAdentroDe("Café Otoño", "banners")).toBe("banners");
  });
});
