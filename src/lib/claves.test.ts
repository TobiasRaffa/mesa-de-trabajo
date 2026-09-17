// Las contraseñas del equipo.
//
// Lo que se prueba acá es que **nunca se guarda lo escrito**, y que una
// contraseña sirve solo para su dueña.

import { beforeEach, describe, expect, it, vi } from "vitest";

// El almacén se reemplaza por uno en memoria: lo que se prueba es la decisión,
// no cómo se guarda.
const guardado: Record<string, unknown> = {};

vi.mock("@/lib/almacen", () => ({
  coleccion: () => ({
    todo: async () => guardado,
    uno: async (id: string) => guardado[id],
    guardar: async (id: string, v: unknown) => {
      guardado[id] = v;
    },
    borrar: async (id: string) => {
      delete guardado[id];
    },
  }),
}));

const { claveCorrecta, hayAlguienConClave, ponerClave, sacarClave, tieneClave } =
  await import("@/lib/claves");

const NARI = "nari";
const OTRA = "otra";

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
});

describe("nunca se guarda la contraseña", () => {
  it("lo que queda es una huella, no el texto", async () => {
    await ponerClave(NARI, "la-de-nari-2026");

    const escrito = String(guardado[NARI]);
    expect(escrito).not.toContain("la-de-nari-2026");
    expect(escrito.startsWith("scrypt$")).toBe(true);
  });

  it("dos personas con la misma contraseña no tienen la misma huella", async () => {
    // Cada una lleva su propia sal. Sin eso, ver dos huellas iguales en el
    // archivo ya cuenta algo que no hace falta contar.
    await ponerClave(NARI, "la-misma-de-siempre");
    await ponerClave(OTRA, "la-misma-de-siempre");

    expect(guardado[NARI]).not.toBe(guardado[OTRA]);
  });
});

describe("una contraseña sirve solo para su dueña", () => {
  beforeEach(async () => {
    await ponerClave(NARI, "la-de-nari-2026");
  });

  it("la suya entra", async () => {
    await expect(claveCorrecta(NARI, "la-de-nari-2026")).resolves.toBe(true);
  });

  it("otra no", async () => {
    await expect(claveCorrecta(NARI, "la-de-nari-2025")).resolves.toBe(false);
  });

  it("la suya no le sirve a otra persona", async () => {
    await expect(claveCorrecta(OTRA, "la-de-nari-2026")).resolves.toBe(false);
  });

  it("quien no tiene ninguna no entra con nada", async () => {
    await expect(claveCorrecta(OTRA, "")).resolves.toBe(false);
    await expect(tieneClave(OTRA)).resolves.toBe(false);
  });

  it("una huella escrita a mano no abre nada", async () => {
    // Si alguien edita el archivo y pone cualquier cosa, no entra: lo que se
    // compara es el resultado de derivar, no el texto.
    guardado[OTRA] = "scrypt$sal$loquesea";
    await expect(claveCorrecta(OTRA, "loquesea")).resolves.toBe(false);

    guardado[OTRA] = "la-de-otra";
    await expect(claveCorrecta(OTRA, "la-de-otra")).resolves.toBe(false);
  });
});

describe("el arranque se cierra solo", () => {
  // Mientras nadie tenga contraseña, la puerta acepta la llave del equipo para
  // poder cargar la primera. En cuanto alguien tiene la suya, ese camino deja
  // de existir.
  it("sin nadie cargado, hay que arrancar", async () => {
    await expect(hayAlguienConClave()).resolves.toBe(false);
  });

  it("con una alcanza para cerrarlo", async () => {
    await ponerClave(NARI, "la-de-nari-2026");
    await expect(hayAlguienConClave()).resolves.toBe(true);
  });

  it("y si se borran todas, vuelve a abrirse", async () => {
    // No es una puerta trasera: es que si no, la aplicación quedaría cerrada
    // con la llave adentro y sin forma de entrar a poner una contraseña.
    await ponerClave(NARI, "la-de-nari-2026");
    await sacarClave(NARI);
    await expect(hayAlguienConClave()).resolves.toBe(false);
  });
});
