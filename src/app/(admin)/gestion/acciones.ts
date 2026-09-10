"use server";

// Lo que la app de gestión puede cambiar.
//
// **Una acción de servidor es un endpoint público.** Next le cambia el cuerpo
// por una referencia en el navegador, pero la dirección queda accesible para
// cualquiera que sepa mandar el POST. Que el formulario solo se dibuje en una
// pantalla interna no protege nada.
//
// Por eso acá no se cree nada de lo que llega: los identificadores se comparan
// contra lo que de verdad existe en Drive, y cada valor solo puede ser uno de
// los que conocemos. Sin eso, un POST armado a mano podría llenar los archivos
// de configuración con lo que quisiera.
//
// Lo que todavía NO hay es autenticación: cualquiera que llegue a la máquina
// puede entrar. Hoy alcanza porque la aplicación corre en una computadora y no
// está en internet. Antes de subirla, esto necesita login.

import { revalidatePath } from "next/cache";
import {
  esCarpetaReservada,
  guardarAjustesDe,
  linkDeCarpeta,
  type Vista,
} from "@/lib/ajustesDeCarpeta";
import { esCarpetaDelCliente, idsDeCarpetasReales, olvidarCarpetas } from "@/lib/carpetas";
import { habilitarCliente, ponerTag, renovarLink, todosLosClientes } from "@/lib/clientes";
import { agregarMensaje, LARGO_MAXIMO, type Mensaje } from "@/lib/conversaciones";
import { archivosDe } from "@/lib/google";
import {
  esDiaValido,
  guardarPublicaciones,
  type DiaSuelto,
} from "@/lib/publicaciones";

export type Resultado = { ok: true } | { ok: false; motivo: string };

// ---------------------------------------------------------------------------
// Carpetas

export async function guardarCarpeta(_previo: unknown, formulario: FormData) {
  const carpetaId = String(formulario.get("carpetaId") ?? "");
  const nombre = String(formulario.get("nombre") ?? "");
  const visible = formulario.get("visible") === "si";
  const vistaCruda = String(formulario.get("vista") ?? "lista");

  if (!carpetaId) return { ok: false as const, motivo: "Falta la carpeta." };

  const reales = await idsDeCarpetasReales();
  if (!reales.has(carpetaId)) {
    return {
      ok: false as const,
      motivo: "Esa carpeta no está adentro de la carpeta de un cliente.",
    };
  }

  if (esCarpetaReservada(nombre)) {
    return {
      ok: false as const,
      motivo: "«Entregas finales» no se configura: no es un trabajo.",
    };
  }

  const vista: Vista = vistaCruda === "calendario" ? "calendario" : "lista";

  await guardarAjustesDe(carpetaId, { visible, vista });

  // La pantalla se vuelve a dibujar con lo guardado, en el mismo viaje.
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Clientes

async function esClienteReal(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    return (await todosLosClientes()).some((c) => c.id === id);
  } catch {
    return false;
  }
}

export async function cambiarCliente(_previo: unknown, formulario: FormData) {
  const clienteId = String(formulario.get("clienteId") ?? "");
  const habilitado = formulario.get("habilitado") === "si";

  if (!(await esClienteReal(clienteId))) {
    return { ok: false as const, motivo: "Ese cliente no existe." };
  }

  await habilitarCliente(clienteId, habilitado);
  // Habilitar un cliente cambia qué carpetas se administran: lo recordado
  // quedó viejo.
  olvidarCarpetas();
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * Le da un link nuevo a un cliente.
 *
 * Es cómo se corta el acceso a quien tenga el viejo: alguien que se fue de la
 * empresa del cliente, un link reenviado a quien no correspondía. El viejo
 * deja de funcionar en el acto.
 */
export async function renovarLinkDeCliente(_previo: unknown, formulario: FormData) {
  const clienteId = String(formulario.get("clienteId") ?? "");

  if (!(await esClienteReal(clienteId))) {
    return { ok: false as const, motivo: "Ese cliente no existe." };
  }

  await renovarLink(clienteId);
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * Le pone el tag a un cliente.
 *
 * Es la palabra que el cliente escribe para entrar. Sin tag, su portal no deja
 * pasar a nadie —ni con el link correcto—, que es el estado seguro mientras
 * alguien no decidió cuál va.
 */
export async function ponerTagDeCliente(_previo: unknown, formulario: FormData) {
  const clienteId = String(formulario.get("clienteId") ?? "");
  const tag = String(formulario.get("tag") ?? "").trim();

  if (!(await esClienteReal(clienteId))) {
    return { ok: false as const, motivo: "Ese cliente no existe." };
  }
  if (tag.length < 3) {
    return { ok: false as const, motivo: "Poné al menos tres letras." };
  }

  await ponerTag(clienteId, tag);
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * El link propio de una carpeta, generándolo si hace falta.
 *
 * Muestra esa carpeta sola. Sirve para mandarle a un cliente «Calendario
 * septiembre» sin que de paso vea el resto de sus trabajos. Se entra con el
 * mismo tag del cliente.
 */
export async function pedirLinkDeCarpeta(carpetaId: string): Promise<
  { ok: true; token: string } | { ok: false; motivo: string }
> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no está adentro de la de un cliente." };
  }
  try {
    const token = await linkDeCarpeta(carpetaId);
    revalidatePath("/gestion", "layout");
    return { ok: true, token };
  } catch {
    return { ok: false, motivo: "No pude generar el link." };
  }
}

// ---------------------------------------------------------------------------
// Calendario

export type CambioDeFecha = { archivo: string; dia: DiaSuelto | null };

/**
 * Guarda las fechas de publicación de una carpeta, todas juntas.
 *
 * Se guarda de a una tanda y no pieza por pieza porque así se trabaja: se
 * acomodan varias en el calendario y recién ahí se aprieta guardar. Poder
 * cancelar sin haber tocado nada es la mitad del valor de tener un botón.
 */
export async function guardarCalendario(
  carpetaId: string,
  cambios: CambioDeFecha[]
): Promise<Resultado> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no está adentro de la carpeta de un cliente." };
  }

  if (!Array.isArray(cambios) || cambios.length > 500) {
    return { ok: false, motivo: "No pude leer los cambios." };
  }

  // Los archivos que llegan tienen que estar de verdad en esa carpeta: si no,
  // esto sería una forma de ponerle fecha a cualquier archivo de cualquier
  // cliente.
  const adentro = new Set((await archivosDe(carpetaId)).map((a) => a.id));

  const aGuardar: Record<string, DiaSuelto | null> = {};
  for (const cambio of cambios) {
    const archivo = String(cambio?.archivo ?? "");
    if (!adentro.has(archivo)) continue;

    if (cambio.dia === null) aGuardar[archivo] = null;
    else if (esDiaValido(cambio.dia)) aGuardar[archivo] = cambio.dia;
    else return { ok: false, motivo: "Hay una fecha que no existe." };
  }

  try {
    await guardarPublicaciones(aGuardar);
  } catch {
    return { ok: false, motivo: "No pude guardar las fechas. Probá de nuevo." };
  }

  revalidatePath("/gestion", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Conversación

export type RespuestaDeChat =
  | { ok: true; mensajes: Mensaje[] }
  | { ok: false; motivo: string };

/**
 * La agencia le contesta al cliente.
 *
 * Es la gemela de `escribirComoCliente`, del otro lado del mostrador. Están
 * separadas a propósito: **quién habla lo fija la acción, no el formulario**.
 * Con una sola acción y un parámetro, cualquiera podría mandar un POST desde
 * el portal diciendo ser la agencia.
 *
 * Y lo de siempre: acá contesta una persona. Esta función guarda lo que
 * alguien escribió y nada más.
 */
export async function escribirComoAgencia(
  carpetaId: string,
  texto: string
): Promise<RespuestaDeChat> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no está adentro de la del cliente." };
  }

  const limpio = String(texto ?? "").trim();
  if (!limpio) return { ok: false, motivo: "El mensaje está vacío." };
  if (limpio.length > LARGO_MAXIMO) {
    return { ok: false, motivo: "El mensaje es demasiado largo." };
  }

  try {
    // El nombre queda fijo hasta que existan los usuarios y los roles.
    const mensajes = await agregarMensaje(carpetaId, "agencia", "El equipo", limpio);
    revalidatePath("/gestion/chats");
    return { ok: true, mensajes };
  } catch {
    return { ok: false, motivo: "No pudimos guardar el mensaje. Probá de nuevo." };
  }
}
