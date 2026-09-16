// Quiénes son del equipo.
//
// Existe por dos cosas que se pidieron juntas y resultaron ser la misma:
// **asignar** un trabajo a alguien, y **avisarle** cuando pasa algo. Sin una
// lista de personas, «avisarle al asignado» no tiene a quién avisarle.
//
// Es una lista corta y a mano: la agencia son tres personas más quien se
// sume. No hay altas, bajas ni roles todavía; eso llega con los usuarios de
// verdad. Lo que hay es un nombre y un correo, que es lo que hace falta hoy.

import { randomUUID } from "node:crypto";
import { coleccion } from "@/lib/almacen";

export type Persona = {
  id: string;
  nombre: string;
  /** A dónde le llegan los avisos. Vacío significa que no le llega ninguno. */
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

function esPersona(v: unknown): v is Persona {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return typeof p.id === "string" && typeof p.nombre === "string";
}

const almacen = coleccion<Persona>("equipo", esPersona);

export async function elEquipo(): Promise<Persona[]> {
  // El orden es el de alta, que es el que espera quien la cargó.
  return Object.values(await almacen.todo()).map((p) => ({
    ...p,
    correo: typeof p.correo === "string" ? p.correo : "",
    avisaDeTodo: p.avisaDeTodo === true,
    enDrive: typeof p.enDrive === "string" && p.enDrive ? p.enDrive : undefined,
  }));
}

export async function sumarAlEquipo(
  nombre: string,
  correo: string,
  avisaDeTodo = false,
  enDrive = ""
): Promise<Persona> {
  const persona: Persona = {
    id: randomUUID(),
    nombre: nombre.trim().slice(0, 60),
    correo: correo.trim().slice(0, 120),
    avisaDeTodo,
    enDrive: enDrive.trim().slice(0, 120) || undefined,
  };
  await almacen.guardar(persona.id, persona);
  return persona;
}

export async function cambiarPersona(
  id: string,
  nombre: string,
  correo: string,
  avisaDeTodo: boolean,
  enDrive = ""
): Promise<void> {
  const actual = await almacen.uno(id);
  if (!actual) return;
  await almacen.guardar(id, {
    ...actual,
    nombre: nombre.trim().slice(0, 60),
    correo: correo.trim().slice(0, 120),
    avisaDeTodo,
    enDrive: enDrive.trim().slice(0, 120) || undefined,
  });
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
  return (await almacen.uno(id)) ?? null;
}

/** Quiénes reciben todo, tengan o no algo asignado. */
export async function quienesRecibenTodo(): Promise<Persona[]> {
  return (await elEquipo()).filter((p) => p.avisaDeTodo);
}
