// Quiénes son del equipo.
//
// Existe por dos cosas que se pidieron juntas y resultaron ser la misma:
// **asignar** un trabajo a alguien, y **avisarle** cuando pasa algo. Sin una
// lista de personas, «avisarle al asignado» no tiene a quién avisarle.
//
// **Esta lista es la lista de usuarios.** No hay otra que mantener: quien está
// acá con un correo y un rol puede entrar, y quien no está no entra. Dar de
// alta a alguien es escribir su correo y elegirle un rol; la contraseña la
// pone esa persona la primera vez que entra, y no la sabe nadie más —ni
// siquiera quien la dio de alta—.
//
// **El rol no se copia, se referencia.** Lo que ve alguien se calcula cada vez
// a partir de su rol, así que cambiar qué ve «Diseño» cambia lo que ven todas
// las diseñadoras hoy, sin tener que repasarlas una por una. Las reglas están
// en `dominio/roles.ts`, donde puede leerlas también el navegador.

import { randomUUID } from "node:crypto";
import { coleccion } from "@/lib/almacen";
import {
  esRol,
  esSeccion,
  ROL_DE_ANTES,
  seccionesDe,
  type Rol,
  type Seccion,
} from "@/dominio/roles";

export type Persona = {
  id: string;
  nombre: string;
  /** A dónde le llegan los avisos. Es además con lo que entra. */
  correo: string;
  /**
   * Le llega **todo**, esté asignada o no.
   *
   * Es el primer paso hacia los roles, y por ahora el único que hace falta:
   * alguien de la agencia tiene que enterarse de todo lo que pasa, y el resto
   * solo de lo suyo. Sin esto, un aviso de una carpeta que nadie tiene
   * asignada no le llegaba a nadie.
   */
  avisaDeTodo: boolean;
  /**
   * Cómo aparece esta persona cuando comenta en Drive.
   *
   * **Sirve para no ponerle al cliente palabras que no dijo.** Los comentarios
   * escritos encima de un archivo se copian a la lista de cambios pedidos, y
   * desde Drive un pedido del cliente y una nota que el diseñador se deja a sí
   * mismo son la misma cosa: un nombre y un texto. Con esto, lo que escribe el
   * equipo no entra a esa lista.
   *
   * Vacío no rompe nada: además de esto se compara contra el nombre y el
   * correo que ya están cargados. Hace falta cuando Google la muestra con otro
   * nombre —«Narella Rafaelli» donde acá dice «Nari»—, que es cuando el
   * problema aparece.
   */
  enDrive?: string;
  /** Qué parte de la gestión le toca. */
  rol: Rol;
  /**
   * Secciones que tiene **además** de las de su rol.
   *
   * Nunca quitan: no hay forma de sacarle a alguien algo que su rol le da. Para
   * eso se le cambia el rol, que es la decisión que de verdad se está tomando.
   */
  sueltas: Seccion[];
};

/**
 * Una dirección de correo con forma de dirección de correo.
 *
 * No valida que exista —eso solo lo dice mandarle algo— pero descarta lo que
 * seguro no va a andar: sin arroba, sin punto después, con espacios.
 */
export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
}

/**
 * Cómo se llama alguien de quien solo sabemos el correo.
 *
 * El alta pide un correo y nada más, pero el nombre se usa en toda la
 * aplicación —quién lleva un trabajo, quién firmó una entrega— y «» no se
 * puede mostrar. Lo que hay antes del arroba es una primera aproximación
 * razonable, y la persona lo corrige cuando entra por primera vez.
 */
export function nombreDesdeCorreo(correo: string): string {
  const antes = correo.trim().split("@")[0] ?? "";
  const limpio = antes.replace(/[._-]+/g, " ").trim();
  if (!limpio) return "Sin nombre";
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

function esPersona(v: unknown): v is Persona {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return typeof p.id === "string" && typeof p.nombre === "string";
}

/**
 * Lo guardado, con todo lo que pueda faltar puesto en su lugar.
 *
 * **Pasa por acá todo lo que sale de este módulo**, y no solo `elEquipo()`: una
 * ficha cargada antes de que existieran los roles no tiene rol, y quien la lea
 * por el otro camino se encontraría con `undefined` justo en el momento de
 * decidir qué puede ver. Se le da el rol de antes, que está explicado allá.
 */
function completar(p: Persona): Persona {
  return {
    ...p,
    correo: typeof p.correo === "string" ? p.correo : "",
    avisaDeTodo: p.avisaDeTodo === true,
    enDrive: typeof p.enDrive === "string" && p.enDrive ? p.enDrive : undefined,
    rol: esRol(p.rol) ? p.rol : ROL_DE_ANTES,
    sueltas: Array.isArray(p.sueltas) ? p.sueltas.filter(esSeccion) : [],
  };
}

const almacen = coleccion<Persona>("equipo", esPersona);

export async function elEquipo(): Promise<Persona[]> {
  // El orden es el de alta, que es el que espera quien la cargó.
  return Object.values(await almacen.todo()).map(completar);
}

/** Qué secciones ve una persona: las de su rol más las sueltas. */
export const seccionesDePersona = (p: Persona): Seccion[] => seccionesDe(p.rol, p.sueltas);

/**
 * Da de alta a alguien: un correo y un rol.
 *
 * **No recibe contraseña, y eso es el punto.** La pone la persona la primera
 * vez que entra, y desde ese momento no la sabe nadie más. Quien da el alta no
 * puede leerla ni por accidente, porque nunca pasó por sus manos.
 */
export async function sumarAlEquipo(datos: {
  correo: string;
  rol: Rol;
  nombre?: string;
  avisaDeTodo?: boolean;
  enDrive?: string;
  sueltas?: Seccion[];
}): Promise<Persona> {
  const correo = datos.correo.trim().slice(0, 120);
  const persona: Persona = {
    id: randomUUID(),
    nombre: (datos.nombre?.trim() || nombreDesdeCorreo(correo)).slice(0, 60),
    correo,
    avisaDeTodo: datos.avisaDeTodo === true,
    enDrive: datos.enDrive?.trim().slice(0, 120) || undefined,
    rol: datos.rol,
    sueltas: (datos.sueltas ?? []).filter(esSeccion),
  };
  await almacen.guardar(persona.id, persona);
  return persona;
}

/**
 * Cambia lo que se puede cambiar de alguien.
 *
 * Lo que no se le pasa queda como estaba: así el formulario de la ficha puede
 * guardar el nombre sin tener que reenviar el rol, y la pantalla de accesos
 * puede cambiar el rol sin tocar el nombre. Dos formularios que mandan el
 * mundo entero terminan pisándose el uno al otro.
 */
export async function cambiarPersona(
  id: string,
  cambios: Partial<Omit<Persona, "id">>
): Promise<void> {
  const actual = await almacen.uno(id);
  if (!actual) return;

  const recortado: Partial<Persona> = { ...cambios };
  if (typeof recortado.nombre === "string") recortado.nombre = recortado.nombre.trim().slice(0, 60);
  if (typeof recortado.correo === "string") recortado.correo = recortado.correo.trim().slice(0, 120);
  if (typeof recortado.enDrive === "string") {
    recortado.enDrive = recortado.enDrive.trim().slice(0, 120) || undefined;
  }
  if (recortado.sueltas) recortado.sueltas = recortado.sueltas.filter(esSeccion);

  await almacen.guardar(id, completar({ ...actual, ...recortado }));
}

/**
 * Con qué nombres se reconoce al equipo en un comentario de Drive.
 *
 * Los tres de cada persona, y no solo el de Drive: lo habitual es que Google
 * la muestre con el mismo nombre que está cargado acá, y en ese caso esto
 * funciona sin que nadie tenga que completar nada.
 */
export async function comoFirmaElEquipo(): Promise<string[]> {
  return (await elEquipo())
    .flatMap((p) => [p.enDrive, p.nombre, p.correo])
    .filter((x): x is string => Boolean(x && x.trim()));
}

/**
 * Saca a alguien del equipo.
 *
 * No toca lo que tenía asignado: una carpeta asignada a alguien que ya no está
 * queda mostrando «sin asignar», que es la verdad. Reasignarla es una decisión
 * de una persona, no algo que deba pasar solo mientras nadie mira.
 */
export async function sacarDelEquipo(id: string): Promise<void> {
  await almacen.borrar(id);
}

export async function personaPorId(id: string | undefined): Promise<Persona | null> {
  if (!id) return null;
  const guardada = await almacen.uno(id);
  return guardada ? completar(guardada) : null;
}

/**
 * Quién entra con ese correo.
 *
 * Se compara en minúsculas y sin espacios de los costados: nadie escribe su
 * correo dos veces igual, y «no me deja entrar» por una mayúscula es el peor
 * rato que puede hacerle pasar una puerta a alguien.
 */
export async function personaPorCorreo(correo: string): Promise<Persona | null> {
  const buscado = correo.trim().toLowerCase();
  if (!buscado) return null;
  return (await elEquipo()).find((p) => p.correo.trim().toLowerCase() === buscado) ?? null;
}

/** Quiénes reciben todo, tengan o no algo asignado. */
export async function quienesRecibenTodo(): Promise<Persona[]> {
  return (await elEquipo()).filter((p) => p.avisaDeTodo);
}
