// Quién está del otro lado de una galleta de gestión.
//
// **Es la única función que contesta «quién sos» y no tenía una sola prueba.**
// Eso permitió que se escapara el peor error que tuvo esto: la galleta guarda
// **segundos** desde 1970 y la contraseña guarda **milisegundos**, y se
// comparaban multiplicando por mil. Multiplicar trunca hacia abajo, así que la
// galleta quedaba siempre por detrás de la contraseña que se acababa de poner:
// elegir contraseña por primera vez y entrar pasan en el mismo segundo, o sea
// que **toda primera entrada se rechazaba a sí misma** y quien estrenaba
// contraseña rebotaba a la puerta. Compilaba, pasaba las 634 pruebas de
// entonces, y no dejaba entrar a nadie nuevo.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);

// `quienLleva` recibe el valor de la galleta en la mano, así que no hace falta
// que haya un pedido de verdad. El módulo igual lo importa arriba de todo.
vi.mock("next/headers", () => ({ cookies: async () => new Map() }));

process.env.CLAVE_DE_ADMIN = "la-llave-del-equipo-para-las-pruebas";

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const { quienLleva } = await import("@/lib/sesion");
const { valorDeSesion, SIN_PERSONA } = await import("@/lib/contrasena");
const { ponerClave, sacarClave } = await import("@/lib/claves");
const { sumarAlEquipo } = await import("@/lib/equipo");

beforeEach(() => {
  memoriaDePruebas.vaciar();
});

/** Da de alta a alguien y le pone contraseña, como hace la puerta. */
async function conContrasena(correo: string, rol: "admin" | "diseno" | "facturacion") {
  const persona = await sumarAlEquipo({ correo, rol });
  await ponerClave(persona.id, "una-contrasena-larga");
  return persona;
}

describe("la galleta que se acaba de emitir vale", () => {
  it("entra quien estrena contraseña en el mismo segundo", async () => {
    const persona = await conContrasena("nari@matter.test", "diseno");

    // Exactamente lo que hace `entrar`: poner la clave y, a los pocos
    // milisegundos, firmar la galleta. Las dos caen en el mismo segundo.
    const sesion = await quienLleva(valorDeSesion(persona.id)!);

    expect(sesion).not.toBeNull();
    expect(sesion?.persona?.correo).toBe("nari@matter.test");
  });

  it("entra aunque la contraseña se haya puesto un instante después de la galleta", async () => {
    // El caso al filo: la galleta se firma en el milisegundo 0 del segundo y
    // la contraseña se guarda en el 800. Los dos son «el mismo segundo», y
    // rechazarlo sería rebotar a alguien que acaba de elegir su contraseña.
    const persona = await conContrasena("filo@matter.test", "diseno");
    const enSegundos = Math.floor(Date.now() / 1000);

    expect(await quienLleva(valorDeSesion(persona.id, enSegundos)!)).not.toBeNull();
  });
});

describe("una contraseña nueva echa a las sesiones viejas", () => {
  it("una galleta de antes de la contraseña actual no abre", async () => {
    const persona = await conContrasena("vieja@matter.test", "diseno");

    // Emitida una hora antes de que existiera esta contraseña.
    const haceUnaHora = Math.floor(Date.now() / 1000) - 3600;

    expect(await quienLleva(valorDeSesion(persona.id, haceUnaHora)!)).toBeNull();
  });

  it("sin contraseña no hay sesión, aunque la galleta esté bien firmada", async () => {
    const persona = await conContrasena("reiniciada@matter.test", "diseno");
    const galleta = valorDeSesion(persona.id)!;
    expect(await quienLleva(galleta)).not.toBeNull();

    await sacarClave(persona.id);

    expect(await quienLleva(galleta)).toBeNull();
  });
});

describe("la galleta dice quién, y el rol dice qué ve", () => {
  it("quien se fue del equipo no entra con la galleta que le quedó", async () => {
    const persona = await conContrasena("sefue@matter.test", "diseno");
    const galleta = valorDeSesion(persona.id)!;

    memoriaDePruebas.vaciar();

    expect(await quienLleva(galleta)).toBeNull();
  });

  it("las secciones salen del rol guardado y no de la galleta", async () => {
    // Es lo que hace que «le saqué el acceso» quiera decir ahora: si viajaran
    // adentro de la galleta, el cambio recién valdría la próxima vez que
    // entrara.
    const persona = await conContrasena("factura@matter.test", "facturacion");

    const sesion = await quienLleva(valorDeSesion(persona.id)!);

    expect(sesion?.secciones).toEqual(["facturas"]);
  });

  it("una galleta inventada no abre nada", async () => {
    expect(await quienLleva("cualquiera.123.firmafalsa")).toBeNull();
    expect(await quienLleva(undefined)).toBeNull();
  });
});

describe("la llave del equipo, que abre solo durante el arranque", () => {
  it("abre con todo mientras nadie tenga contraseña", async () => {
    const sesion = await quienLleva(valorDeSesion(SIN_PERSONA)!);

    expect(sesion).not.toBeNull();
    expect(sesion?.persona).toBeNull();
    expect(sesion?.clientes).toBe("todos");
    expect(sesion?.secciones).toContain("admin");
  });

  it("deja de abrir en cuanto alguien tiene la suya", async () => {
    const galleta = valorDeSesion(SIN_PERSONA)!;
    expect(await quienLleva(galleta)).not.toBeNull();

    await conContrasena("primera@matter.test", "admin");

    // La misma galleta, que el navegador sigue mandando: ya no vale.
    expect(await quienLleva(galleta)).toBeNull();
  });
});
