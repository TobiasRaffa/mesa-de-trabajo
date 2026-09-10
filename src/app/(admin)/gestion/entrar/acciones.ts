"use server";

// Abrir la puerta de gestión.
//
// Es el único lugar donde se compara la contraseña de la agencia. Lo que queda
// después de acertarla es una galleta firmada por el servidor: no lleva la
// contraseña adentro, y como se deriva de ella, cambiarla echa a todo el mundo.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  contrasenaCorrecta,
  GALLETA_DE_GESTION,
  hayContrasena,
  valorDeGalletaDeGestion,
} from "@/lib/contrasena";

export type ResultadoDeEntrada = { ok: false; motivo: string };

/** Una semana. La agencia entra todos los días; el cliente, cada tanto. */
const DURACION = 60 * 60 * 24 * 7;

/**
 * A dónde volver después de entrar.
 *
 * Solo direcciones de acá adentro, y solo las que esta puerta protege. Sin
 * esto, alguien podría mandar un link a `/gestion/entrar?volver=https://…` y
 * usar nuestra pantalla de entrada como trampolín a otro sitio.
 */
function destinoSeguro(volver: string): string {
  if (volver === "/diagnostico") return volver;
  if (volver === "/gestion" || volver.startsWith("/gestion/")) {
    // Volver a la propia entrada dejaría al equipo dando vueltas en círculo.
    return volver === "/gestion/entrar" ? "/gestion" : volver;
  }
  return "/gestion";
}

export async function entrarAGestion(
  _previo: unknown,
  formulario: FormData
): Promise<ResultadoDeEntrada> {
  if (!hayContrasena()) {
    return {
      ok: false,
      motivo: "Falta configurar CLAVE_DE_ADMIN. Sin eso no se abre nada.",
    };
  }

  const escrita = String(formulario.get("contrasena") ?? "");
  if (!contrasenaCorrecta(escrita)) {
    return { ok: false, motivo: "Esa no es la contraseña." };
  }

  const valor = valorDeGalletaDeGestion();
  if (!valor) return { ok: false, motivo: "Falta configurar CLAVE_DE_ADMIN." };

  (await cookies()).set(GALLETA_DE_GESTION, valor, {
    // El navegador no puede leerla desde JavaScript.
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DURACION,
    // En producción solo viaja por https. En la máquina no, porque ahí es http.
    secure: process.env.NODE_ENV === "production",
  });

  redirect(destinoSeguro(String(formulario.get("volver") ?? "")));
}
