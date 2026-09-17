// La galleta que dice quién entró.
//
// Es lo único que separa a la agencia de cualquiera que escriba la dirección,
// así que lo que se prueba acá no es «funciona» sino «no se puede falsear».

import { beforeEach, describe, expect, it } from "vitest";
import {
  galletaDeGestionValida,
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
