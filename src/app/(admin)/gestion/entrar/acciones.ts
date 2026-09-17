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
import { cambiarPersona, personaPorCorreo, seccionesDePersona } from "@/lib/equipo";
import { dondeEmpieza, seccionDeLaRuta, type Seccion } from "@/dominio/roles";
import { pedirOtraClave } from "@/lib/olvidos";

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
  if (frenado(correo)) return { ok: false as const, motivo: DEMASIADOS };

  const persona = await personaPorCorreo(correo);
  const primeraVez = Boolean(persona) && !(await tieneClave(persona!.id));

  return { ok: true as const, correo, primeraVez };
}

export async function entrar(_previo: unknown, formulario: FormData) {
  const correo = leerCorreo(formulario);
  const clave = String(formulario.get("clave") ?? "");
  const repetida = String(formulario.get("repetida") ?? "");
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const volver = String(formulario.get("volver") ?? "");

  if (!hayContrasena()) {
    return {
      ok: false as const,
      motivo: "Falta configurar CLAVE_DE_ADMIN. Sin eso no se puede entrar.",
    };
  }

  // El freno cuenta por correo: probar contra una cuenta no traba a las demás.
  const quien = correo || "(sin correo)";
  if (frenado(quien)) return { ok: false as const, motivo: DEMASIADOS };

  // **El arranque.** Sin nadie con contraseña, la llave del equipo abre para
  // poder dar de alta a la primera persona. Se cierra solo en cuanto alguien
  // tiene la suya.
  if (!(await hayAlguienConClave())) {
    if (!contrasenaCorrecta(clave)) {
      fallo(quien);
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

  const persona = await personaPorCorreo(correo);

  // **La primera vez, la contraseña la elige quien entra.** Se pide dos veces
  // porque acá no hay con qué compararla: lo que se escriba queda guardado, y
  // un dedo de más dejaría afuera a la única persona que tendría que poder
  // entrar.
  if (persona && !(await tieneClave(persona.id))) {
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
    // El alta trae un nombre sacado del correo: si acá escribió el suyo, gana
    // el suyo. Es con el que va a quedar firmado todo lo que haga.
    if (nombre.length >= 2 && nombre !== persona.nombre) {
      await cambiarPersona(persona.id, { nombre });
    }

    intentos.delete(quien);
    await abrir(persona.id);
    redirect(aDondeVa(volver, seccionesDePersona(persona)));
  }

  // **Mismo mensaje para «ese correo no existe» y «esa contraseña no es».**
  // Distinguirlos le dice a quien prueba cuáles correos existen, que es la
  // mitad del trabajo de adivinar.
  if (!persona || !(await claveCorrecta(persona.id, clave))) {
    fallo(quien);
    return { ok: false as const, motivo: NO_ES };
  }

  intentos.delete(quien);
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
  if (frenado(correo)) return { ok: false as const, motivo: DEMASIADOS };

  const persona = await personaPorCorreo(correo);
  if (persona) await pedirOtraClave(persona.id);
  // Se cuenta como intento igual: si no, esto sería una forma de probar
  // correos sin gastar el freno de la contraseña.
  fallo(correo);

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
