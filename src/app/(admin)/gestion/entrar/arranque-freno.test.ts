// El freno del arranque no se saltea cambiando el correo.
//
// En el arranque la contraseña que abre es `CLAVE_DE_ADMIN`, y no depende del
// correo que se escriba. Cuando el freno se contaba por correo —como el resto
// de la puerta—, rotar el correo en cada intento daba una cuenta nueva cada
// vez: intentos ilimitados contra la clave del equipo. Esta prueba fija que el
// freno del arranque cuenta contra una sola cuenta, así que ocho por minuto
// siguen siendo ocho aunque el correo cambie en cada intento.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Todo el estado vive en memoria: los frenos, las claves y el equipo salen del
// mismo almacén, y así la prueba no toca ni la base ni el disco.
vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);
// La puerta no llega a firmar ni a redirigir en los caminos que fallan, pero se
// mockean por las dudas para que un cambio futuro no despierte a Next.
vi.mock("next/headers", () => ({ cookies: async () => ({ set: () => {}, delete: () => {} }) }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const { entrar } = await import("@/app/(admin)/gestion/entrar/acciones");

const conCorreo = (correo: string, clave: string) => {
  const f = new FormData();
  f.set("correo", correo);
  f.set("clave", clave);
  return entrar(undefined, f);
};

beforeEach(() => {
  // Almacén limpio: nadie tiene clave, así que la puerta está en arranque.
  memoriaDePruebas.vaciar();
  vi.stubEnv("CLAVE_DE_ADMIN", "la-del-equipo");
});

describe("el freno del arranque", () => {
  it("frena aunque el correo cambie en cada intento", async () => {
    // Ocho intentos con la clave equivocada, cada uno con un correo distinto.
    // Con el freno por correo, cada uno estrenaba cuenta y ninguno frenaba.
    for (let i = 0; i < 8; i++) {
      const r = await conCorreo(`atacante${i}@x.com`, "no-es-la-clave");
      expect(r.ok, `el intento ${i} no debería entrar`).toBe(false);
      expect(r.motivo, `el intento ${i} no debería estar frenado todavía`).not.toContain(
        "Demasiados"
      );
    }

    // El noveno, con otro correo más, ya cae en el freno: la cuenta es una sola.
    const noveno = await conCorreo("atacante-nuevo@x.com", "no-es-la-clave");
    expect(noveno.ok).toBe(false);
    expect(noveno.motivo).toContain("Demasiados");
  });

  it("un correo nuevo tampoco esquiva el freno ya puesto", async () => {
    for (let i = 0; i < 9; i++) await conCorreo(`a${i}@x.com`, "no-es-la-clave");

    // Correo jamás usado: igual está frenado, porque el freno no es por correo.
    const otro = await conCorreo("recien-llegado@x.com", "no-es-la-clave");
    expect(otro.motivo).toContain("Demasiados");
  });
});
