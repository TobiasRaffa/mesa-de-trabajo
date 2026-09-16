// Qué ve el cliente, y cómo.
//
// La agencia arma su estructura en Drive —«Logos», «Calendario septiembre», y
// adentro lo que haga falta— y decide dos cosas: **qué se muestra** y **cómo se
// mira** lo que se muestra. Eso no puede vivir en Drive, porque Drive no tiene
// dónde anotarlo.
//
// **La visibilidad vale para cualquier cosa: una carpeta, una subcarpeta o un
// archivo suelto.** Es una sola regla y un solo interruptor, guardado por
// identificador de Drive, sin importar qué clase de cosa sea. Tener una para
// carpetas y otra para archivos sería escribir dos veces la misma idea, y ya
// sabemos cómo termina eso: se arregla una y la otra no.
//
// **Ocultar algo oculta todo lo que tiene adentro.** No hace falta apagar cada
// archivo de una carpeta que se apagó: si el camino desde la carpeta del
// cliente hasta el archivo pasa por algo escondido, el archivo no se muestra
// **y no se sirve**. Eso último es lo que hace que esto sea una regla y no una
// decoración: no alcanza con no dibujar el recuadro, porque el archivo se pide
// por su dirección y quien la tenga la puede escribir a mano.
//
// La regla por omisión es «se ve». Una carpeta o un archivo nuevo aparece solo,
// sin configurar nada; esconderlo es la acción deliberada. Al revés —tener que
// habilitar cada cosa— convertiría cada trabajo nuevo en un trámite, que es
// justo lo que el portal vino a sacar del medio.
//
// Dónde se guarda no es asunto de este módulo: se lo pide al almacén. Acá vive
// **qué significa** un ajuste y qué se asume cuando falta.

import { randomBytes } from "node:crypto";
import { coleccion } from "@/lib/almacen";

export type Vista = "lista" | "calendario";

export type AjustesDeCarpeta = {
  /** Si el cliente lo ve. Vale igual para carpetas, subcarpetas y archivos. */
  visible: boolean;
  /** Solo tiene sentido en una carpeta. En un archivo se ignora. */
  vista: Vista;
  /**
   * El link propio de esta carpeta: `/t/<esto>` muestra esta sola.
   *
   * Uno por carpeta y estable. Sirve para mandarle a un cliente el link de
   * «Calendario septiembre» sin que de paso vea «Rediseño de identidad».
   * Se genera la primera vez que alguien lo pide.
   */
  token?: string;
};

const POR_OMISION: AjustesDeCarpeta = { visible: true, vista: "lista" };

/**
 * Carpetas con nombre reservado: no son trabajos y el cliente no las revisa
 * como piezas.
 *
 * `Entregas finales` es donde el equipo sube el archivo terminado de verdad:
 * el que va a usarse, en su formato final. **No es lo aprobado mudado ahí.**
 * Eso se hacía y estaba mal entendido: el archivo que el cliente aprueba es el
 * que se le mostró para revisar, y el final suele ser otro —el PDF de
 * imprenta, el empaquetado—, que sube una persona cuando está.
 *
 * Se compara sin distinguir mayúsculas ni espacios de más, porque el nombre lo
 * escribe una persona a mano en Drive, cliente por cliente.
 */
const RESERVADAS = ["entregas finales", "facturas"];

const limpio = (nombre: string) => nombre.trim().toLowerCase().replace(/\s+/g, " ");

export function esCarpetaReservada(nombre: string): boolean {
  return RESERVADAS.includes(limpio(nombre));
}

/**
 * «Facturas» es la única reservada que el cliente **no** puede atravesar.
 *
 * Las dos reservadas se parecen y se tratan distinto, y por eso vale la pena
 * que la diferencia esté escrita: «Entregas finales» es donde termina lo que el
 * cliente aprobó y tiene que poder seguir mirándolo; «Facturas» es de la
 * agencia. El nombre vive acá y en ningún otro lado: escrito a mano en el
 * módulo de permisos, el día que cambie va a cambiar en un solo lugar de dos.
 */
export function esCarpetaDeFacturas(nombre: string): boolean {
  return limpio(nombre) === "facturas";
}

/** «Entregas finales»: donde termina lo que el cliente aprobó. */
export function esCarpetaDeEntregas(nombre: string): boolean {
  return limpio(nombre) === "entregas finales";
}

/**
 * Acepta solo lo que tiene la forma esperada.
 *
 * Lo que sale del almacén es tan poco confiable como lo que llega por la red:
 * lo pudo escribir una versión anterior, o alguien a mano.
 */
function esAjuste(v: unknown): v is AjustesDeCarpeta {
  return Boolean(v) && typeof v === "object";
}

const almacen = coleccion<Record<string, unknown>>("ajustes", esAjuste);

function normalizar(v: Record<string, unknown> | undefined): AjustesDeCarpeta {
  if (!v) return POR_OMISION;
  return {
    visible: typeof v.visible === "boolean" ? v.visible : POR_OMISION.visible,
    vista: v.vista === "calendario" ? "calendario" : "lista",
    token: typeof v.token === "string" && v.token ? v.token : undefined,
  };
}

export async function ajustesDe(carpetaId: string): Promise<AjustesDeCarpeta> {
  return normalizar(await almacen.uno(carpetaId));
}

export async function guardarAjustesDe(
  carpetaId: string,
  ajustes: AjustesDeCarpeta
): Promise<void> {
  await almacen.guardar(carpetaId, { ...ajustes });
}

/**
 * El link propio de una carpeta, generándolo si todavía no tiene.
 *
 * Se genera cuando alguien lo pide y no antes: una carpeta que nadie va a
 * compartir por separado no necesita link, y generarlos todos de entrada
 * llenaría el almacén de tokens que no se usan nunca.
 */
export async function linkDeCarpeta(carpetaId: string): Promise<string> {
  const ajustes = await ajustesDe(carpetaId);
  if (ajustes.token) return ajustes.token;

  const token = randomBytes(12).toString("base64url");
  await guardarAjustesDe(carpetaId, { ...ajustes, token });
  return token;
}

// ---------------------------------------------------------------------------

/**
 * Cuáles de estos están escondidos. Una sola lectura para todos.
 *
 * Preguntar de a uno serían veinte lecturas para dibujar una carpeta con veinte
 * archivos. Devuelve un conjunto porque lo que se hace con esto es preguntar
 * «¿está este?» una vez por cada cosa que se dibuja.
 */
export async function escondidosEntre(ids: string[]): Promise<Set<string>> {
  const guardados = await almacen.todo();
  return new Set(ids.filter((id) => !normalizar(guardados[id]).visible));
}

/**
 * Deja solo lo que el cliente puede ver, sea carpeta o archivo.
 *
 * **«Entregas finales» sí se muestra.** Se filtraba junto con «Facturas»
 * porque las dos son reservadas, y eso dejaba al cliente sin el lugar donde
 * el equipo le deja los archivos terminados. Se muestra, pero no como trabajo
 * a revisar: ahí no hay nada que decidir.
 *
 * «Facturas» no se muestra nunca. Es de la agencia.
 */
export async function soloLoVisible<T extends { id: string; name?: string }>(
  cosas: T[]
): Promise<T[]> {
  const escondidos = await escondidosEntre(cosas.map((c) => c.id));
  return cosas.filter(
    (c) => !escondidos.has(c.id) && !(c.name && esCarpetaDeFacturas(c.name))
  );
}

/** Prende o apaga cualquier cosa, sin tocar el resto de sus ajustes. */
export async function mostrarUOcultar(id: string, visible: boolean): Promise<void> {
  await guardarAjustesDe(id, { ...(await ajustesDe(id)), visible });
}
