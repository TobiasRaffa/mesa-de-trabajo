"use server";

// Entrar y salir.
//
// **Es la única puerta de la agencia**, y por eso vive sola: todo lo que
// cuelga de `/gestion` pasa por `proxy.ts`, que exige la galleta que se firma
// acá. Una pantalla nueva nace protegida sin que nadie tenga que acordarse.
//
// Dos formas de entrar, y la segunda se cierra sola:
//
//   1. **Con la contraseña propia.** El correo es el que la agencia ya cargó
//      en Admin → El equipo: esa lista **es** la lista de usuarios, no hay otra
//      que mantener.
//   2. **Con la llave del equipo**, mientras nadie tenga contraseña. Es el
//      arranque: sin esto, la primera vez no habría forma de entrar a cargar
//      la primera contraseña. En cuanto alguien tiene la suya, este camino deja
//      de existir.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  contrasenaCorrecta,
  GALLETA_DE_GESTION,
  hayContrasena,
  SIN_PERSONA,
  valorDeSesion,
} from "@/lib/contrasena";
import { claveCorrecta, hayAlguienConClave } from "@/lib/claves";
import { elEquipo } from "@/lib/equipo";

export type Rechazo = { ok: false; motivo: string };

/**
 * Cuánto dura la sesión.
 *
 * Una semana: en la computadora de la oficina, pedirla todos los días es el
 * fastidio que hizo que la puerta se sacara la primera vez. Cambiar
 * `CLAVE_DE_ADMIN` las corta todas en el acto, sin lista que mantener.
 */
const DURACION = 60 * 60 * 24 * 7;

/**
 * **El freno de los intentos.** Sin esto, probar contraseñas contra esta
 * pantalla es gratis y automatizable.
 *
 * Vive en memoria, así que sirve en una computadora y no en internet, donde
 * cada pedido puede caer en otra máquina. Está anotado como pendiente en
 * DESPLIEGUE.md junto al mismo freno del portal, que tiene el mismo problema y
 * se arregla igual: moverlo al almacén.
 */
const ESPERA_MS = 60 * 1000;
const TOPE = 8;
const intentos = new Map<string, { cuantos: number; hasta: number }>();

function frenado(quien: string): boolean {
  const registro = intentos.get(quien);
  if (!registro) return false;
  if (Date.now() > registro.hasta) {
    intentos.delete(quien);
    return false;
  }
  return registro.cuantos >= TOPE;
}

function fallo(quien: string): void {
  const ahora = Date.now();
  const registro = intentos.get(quien);
  if (!registro || ahora > registro.hasta) {
    intentos.set(quien, { cuantos: 1, hasta: ahora + ESPERA_MS });
    return;
  }
  registro.cuantos += 1;
}

async function abrir(personaId: string): Promise<void> {
  const valor = valorDeSesion(personaId);
  if (!valor) return;

  (await cookies()).set(GALLETA_DE_GESTION, valor, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DURACION,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function entrar(_previo: unknown, formulario: FormData) {
  const correo = String(formulario.get("correo") ?? "")
    .trim()
    .toLowerCase();
  const clave = String(formulario.get("clave") ?? "");
  const volver = String(formulario.get("volver") ?? "");

  if (!hayContrasena()) {
    return {
      ok: false as const,
      motivo: "Falta configurar CLAVE_DE_ADMIN. Sin eso no se puede entrar.",
    };
  }

  // El freno cuenta por correo: probar contra una cuenta no traba a las demás.
  const quien = correo || "(sin correo)";
  if (frenado(quien)) {
    return { ok: false as const, motivo: "Demasiados intentos. Probá en un minuto." };
  }

  const alguienTiene = await hayAlguienConClave();

  // **El arranque.** Sin nadie con contraseña, la llave del equipo abre para
  // poder cargar la primera. Se cierra solo en cuanto alguien tiene la suya.
  if (!alguienTiene) {
    if (!contrasenaCorrecta(clave)) {
      fallo(quien);
      return {
        ok: false as const,
        motivo:
          "Todavía nadie del equipo tiene contraseña. Entrá con la clave del " +
          "equipo y cargalas en Admin.",
      };
    }
    await abrir(SIN_PERSONA);
    redirect(volver.startsWith("/gestion") ? volver : "/gestion");
  }

  const persona = (await elEquipo()).find(
    (p) => p.correo.trim().toLowerCase() === correo && correo
  );

  // **Mismo mensaje para «ese correo no existe» y «esa contraseña no es».**
  // Distinguirlos le dice a quien prueba cuáles correos existen, que es la
  // mitad del trabajo de adivinar.
  if (!persona || !(await claveCorrecta(persona.id, clave))) {
    fallo(quien);
    return { ok: false as const, motivo: "El correo o la contraseña no son." };
  }

  intentos.delete(quien);
  await abrir(persona.id);
  redirect(volver.startsWith("/gestion") ? volver : "/gestion");
}

export async function salir() {
  (await cookies()).delete(GALLETA_DE_GESTION);
  redirect("/gestion/entrar");
}
