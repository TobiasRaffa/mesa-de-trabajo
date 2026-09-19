// La galleta que dice quién entró.
//
// Es lo único que separa a la agencia de cualquiera que escriba la dirección,
// así que lo que se prueba acá no es «funciona» sino «no se puede falsear».

import { beforeEach, describe, expect, it } from "vitest";
import {
  DURACION_DE_SESION,
  galletaDeGestionValida,
  leerGalleta,
  personaDeLaGalleta,
  SIN_PERSONA,
  valorDeSesion,
} from "@/lib/contrasena";

const NARI = "47930e9a-a7c6-4572-a184-594373210830";

beforeEach(() => {
  process.env.CLAVE_DE_ADMIN = "la-llave-del-equipo";
});

describe("la galleta dice de quién es", () => {
  it("lo que se firma es lo que se lee", () => {
    expect(personaDeLaGalleta(valorDeSesion(NARI)!)).toBe(NARI);
  });

  it("y la llave del equipo no es nadie", () => {
    // El arranque: alguien tiene que poder entrar a cargar la primera
    // contraseña, y esa sesión no es de nadie en particular.
    expect(personaDeLaGalleta(valorDeSesion(SIN_PERSONA)!)).toBe(SIN_PERSONA);
  });
});

describe("no se puede falsear", () => {
  it("cambiar el identificador rompe la firma", () => {
    // **Es la razón de que esto esté firmado.** Antes la galleta era una marca
    // igual para todos: no había por quién hacerse pasar porque no decía de
    // quién era. Desde que dice, cambiarla a mano tiene que no servir de nada.
    const mia = valorDeSesion(NARI)!;
    const ajena = mia.replace(NARI, "otra-persona");

    expect(personaDeLaGalleta(ajena)).toBeNull();
  });

  it("una firma inventada no entra", () => {
    expect(personaDeLaGalleta(`${NARI}.firmainventada`)).toBeNull();
  });

  it("sin firma tampoco", () => {
    expect(personaDeLaGalleta(NARI)).toBeNull();
    expect(personaDeLaGalleta("")).toBeNull();
    expect(personaDeLaGalleta(undefined)).toBeNull();
  });

  it("la firma de otra llave no vale", () => {
    // Cambiar `CLAVE_DE_ADMIN` echa a todo el mundo en el acto, sin una lista
    // de sesiones abiertas que después nadie mantiene.
    const conLaVieja = valorDeSesion(NARI)!;
    process.env.CLAVE_DE_ADMIN = "otra-llave";

    expect(personaDeLaGalleta(conLaVieja)).toBeNull();
  });

  it("sin llave configurada no se abre nada", () => {
    // El lado seguro del error: sin `CLAVE_DE_ADMIN` no hay con qué firmar, y
    // entonces tampoco hay con qué verificar.
    delete process.env.CLAVE_DE_ADMIN;

    expect(valorDeSesion(NARI)).toBeNull();
    expect(galletaDeGestionValida("lo-que-sea.lo-que-sea")).toBe(false);
  });
});

describe("un identificador con puntos adentro", () => {
  // La firma se separa por el **último** punto, no por el primero: un
  // identificador que tuviera uno adentro partiría la galleta por el lugar
  // equivocado y nadie podría entrar.
  it("se lee entero", () => {
    const raro = "una.persona.rara";
    expect(personaDeLaGalleta(valorDeSesion(raro)!)).toBe(raro);
  });
});

describe("una galleta vence", () => {

  it("dice cuándo se emitió", () => {
    const emitida = 1_800_000_000;
    expect(leerGalleta(valorDeSesion(NARI, emitida)!, emitida + 10)).toEqual({
      personaId: NARI,
      emitida,
    });
  });

  it("después de una semana ya no abre, aunque la firma sea buena", () => {
    const emitida = 1_800_000_000;
    const galleta = valorDeSesion(NARI, emitida)!;

    expect(leerGalleta(galleta, emitida + DURACION_DE_SESION - 1)).not.toBeNull();
    expect(leerGalleta(galleta, emitida + DURACION_DE_SESION + 1)).toBeNull();
  });

  it("una emitida en el futuro tampoco: nadie la firmó todavía", () => {
    const emitida = 1_800_000_000;
    expect(leerGalleta(valorDeSesion(NARI, emitida)!, emitida - 3600)).toBeNull();
  });

  it("cambiar la fecha a mano rompe la firma", () => {
    const galleta = valorDeSesion(NARI, 1_800_000_000)!;
    const estirada = galleta.replace(".1800000000.", ".1900000000.");

    expect(leerGalleta(estirada, 1_800_000_010)).toBeNull();
  });

  it("una galleta del formato viejo, sin fecha, no vale", () => {
    expect(leerGalleta(`${NARI}.firma`, 1_800_000_000)).toBeNull();
  });
});
