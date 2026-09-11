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
  mostrarUOcultar,
} from "@/lib/ajustes";
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
import { piezasDeLaCarpeta } from "@/lib/piezas";
import { agruparVersiones, identidadDePieza } from "@/lib/versiones";
import { esDeAlgunCliente } from "@/lib/permisos";
import { correoValido } from "@/lib/equipo";
import {
  contenidoDe,
  heredadoDelCliente,
  type Contenido,
} from "@/admin/datos/arbol";
import { marcarTodosVistos } from "@/lib/avisos";
import {
  cambiarPersona,
  elEquipo,
  sacarDelEquipo,
  sumarAlEquipo,
} from "@/lib/equipo";
import { diasValidos, ponerPlazo } from "@/lib/plazos";
import { ponerResponsable } from "@/lib/responsables";
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
  // La visibilidad no se toca acá: la maneja `cambiarVisibilidad`, y mandarla
  // de nuevo desde una pantalla que quedó vieja podía pisar lo que alguien
  // acababa de apagar.
  await guardarAjustesDe(carpetaId, { ...previos, vista });

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

/**
 * Se llama `pieza` y no `archivo` porque eso es lo que es.
 *
 * La fecha de publicación es de la pieza: subir una V2 no hace que haya que
 * volver a ponerla. Cuando esto se llamaba `archivo` y guardaba por
 * identificador de Drive, subir una vuelta nueva borraba la fecha del
 * calendario sin que nadie avisara.
 */
export type CambioDeFecha = { pieza: string; dia: DiaSuelto | null };

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

  // Las piezas que llegan tienen que estar de verdad en esa carpeta: si no,
  // esto sería una forma de ponerle fecha a cualquier archivo de cualquier
  // cliente.
  const adentro = new Set(
    agruparVersiones(await piezasDeLaCarpeta(carpetaId)).map((p) =>
      identidadDePieza(carpetaId, p.versiones[0].archivo.name)
    )
  );

  const aGuardar: Record<string, DiaSuelto | null> = {};
  for (const cambio of cambios) {
    const pieza = String(cambio?.pieza ?? "");

    // **Descartar en silencio y contestar que sí es lo peor que puede hacer
    // esto.** Pasó: una pieza aprobada ya no estaba en el listado de Drive, su
    // cambio se salteaba, y la pantalla decía «Listo, el cliente ya lo ve
    // así». Si algo no se puede guardar, se dice.
    if (!adentro.has(pieza)) {
      return { ok: false, motivo: "Una de las piezas ya no está en la carpeta." };
    }

    if (cambio.dia === null) aGuardar[pieza] = null;
    else if (esDiaValido(cambio.dia)) aGuardar[pieza] = cambio.dia;
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

/**
 * Pone los días de revisión en un nivel, y borra lo que haya debajo.
 *
 * Borrar lo de abajo es la parte importante: sin eso, cambiar el plazo del
 * cliente dejaría carpetas con el valor viejo y nadie sabría de dónde salió.
 */
type Nivel = "cliente" | "carpeta" | "archivo";

/**
 * Comprueba que el identificador sea real y devuelve qué queda debajo.
 *
 * Lo de abajo es lo que se va a dejar heredando otra vez. Un archivo se
 * comprueba contra su carpeta, que viene aparte: el identificador llega de
 * afuera y no se puede creer.
 */
async function nivelReal(
  nivel: Nivel,
  id: string,
  carpetaId?: string
): Promise<{ ok: true; debajo: string[] } | { ok: false; motivo: string }> {
  if (nivel === "cliente") {
    if (!(await esClienteReal(id))) return { ok: false, motivo: "Ese cliente no existe." };
    const carpetas = await subcarpetasDe(id);
    const archivos = await Promise.all(carpetas.map((c) => piezasDeLaCarpeta(c.id)));
    return {
      ok: true,
      debajo: [...carpetas.map((c) => c.id), ...archivos.flat().map((a) => a.id)],
    };
  }

  if (nivel === "carpeta") {
    if (!(await esCarpetaDelCliente(id))) {
      return { ok: false, motivo: "Esa carpeta no existe." };
    }
    return { ok: true, debajo: (await piezasDeLaCarpeta(id)).map((a) => a.id) };
  }

  if (!carpetaId || !(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no existe." };
  }
  if (!(await piezasDeLaCarpeta(carpetaId)).some((a) => a.id === id)) {
    return { ok: false, motivo: "Ese archivo no está en la carpeta." };
  }
  // Un archivo no tiene nada debajo.
  return { ok: true, debajo: [] };
}

export async function guardarDiasDeRevision(
  nivel: Nivel,
  id: string,
  dias: number,
  carpetaId?: string
): Promise<Resultado> {
  if (!diasValidos(dias)) {
    return { ok: false, motivo: "Los días tienen que ir de 1 a 30." };
  }

  const donde = await nivelReal(nivel, id, carpetaId);
  if (!donde.ok) return donde;

  await ponerPlazo(id, dias, donde.debajo);
  revalidatePath("/gestion", "layout");
  return { ok: true };
}

/**
 * Pone quién lleva algo, y deja heredando a todo lo que esté debajo.
 *
 * «Sin asignar» se guarda como una decisión y no como la falta de una: una
 * carpeta puesta en nadie no vuelve sola al responsable del cliente.
 */
export async function guardarResponsable(
  nivel: Nivel,
  id: string,
  personaId: string,
  carpetaId?: string
): Promise<Resultado> {
  if (personaId && !(await elEquipo()).some((p) => p.id === personaId)) {
    return { ok: false, motivo: "Esa persona no está en el equipo." };
  }

  const donde = await nivelReal(nivel, id, carpetaId);
  if (!donde.ok) return donde;

  await ponerResponsable(id, personaId || null, donde.debajo);
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
export type Abierta =
  | { ok: true; contenido: Contenido }
  | { ok: false; motivo: string };

export async function abrirCliente(clienteId: string): Promise<Abierta> {
  if (!(await esClienteReal(clienteId))) {
    return { ok: false, motivo: "Ese cliente no existe." };
  }
  try {
    return {
      ok: true,
      contenido: await contenidoDe(clienteId, await heredadoDelCliente(clienteId)),
    };
  } catch {
    return { ok: false, motivo: "No pude leer la carpeta en Drive." };
  }
}

/**
 * Lo que hay dentro de una carpeta, a cualquier profundidad.
 *
 * `esCarpetaDelCliente` comprueba que la carpeta cuelgue de un cliente: sin
 * eso, cualquiera con una dirección de gestión podría pedir el contenido de
 * una carpeta ajena del Drive del robot.
 */
export async function abrirCarpeta(
  carpetaId: string,
  heredado: { dias: number; responsable: string | null }
): Promise<Abierta> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no existe." };
  }
  try {
    return { ok: true, contenido: await contenidoDe(carpetaId, heredado) };
  } catch {
    return { ok: false, motivo: "No pude leer la carpeta en Drive." };
  }
}

/**
 * Prende o apaga: una carpeta, una subcarpeta o una pieza.
 *
 * Recibe **varios** identificadores porque una pieza son varios archivos —sus
 * vueltas— y apagarla tiene que apagarlas todas. Una carpeta manda uno solo.
 */
export async function cambiarVisibilidad(
  ids: string[],
  visible: boolean
): Promise<{ ok: boolean; motivo?: string }> {
  if (ids.length === 0) return { ok: false, motivo: "No me dijiste qué." };

  for (const id of ids) {
    // Vale tanto para una carpeta como para un archivo, así que se acepta
    // cualquiera de las dos comprobaciones. Lo que no se acepta es un
    // identificador suelto de Drive que no cuelgue de ningún cliente.
    const deUnCliente = (await esCarpetaDelCliente(id)) || (await esDeAlgunCliente(id));
    if (!deUnCliente) return { ok: false, motivo: "Eso no es de ningún cliente." };
  }

  for (const id of ids) await mostrarUOcultar(id, visible);
  revalidatePath("/gestion");
  return { ok: true };
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
