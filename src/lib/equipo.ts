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
  }));
}

export async function sumarAlEquipo(nombre: string, correo: string): Promise<Persona> {
  const persona: Persona = {
    id: randomUUID(),
    nombre: nombre.trim().slice(0, 60),
    correo: correo.trim().slice(0, 120),
  };
  await almacen.guardar(persona.id, persona);
  return persona;
}

export async function cambiarPersona(
  id: string,
  nombre: string,
  correo: string
): Promise<void> {
  const actual = await almacen.uno(id);
  if (!actual) return;
  await almacen.guardar(id, {
    ...actual,
    nombre: nombre.trim().slice(0, 60),
    correo: correo.trim().slice(0, 120),
  });
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
