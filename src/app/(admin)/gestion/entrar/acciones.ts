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
// **No hay clave maestra para entrar.** La primera persona admin se carga
// directo en la base (un SQL, sin pasar por ninguna pantalla), con su correo y
// un código de alta. Desde ahí, todo el mundo entra con correo y contraseña.

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  DURACION_DE_SESION,
  GALLETA_DE_GESTION,
  hayContrasena,
  valorDeSesion,
} from "@/lib/contrasena";
import {
  claveCorrecta,
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
import { frenado, intentarYFrenar, olvidarErrores, type Limite } from "@/lib/frenos";
import { mandarCorreo } from "@/lib/correo";
import {
  crearLinkDeRestablecer,
  cuerpoDeRestablecer,
  gastarLinkDeRestablecer,
  personaDelLink,
  RESTABLECER,
} from "@/lib/restablecer";
import { after } from "next/server";

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

/**
 * **Además del minuto, la hora.** Ocho por minuto, sin más, son once mil
 * intentos por día contra una cuenta: alcanza para probar las contraseñas más
 * comunes. Treinta por hora lo baja a unos setecientos. Quien quedó trabada de
 * verdad tiene «olvidé mi contraseña», que va por otro contador.
 */
const LIMITE_POR_HORA: Limite = { tope: 30, espera: 60 * 60 * 1000 };

async function estaFrenado(quien: string): Promise<boolean> {
  return (await frenado(quien, LIMITE)) || (await frenado(`hora:${quien}`, LIMITE_POR_HORA));
}

/** Cuenta el intento en los dos frenos y dice si alguno ya se pasó. */
async function contarIntento(quien: string): Promise<boolean> {
  const porMinuto = await intentarYFrenar(quien, LIMITE);
  const porHora = await intentarYFrenar(`hora:${quien}`, LIMITE_POR_HORA);
  return porMinuto || porHora;
}

async function olvidarIntentos(quien: string): Promise<void> {
  await olvidarErrores(quien);
  await olvidarErrores(`hora:${quien}`);
}

/** El freno cuenta por correo: probar contra una cuenta no traba a las demás. */
const paraQuien = (correo: string) => `puerta:${correo || "(sin correo)"}`;

const NO_ES = "El correo o la contraseña son incorrectos.";

/**
 * La sesión se firma con `CLAVE_DE_ADMIN`. Sin ella no hay cómo abrirla, y
 * seguir de largo era peor: se guardaba la contraseña y se volvía a la puerta
 * sin ningún aviso. Se corta antes de tocar nada.
 */
const SIN_FIRMA =
  "El servidor no está configurado para abrir sesiones: falta CLAVE_DE_ADMIN.";
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

export async function entrar(_previo: unknown, formulario: FormData) {
  if (process.env.SOLO_PORTAL === "1") notFound();
  const correo = leerCorreo(formulario);
  const clave = String(formulario.get("clave") ?? "");
  const repetida = String(formulario.get("repetida") ?? "");
  const codigo = String(formulario.get("codigo") ?? "");
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const volver = String(formulario.get("volver") ?? "");

  if (!hayContrasena()) return { ok: false as const, motivo: SIN_FIRMA };

  const quien = paraQuien(correo);
  if (await estaFrenado(quien)) return { ok: false as const, motivo: DEMASIADOS };

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
    // **La pantalla es una sola y acá se decide cuál mostrar.** Antes había un
    // paso previo que preguntaba solo el correo para saber a quién le tocaba
    // cuál: eso son dos pantallas, dos clics y una espera al servidor **cada
    // vez que alguien entra**, para un caso que le pasa a cada persona una sola
    // vez en la vida. Ahora el correo y la contraseña se escriben juntos —que
    // además es lo que un administrador de contraseñas sabe completar— y si
    // resulta ser la primera vez, la pantalla se abre acá.
    //
    // No cuenta nada que no contara antes: `primeraVez` sale solo para alguien
    // que existe y todavía no eligió contraseña, que es exactamente lo que
    // contestaba el paso que se fue.
    if (!codigo) {
      return {
        ok: false as const,
        primeraVez: true as const,
        motivo: "Es tu primera vez: elegí tu contraseña.",
      };
    }
    // Desde acá es un intento de verdad: se cuenta y se frena en un solo paso,
    // así una ráfaga de pedidos a la vez no se cuela toda entre el chequeo de
    // arriba y el conteo. Ya contado, los errores de abajo no vuelven a sumar.
    if (await contarIntento(quien)) {
      return { ok: false as const, primeraVez: true as const, motivo: DEMASIADOS };
    }
    if (!(await codigoDeAltaCorrecto(persona.id, codigo))) {
      return {
        ok: false as const,
        primeraVez: true as const,
        motivo: (await codigoDeAltaDe(persona.id))
          ? "Ese código de alta no es. Te lo pasa quien te dio de alta: lo ve en Admin."
          : "Tu cuenta todavía no tiene código de alta. Pedile a quien administra " +
            "que te lo genere en Admin y te lo pase.",
      };
    }
    if (clave.length < LARGO_MINIMO_DE_CLAVE) {
      return {
        ok: false as const,
        primeraVez: true as const,
        motivo: `La contraseña tiene que tener al menos ${LARGO_MINIMO_DE_CLAVE} caracteres.`,
      };
    }
    if (clave !== repetida) {
      return {
        ok: false as const,
        primeraVez: true as const,
        motivo: "Las dos contraseñas no son iguales.",
      };
    }

    await ponerClave(persona.id, clave);
    await borrarCodigoDeAlta(persona.id);
    // El alta trae un nombre sacado del correo: si acá escribió el suyo, gana
    // el suyo. Es con el que va a quedar firmado todo lo que haga.
    if (nombre.length >= 2 && nombre !== persona.nombre) {
      await cambiarPersona(persona.id, { nombre });
    }

    await olvidarIntentos(quien);
    await abrir(persona.id);
    redirect(aDondeVa(volver, seccionesDePersona(persona)));
  }


  // **Mismo mensaje para «ese correo no existe» y «esa contraseña no es».**
  // Distinguirlos le dice a quien prueba cuáles correos existen, que es la
  // mitad del trabajo de adivinar.
  //
  // **Y el mismo tiempo.** Con `!persona || !(await claveCorrecta(...))`, un
  // correo que no existe salía sin derivar nada —microsegundos— y uno real con
  // contraseña pagaba el `scrypt`, que tarda decenas de milisegundos a
  // propósito. Esa diferencia se mide desde afuera y convierte esta pantalla
  // en la forma cómoda de averiguar qué correos están cargados —lo mismo que
  // el mensaje único viene a evitar—. Por eso se deriva **siempre**: contra un
  // correo que no existe, contra una huella de mentira. Es la misma defensa que
  // ya hace `claveCorrecta` cuando la persona existe pero no tiene clave.
  // Se cuenta y se frena en un solo paso, antes de validar: solo `tope` intentos
  // por ventana llegan a comparar la contraseña, aunque lleguen todos juntos.
  if (await contarIntento(quien)) {
    return { ok: false as const, motivo: DEMASIADOS };
  }

  const correcta = persona
    ? await claveCorrecta(persona.id, clave)
    : await claveCorrecta("", clave);
  // `|| !persona` es redundante en tiempo de ejecución —sin persona, `correcta`
  // ya es falso— pero le dice al compilador que más abajo `persona` no es nula.
  if (!correcta || !persona) {
    return { ok: false as const, motivo: NO_ES };
  }

  await olvidarIntentos(quien);
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
  if (process.env.SOLO_PORTAL === "1") notFound();
  const correo = leerCorreo(formulario);
  if (!correo) return { ok: false as const, motivo: "Escribí tu correo." };

  // Se cuenta el pedido y se frena en un solo paso. Cuenta siempre —exista o no
  // el correo— porque si no, esto sería una forma de probar correos sin gastar
  // el freno de la contraseña; y contar y frenar juntos cierra la ventana por
  // la que una ráfaga se colaba entre el chequeo y el conteo.
  // **Su propio contador, no el de la contraseña.** Si compartieran cuenta,
  // apretar «olvidé» varias veces dejaría a esa persona sin poder entrar.
  if (await intentarYFrenar(`olvido:${correo}`, LIMITE)) {
    return { ok: false as const, motivo: DEMASIADOS };
  }

  // **Todo lo demás, después de contestar.** Buscar a la persona, anotar el
  // pedido y armar el link son viajes a la base que un correo inexistente no
  // haría: si se esperaran acá, el tiempo de respuesta diría qué correos existen.
  after(() => mandarLinkDeRestablecer(correo));

  return {
    ok: true as const,
    motivo:
      "Si ese correo es del equipo, te va a llegar un link para elegir una contraseña " +
      "nueva. Vence en 30 minutos.",
  };
}

async function mandarLinkDeRestablecer(correo: string): Promise<void> {
  const persona = await personaPorCorreo(correo);
  if (!persona) return;

  // Queda anotado también para Admin: si el correo no llega, quien administra
  // igual ve que alguien no puede entrar.
  await pedirOtraClave(persona.id);

  // **Solo a quien ya tiene contraseña.** Quien todavía no eligió la suya entra
  // con su código de alta; un link por correo se lo salteaba, y alcanzaba con
  // tener acceso a ese buzón para quedarse con la cuenta.
  if (!(await tieneClave(persona.id))) return;

  // La dirección sale de la configuración, nunca del pedido: armarla con el
  // `Host` que manda el navegador dejaría a cualquiera elegir a dónde apunta el
  // link que le llega a otra persona.
  const base = (process.env.GESTION_URL || process.env.URL || "").trim().replace(/\/$/, "");
  if (!base) {
    console.error("[olvide] Falta GESTION_URL: no se puede armar el link.");
    return;
  }

  // `null` si ya se mandó uno hace muy poco: apretar «olvidé» muchas veces no
  // llena la bandeja de nadie.
  const token = await crearLinkDeRestablecer(persona.id);
  if (!token) return;

  const r = await mandarCorreo(
    persona.correo,
    "Mesa de trabajo · Elegí una contraseña nueva",
    cuerpoDeRestablecer(`${base}${RESTABLECER}?t=${token}`)
  );
  if (r.estado !== "enviado") console.error("[olvide] El correo no salió:", r);
}

/**
 * Elegir la contraseña nueva desde el link del correo.
 *
 * **Es la cuarta acción de esta pantalla, y se decidió a propósito.** Va acá y
 * no en otra carpeta para que siga siendo una sola puerta pública: el link trae
 * un token de un solo uso y de 30 minutos (ver `lib/restablecer.ts`), y con eso
 * —y solo con eso— se guarda una contraseña nueva y se abre la sesión.
 */
export async function restablecer(_previo: unknown, formulario: FormData) {
  if (process.env.SOLO_PORTAL === "1") notFound();
  const token = String(formulario.get("t") ?? "");
  const clave = String(formulario.get("clave") ?? "");
  const repetida = String(formulario.get("repetida") ?? "");

  if (!hayContrasena()) return { ok: false as const, motivo: SIN_FIRMA };

  // **Cada intento cuenta, tenga o no un link válido.** Si solo contaran los
  // links que existen, probar tokens al azar saldría gratis. El freno va por
  // token: lo que se protege es ese link, no la cuenta de la persona.
  const quien = `restablecer:${token.slice(0, 16)}`;
  if (await intentarYFrenar(quien, LIMITE)) {
    return { ok: false as const, motivo: DEMASIADOS };
  }

  const personaId = await personaDelLink(token);
  if (!personaId) {
    return {
      ok: false as const,
      motivo: "Este link ya no sirve: venció o ya se usó. Pedí uno nuevo.",
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

  // Guardar la contraseña también corta las sesiones viejas de esa persona (ver
  // `claveDesde` en `lib/claves.ts`). Después se gasta el link, para que no sirva
  // ni una segunda vez.
  await ponerClave(personaId, clave);
  await gastarLinkDeRestablecer(token);
  await olvidarErrores(quien);
  await abrir(personaId);
  // El proxy manda a la primera sección que le toque a esa persona.
  redirect("/gestion");
}

export async function salir() {
  (await cookies()).delete(GALLETA_DE_GESTION);
  redirect("/gestion/entrar");
}
