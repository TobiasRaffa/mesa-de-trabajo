"use server";

// Abrir la puerta del portal.
//
// Es el único lugar donde se compara un tag. Tres cuidados que valen la pena:
//
//   - **El tag no se devuelve nunca**, ni en un error. Un mensaje que dijera
//     «te falta una letra» sería un ayudante para adivinar.
//   - **Se frena al octavo intento** por link. El link ya es lo caro de
//     adivinar; el freno cubre el caso de alguien que consiguió el link y
//     prueba tags a mano.
//   - **La galleta no lleva el tag adentro.** Dice «este navegador acertó el de
//     este link», firmado por el servidor. Leerla no sirve para entrar a otro
//     lado y fabricarla necesita la llave.

import { cookies } from "next/headers";
import {
  anotarIntentoFallido,
  estaFrenado,
  nombreDeGalleta,
  normalizarTag,
  olvidarIntentos,
  puertaDe,
  valorDeGalleta,
} from "@/lib/acceso";

export type ResultadoDeEntrada = { ok: true } | { ok: false; motivo: string };

/** Un mes. Lo suficiente para no pedirle el tag en cada revisión. */
const DURACION = 60 * 60 * 24 * 30;

export async function entrarConTag(
  _previo: unknown,
  formulario: FormData
): Promise<ResultadoDeEntrada> {
  const token = String(formulario.get("token") ?? "");
  const escrito = String(formulario.get("tag") ?? "");

  if (await estaFrenado(token)) {
    return {
      ok: false,
      motivo: "Probaste muchas veces. Esperá unos minutos y volvé a intentar.",
    };
  }

  const puerta = await puertaDe(token);
  // Un link que no vale y un tag equivocado dan el mismo mensaje: distinguirlos
  // le diría a quien prueba si el link al menos existe.
  const tagDelCliente = puerta ? normalizarTag(puerta.cliente.tag) : "";

  if (!puerta || !tagDelCliente || normalizarTag(escrito) !== tagDelCliente) {
    await anotarIntentoFallido(token);
    return { ok: false, motivo: "Esa clave no es. Fijate con el equipo." };
  }

  await olvidarIntentos(token);

  const galletas = await cookies();
  galletas.set(await nombreDeGalleta(token), await valorDeGalleta(token), {
    // El navegador no puede leerla desde JavaScript: si alguna vez entra un
    // script ajeno en la página, no se la puede llevar.
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DURACION,
    // En producción solo viaja por https. En la máquina no, porque ahí es http.
    secure: process.env.NODE_ENV === "production",
  });

  return { ok: true };
}
