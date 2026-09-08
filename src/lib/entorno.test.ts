import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { credencialesDeGoogle, normalizarLlave, variablesFaltantes } from "@/lib/entorno";

const ORIGINAL = { ...process.env };

// Una llave escrita en una sola línea, con la secuencia \n literal, como queda
// al pegarla en el panel de Netlify. String.raw evita que el editor la
// convierta en saltos reales: acá tienen que ser dos caracteres, barra y ene.
const LLAVE_ESCAPADA = String.raw`-----BEGIN PRIVATE KEY-----\nMIIabc\n-----END PRIVATE KEY-----`;

// La misma llave con saltos de verdad, como queda al leerla de .env.local.
const LLAVE_REAL = [
  "-----BEGIN PRIVATE KEY-----",
  "MIIabc",
  "-----END PRIVATE KEY-----",
].join("\n");

beforeEach(() => {
  delete process.env.GOOGLE_SA_EMAIL;
  delete process.env.GOOGLE_SA_KEY;
  delete process.env.DRIVE_TEST_FOLDER;
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("normalizarLlave", () => {
  it("convierte la secuencia \\n escrita literalmente en saltos de verdad", () => {
    // Este es el caso de Netlify, y el que rompía el despliegue.
    expect(LLAVE_ESCAPADA).toContain("\\n"); // primero: la entrada es la que creemos
    expect(normalizarLlave(LLAVE_ESCAPADA)).toBe(LLAVE_REAL);
  });

  it("deja intacta una llave que ya tiene saltos de verdad", () => {
    // Este es el caso de .env.local. Convertir tiene que ser inofensivo.
    expect(normalizarLlave(LLAVE_REAL)).toBe(LLAVE_REAL);
  });

  it("las dos formas terminan siendo idénticas", () => {
    // La garantía que importa: da lo mismo de dónde venga la llave.
    expect(normalizarLlave(LLAVE_ESCAPADA)).toBe(normalizarLlave(LLAVE_REAL));
  });

  it("saca los espacios de los extremos", () => {
    expect(normalizarLlave(`  ${LLAVE_REAL}\n`)).toBe(LLAVE_REAL);
  });

  it("deja una llave utilizable, con encabezado y cierre en su propia línea", () => {
    const lineas = normalizarLlave(LLAVE_ESCAPADA).split("\n");
    expect(lineas[0]).toBe("-----BEGIN PRIVATE KEY-----");
    expect(lineas.at(-1)).toBe("-----END PRIVATE KEY-----");
    expect(lineas.length).toBeGreaterThan(2);
  });
});

describe("variablesFaltantes", () => {
  it("las detecta cuando no están", () => {
    expect(variablesFaltantes().map((v) => v.nombre)).toEqual([
      "GOOGLE_SA_EMAIL",
      "GOOGLE_SA_KEY",
      "DRIVE_TEST_FOLDER",
    ]);
  });

  it("trata una variable vacía como faltante", () => {
    // Es el error típico al copiar y pegar en un panel web.
    process.env.GOOGLE_SA_EMAIL = "   ";
    expect(variablesFaltantes().some((v) => v.nombre === "GOOGLE_SA_EMAIL")).toBe(true);
  });

  it("no reporta nada cuando están todas", () => {
    process.env.GOOGLE_SA_EMAIL = "robot@proyecto.iam.gserviceaccount.com";
    process.env.GOOGLE_SA_KEY = LLAVE_ESCAPADA;
    process.env.DRIVE_TEST_FOLDER = "1AbC";
    expect(variablesFaltantes()).toEqual([]);
  });
});

describe("credencialesDeGoogle", () => {
  it("explica qué falta y dónde configurarlo", () => {
    expect(() => credencialesDeGoogle()).toThrowError(/GOOGLE_SA_EMAIL/);
    expect(() => credencialesDeGoogle()).toThrowError(/Netlify/);
  });

  it("entrega la llave lista para usar viniendo de Netlify", () => {
    process.env.GOOGLE_SA_EMAIL = "robot@proyecto.iam.gserviceaccount.com";
    process.env.GOOGLE_SA_KEY = LLAVE_ESCAPADA;

    const { llave } = credencialesDeGoogle();
    expect(llave).toBe(LLAVE_REAL);
    expect(llave).not.toContain("\\n");
  });

  it("entrega la misma llave viniendo de .env.local", () => {
    process.env.GOOGLE_SA_EMAIL = "robot@proyecto.iam.gserviceaccount.com";
    process.env.GOOGLE_SA_KEY = LLAVE_REAL;

    expect(credencialesDeGoogle().llave).toBe(LLAVE_REAL);
  });

  it("limpia espacios sobrantes en el correo", () => {
    process.env.GOOGLE_SA_EMAIL = "  robot@proyecto.iam.gserviceaccount.com  ";
    process.env.GOOGLE_SA_KEY = LLAVE_ESCAPADA;

    expect(credencialesDeGoogle().email).toBe("robot@proyecto.iam.gserviceaccount.com");
  });
});
