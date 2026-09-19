// El código de alta.
//
// Lo que se prueba acá es que **el código no viaja con la persona** —`Persona`
// llega entera al navegador— y que sirve una sola vez: aparece con el alta,
// se compara sin importar cómo se lo escriba, y se va con la contraseña.

import { beforeEach, describe, expect, it, vi } from "vitest";

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

const {
  borrarCodigoDeAlta,
  cambiarPersona,
  codigoDeAltaCorrecto,
  codigoDeAltaDe,
  codigoLegible,
  elEquipo,
  nuevoCodigoDeAlta,
  personaPorId,
  renovarCodigoDeAlta,
  sumarAlEquipo,
} = await import("@/lib/equipo");

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
});

describe("el código nace con el alta", () => {
  it("y queda guardado, pero no en la persona que se devuelve", async () => {
    const persona = await sumarAlEquipo({ correo: "nari@agencia.com", rol: "diseno" });

    expect("codigoDeAlta" in persona).toBe(false);
    expect(await codigoDeAltaDe(persona.id)).toMatch(/^[A-Z2-9]{8}$/);
  });

  it("no viaja en la lista del equipo ni al buscar una persona", async () => {
    const { id } = await sumarAlEquipo({ correo: "nari@agencia.com", rol: "diseno" });

    for (const p of [...(await elEquipo()), await personaPorId(id)]) {
      expect(p && "codigoDeAlta" in p).toBe(false);
    }
  });

  it("usa un alfabeto que no se confunde al dictarlo", () => {
    for (let i = 0; i < 200; i++) {
      expect(nuevoCodigoDeAlta()).not.toMatch(/[01OI]/);
    }
  });

  it("se muestra en dos mitades", () => {
    expect(codigoLegible("ABCDEFGH")).toBe("ABCD-EFGH");
  });
});

describe("se compara como lo escribe una persona", () => {
  it("con guion, en minúscula o con espacios da igual", async () => {
    const { id } = await sumarAlEquipo({ correo: "nari@agencia.com", rol: "diseno" });
    const codigo = (await codigoDeAltaDe(id))!;

    expect(await codigoDeAltaCorrecto(id, codigoLegible(codigo))).toBe(true);
    expect(await codigoDeAltaCorrecto(id, codigo.toLowerCase())).toBe(true);
    expect(await codigoDeAltaCorrecto(id, ` ${codigo.slice(0, 4)} ${codigo.slice(4)} `)).toBe(true);
  });

  it("otro código no entra, y vacío tampoco", async () => {
    const { id } = await sumarAlEquipo({ correo: "nari@agencia.com", rol: "diseno" });

    expect(await codigoDeAltaCorrecto(id, "ABCDEFGH")).toBe(false);
    expect(await codigoDeAltaCorrecto(id, "")).toBe(false);
  });

  it("quien no tiene código no entra con ninguno", async () => {
    const { id } = await sumarAlEquipo({ correo: "nari@agencia.com", rol: "diseno" });
    await borrarCodigoDeAlta(id);

    expect(await codigoDeAltaDe(id)).toBeNull();
    expect(await codigoDeAltaCorrecto(id, "")).toBe(false);
  });
});

describe("el código sobrevive a lo que no lo toca", () => {
  it("editar el nombre no lo borra", async () => {
    const { id } = await sumarAlEquipo({ correo: "nari@agencia.com", rol: "diseno" });
    const antes = await codigoDeAltaDe(id);

    await cambiarPersona(id, { nombre: "Narella" });

    expect(await codigoDeAltaDe(id)).toBe(antes);
    expect((await personaPorId(id))?.nombre).toBe("Narella");
  });

  it("renovarlo deja uno distinto y el viejo deja de servir", async () => {
    const { id } = await sumarAlEquipo({ correo: "nari@agencia.com", rol: "diseno" });
    const viejo = (await codigoDeAltaDe(id))!;

    const nuevo = await renovarCodigoDeAlta(id);

    expect(nuevo).not.toBe(viejo);
    expect(await codigoDeAltaCorrecto(id, viejo)).toBe(false);
    expect(await codigoDeAltaCorrecto(id, nuevo!)).toBe(true);
  });
});
