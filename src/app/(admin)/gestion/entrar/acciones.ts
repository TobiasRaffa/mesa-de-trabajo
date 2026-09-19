"use server";

// Entrar y salir.
//
// **Es la única puerta de la agencia**, y por eso vive sola: todo lo que
// cuelga de `/gestion` pasa por `proxy.ts`, que exige la galleta que se firma
// acá. Una pantalla nueva nace protegida sin que nadie tenga que acordarse.
//
// **Se entra en dos pasos, y el segundo depende de quién sos.** Primero el
// correo; después, o la contraseña que ya tenés, o —si es tu primera vez— la
// que vas a elegir ahora. Un solo campo de contraseña para las dos cosas
// parecía más simple y era peor: la primera vez, un dedo de más quedaba
// guardado para siempre como tu contraseña sin que nada lo repitiera.
//
// **El alta la hace otra persona y no incluye contraseña.** Quien administra
// carga un correo y un rol; la contraseña la elegís vos acá la primera vez, y
// desde ese momento no la sabe nadie más. Nunca pasó por manos de nadie.
//
// **Qué se cuida de no contar.** Preguntar por un correo no dice si ese correo
// existe: uno que no está cargado se comporta igual que uno cargado que ya
// tiene contraseña —pide contraseña y después no entra—, con el mismo texto y
// el mismo camino. Lo único que se distingue desde afuera es un correo que
// está cargado y todavía no entró nunca, y eso es inevitable: es justamente la
// pantalla que esa persona tiene que poder ver.
//
// Y queda el arranque, que se cierra solo: mientras nadie tenga contraseña, la
// llave del equipo abre para poder cargar a la primera persona. En cuanto
// alguien tiene la suya, ese camino deja de existir.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  contrasenaCorrecta,
  DURACION_DE_SESION,
  GALLETA_DE_GESTION,
  hayContrasena,
  SIN_PERSONA,
  valorDeSesion,
} from "@/lib/contrasena";
import {
  claveCorrecta,
  hayAlguienConClave,
  LARGO_MINIMO_DE_CLAVE,
  ponerClave,
  tieneClave,
} from "@/lib/claves";
import {
  borrarCodigoDeAlta,
  cambiarPersona,
  codigoDeAltaCorrecto,
  codigoDeAltaDe,
  personaPorCorreo,
  seccionesDePersona,
} from "@/lib/equipo";
import { dondeEmpieza, seccionDeLaRuta, type Seccion } from "@/dominio/roles";
import { pedirOtraClave } from "@/lib/olvidos";
import { anotarError, frenado, olvidarErrores, type Limite } from "@/lib/frenos";

export type Rechazo = { ok: false; motivo: string };

const DURACION = DURACION_DE_SESION;

/**
 * **El freno de los intentos.** Sin esto, probar contraseñas contra esta
 * pantalla es gratis y automatizable.
 *
 * La cuenta vive en el almacén y no en memoria: en internet cada pedido puede
 * caer en otra máquina, y ocho intentos repartidos entre ocho máquinas con la
 * cuenta en cero no los frena nadie. Está explicado en `lib/frenos.ts`.
 *
 * Ocho por minuto y por correo. El minuto es corto a propósito: quien se
 * equivocó de verdad no tiene que irse a tomar un café, y quien viene a probar
 * un diccionario con ocho por minuto tarda años igual.
 */
const LIMITE: Limite = { tope: 8, espera: 60 * 1000 };

/** El freno cuenta por correo: probar contra una cuenta no traba a las demás. */
const paraQuien = (correo: string) => `puerta:${correo || "(sin correo)"}`;

const NO_ES = "El correo o la contraseña no son.";
const DEMASIADOS = "Demasiados intentos. Probá en un minuto.";

const leerCorreo = (formulario: FormData) =>
  String(formulario.get("correo") ?? "")
    .trim()
    .toLowerCase();

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

/**
 * A dónde ir después de entrar.
 *
 * Solo adentro de la gestión, y solo a una sección que esa persona pueda ver:
 * un link viejo a las facturas no puede convertirse en un rebote apenas
 * escribió su contraseña. Sin link, cae en la primera sección que le toca, que
 * no siempre es la lista de clientes.
 */
function aDondeVa(volver: string, secciones: readonly Seccion[]): string {
  const propia = dondeEmpieza(secciones) ?? "/gestion";
  if (!volver.startsWith("/gestion")) return propia;

  const seccion = seccionDeLaRuta(volver.split("?")[0]);
  return seccion && secciones.includes(seccion) ? volver : propia;
}

/**
 * Paso uno: de quién es este correo.
 *
 * Contesta solo «pedile la contraseña» o «que elija una», nunca «ese correo no
 * existe». Un correo desconocido cae en la primera, igual que uno conocido que
 * ya tiene contraseña: el que prueba correos ajenos se lleva siempre la misma
 * pantalla.
 */
export async function mirarCorreo(_previo: unknown, formulario: FormData) {
  const correo = leerCorreo(formulario);
  if (!correo) return { ok: false as const, motivo: "Escribí tu correo." };
  if (await frenado(paraQuien(correo), LIMITE)) {
    return { ok: false as const, motivo: DEMASIADOS };
  }

  // Mirar un correo cuenta como un intento: sin esto, esta pantalla era la
  // forma cómoda de listar quiénes trabajan en la agencia, sin freno alguno.
  // Entrar bien pone la cuenta en cero.
  await anotarError(paraQuien(correo), LIMITE);

  const persona = await personaPorCorreo(correo);
  const primeraVez = Boolean(persona) && !(await tieneClave(persona!.id));

  return { ok: true as const, correo, primeraVez };
}

export async function entrar(_previo: unknown, formulario: FormData) {
  const correo = leerCorreo(formulario);
  const clave = String(formulario.get("clave") ?? "");
  const repetida = String(formulario.get("repetida") ?? "");
  const codigo = String(formulario.get("codigo") ?? "");
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const volver = String(formulario.get("volver") ?? "");

  if (!hayContrasena()) {
    return {
      ok: false as const,
      motivo: "Falta configurar CLAVE_DE_ADMIN. Sin eso no se puede entrar.",
    };
  }

  const quien = paraQuien(correo);
  if (await frenado(quien, LIMITE)) return { ok: false as const, motivo: DEMASIADOS };

  const persona = correo ? await personaPorCorreo(correo) : null;

  // **La primera vez, la contraseña la elige quien entra.** Va antes que el
  // arranque a propósito: la primera persona del equipo también entra por
  // acá, y durante un tiempo no pudo —el arranque le pedía la llave del
  // equipo en el campo donde escribía su contraseña nueva, y el arranque no
  // se cerraba nunca—.
  //
  // Se pide dos veces porque acá no hay con qué compararla: lo que se escriba
  // queda guardado, y un dedo de más dejaría afuera a la única persona que
  // tendría que poder entrar. Y se pide **el código de alta**: sin él, saber
  // el correo de alguien alcanzaba para quedarse con su cuenta.
  if (persona && !(await tieneClave(persona.id))) {
    if (!(await codigoDeAltaCorrecto(persona.id, codigo))) {
      await anotarError(quien, LIMITE);
      return {
        ok: false as const,
        motivo: (await codigoDeAltaDe(persona.id))
          ? "Ese código de alta no es. Te lo pasa quien te dio de alta: lo ve en Admin."
          : "Tu cuenta todavía no tiene código de alta. Pedile a quien administra " +
            "que te lo genere en Admin y te lo pase.",
      };
    }
    if (clave.length < LARGO_MINIMO_DE_CLAVE) {
      return {
        ok: false as const,
        motivo: `La contraseña tiene que tener al menos ${LARGO_MINIMO_DE_CLAVE} caracteres.`,
      };
    }
    if (clave !== repetida) {
      return { ok: false as const, motivo: "Las dos contraseñas no son iguales." };
    }

    await ponerClave(persona.id, clave);
    await borrarCodigoDeAlta(persona.id);
    // El alta trae un nombre sacado del correo: si acá escribió el suyo, gana
    // el suyo. Es con el que va a quedar firmado todo lo que haga.
    if (nombre.length >= 2 && nombre !== persona.nombre) {
      await cambiarPersona(persona.id, { nombre });
    }

    await olvidarErrores(quien);
    await abrir(persona.id);
    redirect(aDondeVa(volver, seccionesDePersona(persona)));
  }

  // **El arranque.** Sin nadie con contraseña, la llave del equipo abre para
  // poder dar de alta a la primera persona. Se cierra solo en cuanto alguien
  // tiene la suya: desde ahí, esta llave no abre nada.
  if (!(await hayAlguienConClave())) {
    if (!contrasenaCorrecta(clave)) {
      await anotarError(quien, LIMITE);
      return {
        ok: false as const,
        motivo:
          "Todavía nadie del equipo tiene contraseña. Entrá con la clave del " +
          "equipo y dá de alta a la primera persona en Admin.",
      };
    }
    await abrir(SIN_PERSONA);
    redirect(volver.startsWith("/gestion") ? volver : "/gestion");
  }

  // **Mismo mensaje para «ese correo no existe» y «esa contraseña no es».**
  // Distinguirlos le dice a quien prueba cuáles correos existen, que es la
  // mitad del trabajo de adivinar.
  if (!persona || !(await claveCorrecta(persona.id, clave))) {
    await anotarError(quien, LIMITE);
    return { ok: false as const, motivo: NO_ES };
  }

  await olvidarErrores(quien);
  await abrir(persona.id);
  redirect(aDondeVa(volver, seccionesDePersona(persona)));
}

/**
 * «Olvidé mi contraseña».
 *
 * Deja el pedido anotado para que quien administra lo vea en Admin y le
 * reinicie la contraseña. No manda nada por correo ni abre ninguna puerta: lo
 * único que hace es avisar.
 *
 * **Contesta lo mismo exista o no el correo.** Si contestara «ese correo no
 * está», esta pantalla se volvería la forma cómoda de averiguar quiénes
 * trabajan en la agencia.
 */
export async function olvide(_previo: unknown, formulario: FormData) {
  const correo = leerCorreo(formulario);
  if (!correo) return { ok: false as const, motivo: "Escribí tu correo." };
  if (await frenado(paraQuien(correo), LIMITE)) {
    return { ok: false as const, motivo: DEMASIADOS };
  }

  const persona = await personaPorCorreo(correo);
  if (persona) await pedirOtraClave(persona.id);
  // Se cuenta como intento igual: si no, esto sería una forma de probar
  // correos sin gastar el freno de la contraseña.
  await anotarError(paraQuien(correo), LIMITE);

  return {
    ok: true as const,
    motivo:
      "Listo. Avisale a quien administra la aplicación: le va a aparecer tu " +
      "pedido en Admin. Cuando te la reinicie, entrás eligiendo una nueva.",
  };
}

export async function salir() {
  (await cookies()).delete(GALLETA_DE_GESTION);
  redirect("/gestion/entrar");
}
