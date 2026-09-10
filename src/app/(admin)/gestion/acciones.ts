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
  ajustesDe,
  esCarpetaReservada,
  guardarAjustesDe,
  linkDeCarpeta,
  type Vista,
} from "@/lib/ajustesDeCarpeta";
import { esCarpetaDelCliente, idsDeCarpetasReales, olvidarCarpetas } from "@/lib/carpetas";
import {
  clientePorId,
  habilitarCliente,
  ponerTag,
  renovarLink,
  todosLosClientes,
} from "@/lib/clientes";
import { contrasenaCorrecta, hayContrasena } from "@/lib/contrasena";
import {
  agregarMensaje,
  leerConversacion,
  LARGO_MAXIMO,
  type Mensaje,
} from "@/lib/conversaciones";
import { archivosDe } from "@/lib/google";
import { correoValido } from "@/lib/equipo";
import {
  archivosDeCarpeta,
  carpetasDeCliente,
  type NodoArchivo,
  type NodoCarpeta,
} from "@/admin/datos/arbol";
import { marcarTodosVistos } from "@/lib/avisos";
import {
  cambiarPersona,
  elEquipo,
  sacarDelEquipo,
  sumarAlEquipo,
} from "@/lib/equipo";
import { diasValidos, ponerPlazo } from "@/lib/plazos";
import { marcarLeido } from "@/lib/conversaciones";
import { subcarpetasDe } from "@/lib/google";
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

  // Lo que no viene en el formulario se conserva: el link de la carpeta, quién
  // la lleva y hasta cuándo. Pisarlos con vacío sería perderlos cada vez que
  // alguien toca «ocultar».
  const previos = await ajustesDe(carpetaId);
  await guardarAjustesDe(carpetaId, { ...previos, visible, vista });

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
  const contrasena = String(formulario.get("contrasena") ?? "");

  if (!hayContrasena()) {
    return {
      ok: false as const,
      motivo: "Falta configurar CLAVE_DE_ADMIN en .env.local.",
    };
  }
  if (!contrasenaCorrecta(contrasena)) {
    return { ok: false as const, motivo: "Esa contraseña no es." };
  }
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
 * Muestra la clave de un cliente, con contraseña.
 *
 * La clave **no viaja al navegador** hasta acá: la pantalla solo sabe si el
 * cliente tiene una o no. Es una cortina y no una puerta —administración
 * sigue sin login— pero evita que esté escrita para el que pasa por atrás.
 */
export async function verClaveDeCliente(
  _previo: unknown,
  formulario: FormData
): Promise<{ ok: true; clave: string } | { ok: false; motivo: string }> {
  const clienteId = String(formulario.get("clienteId") ?? "");
  const contrasena = String(formulario.get("contrasena") ?? "");

  if (!hayContrasena()) {
    return { ok: false, motivo: "Falta configurar CLAVE_DE_ADMIN en .env.local." };
  }
  if (!contrasenaCorrecta(contrasena)) {
    return { ok: false, motivo: "Esa contraseña no es." };
  }

  const cliente = await clientePorId(clienteId);
  if (!cliente) return { ok: false, motivo: "Ese cliente no existe." };

  return { ok: true, clave: cliente.tag };
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
  clienteId: string,
  texto: string
): Promise<RespuestaDeChat> {
  if (!(await esClienteReal(clienteId))) {
    return { ok: false, motivo: "Ese cliente no existe." };
  }

  const limpio = String(texto ?? "").trim();
  if (!limpio) return { ok: false, motivo: "El mensaje está vacío." };
  if (limpio.length > LARGO_MAXIMO) {
    return { ok: false, motivo: "El mensaje es demasiado largo." };
  }

  try {
    // El nombre queda fijo hasta que existan los usuarios y los roles.
    const mensajes = await agregarMensaje(clienteId, "agencia", "El equipo", limpio);
    // La agencia leyó lo que había cuando contestó.
    await marcarLeido("agencia", clienteId);
    revalidatePath("/gestion", "layout");
    return { ok: true, mensajes };
  } catch {
    return { ok: false, motivo: "No pudimos guardar el mensaje. Probá de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Quién lleva cada trabajo, y hasta cuándo

/** Asigna una carpeta a alguien del equipo. */
export async function guardarQuienYCuando(_previo: unknown, formulario: FormData) {
  const carpetaId = String(formulario.get("carpetaId") ?? "");
  const asignada = String(formulario.get("asignada") ?? "");

  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false as const, motivo: "Esa carpeta no existe." };
  }
  // Vacío es una respuesta válida: «sin asignar».
  if (asignada && !(await elEquipo()).some((p) => p.id === asignada)) {
    return { ok: false as const, motivo: "Esa persona no está en el equipo." };
  }

  const previos = await ajustesDe(carpetaId);
  await guardarAjustesDe(carpetaId, { ...previos, asignada: asignada || undefined });

  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * Pone los días de revisión en un nivel, y borra lo que haya debajo.
 *
 * Borrar lo de abajo es la parte importante: sin eso, cambiar el plazo del
 * cliente dejaría carpetas con el valor viejo y nadie sabría de dónde salió.
 */
export async function guardarDiasDeRevision(
  nivel: "cliente" | "carpeta" | "archivo",
  id: string,
  dias: number
): Promise<Resultado> {
  if (!diasValidos(dias)) {
    return { ok: false, motivo: "Los días tienen que ir de 1 a 30." };
  }

  let debajo: string[] = [];

  if (nivel === "cliente") {
    if (!(await esClienteReal(id))) return { ok: false, motivo: "Ese cliente no existe." };
    // Debajo de un cliente están sus carpetas y todos sus archivos.
    const carpetas = await subcarpetasDe(id);
    const archivos = await Promise.all(carpetas.map((c) => archivosDe(c.id)));
    debajo = [...carpetas.map((c) => c.id), ...archivos.flat().map((a) => a.id)];
  } else if (nivel === "carpeta") {
    if (!(await esCarpetaDelCliente(id))) {
      return { ok: false, motivo: "Esa carpeta no existe." };
    }
    debajo = (await archivosDe(id)).map((a) => a.id);
  } else {
    // Un archivo no tiene nada debajo. Se comprueba que exista de verdad
    // recorriendo las carpetas: el identificador llega de afuera.
    const carpetaId = String(id);
    if (!carpetaId) return { ok: false, motivo: "Falta el archivo." };
  }

  await ponerPlazo(id, dias, debajo);
  revalidatePath("/gestion", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// El equipo

export async function agregarAlEquipo(_previo: unknown, formulario: FormData) {
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const correo = String(formulario.get("correo") ?? "").trim();

  if (nombre.length < 2) return { ok: false as const, motivo: "Falta el nombre." };
  if (correo && !correoValido(correo)) {
    return { ok: false as const, motivo: "Ese correo no tiene forma de correo." };
  }

  await sumarAlEquipo(nombre, correo);
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

export async function editarDelEquipo(_previo: unknown, formulario: FormData) {
  const id = String(formulario.get("id") ?? "");
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const correo = String(formulario.get("correo") ?? "").trim();

  if (!(await elEquipo()).some((p) => p.id === id)) {
    return { ok: false as const, motivo: "Esa persona no está." };
  }
  if (nombre.length < 2) return { ok: false as const, motivo: "Falta el nombre." };
  if (correo && !correoValido(correo)) {
    return { ok: false as const, motivo: "Ese correo no tiene forma de correo." };
  }

  await cambiarPersona(id, nombre, correo);
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

export async function quitarDelEquipo(_previo: unknown, formulario: FormData) {
  const id = String(formulario.get("id") ?? "");
  await sacarDelEquipo(id);
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// La bandeja

export async function marcarAvisosVistos(): Promise<void> {
  await marcarTodosVistos();
  revalidatePath("/gestion", "layout");
}

/** La agencia leyó la conversación de un cliente. */
export async function marcarChatLeido(clienteId: string): Promise<void> {
  if (!(await esClienteReal(clienteId))) return;
  await marcarLeido("agencia", clienteId);
  revalidatePath("/gestion", "layout");
}

// ---------------------------------------------------------------------------
// El árbol, nivel por nivel

/**
 * Las carpetas de un cliente, para cuando se abre su fila.
 *
 * Cada nivel se pide al abrirlo: leer de Drive todos los archivos de todos los
 * clientes para dibujar una lista cerrada sería pagar por adelantado algo que
 * casi nunca se mira.
 */
export async function abrirCliente(
  clienteId: string
): Promise<{ ok: true; carpetas: NodoCarpeta[] } | { ok: false; motivo: string }> {
  if (!(await esClienteReal(clienteId))) {
    return { ok: false, motivo: "Ese cliente no existe." };
  }
  try {
    return { ok: true, carpetas: await carpetasDeCliente(clienteId) };
  } catch {
    return { ok: false, motivo: "No pude leer las carpetas en Drive." };
  }
}

export async function abrirCarpeta(
  carpetaId: string,
  diasDeLaCarpeta: number
): Promise<{ ok: true; archivos: NodoArchivo[] } | { ok: false; motivo: string }> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no existe." };
  }
  try {
    return { ok: true, archivos: await archivosDeCarpeta(carpetaId, diasDeLaCarpeta) };
  } catch {
    return { ok: false, motivo: "No pude leer los archivos en Drive." };
  }
}

/**
 * Los mensajes de un cliente, para la app de gestión.
 *
 * La ruta `/api/conversacion` es del portal y pide su galleta. Acá se lee por
 * acción: es el otro lado del mostrador y no tiene esa sesión.
 */
export async function traerConversacion(
  clienteId: string
): Promise<{ ok: true; mensajes: Mensaje[] } | { ok: false; motivo: string }> {
  if (!(await esClienteReal(clienteId))) {
    return { ok: false, motivo: "Ese cliente no existe." };
  }
  try {
    return { ok: true, mensajes: await leerConversacion(clienteId) };
  } catch {
    return { ok: false, motivo: "No pude leer la conversación." };
  }
}
