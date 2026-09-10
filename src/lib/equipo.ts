// Quiénes son del equipo.
//
// Existe por dos cosas que se pidieron juntas y resultaron ser la misma:
// **asignar** un trabajo a alguien, y **avisarle** cuando pasa algo. Sin una
// lista de personas, «avisarle al asignado» no tiene a quién avisarle.
//
// Es una lista corta y a mano: la agencia son tres personas más quien se
// sume. No hay altas, bajas ni roles todavía; eso llega con los usuarios de
// verdad. Lo que hay es un nombre y un correo, que es lo que hace falta hoy.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type Persona = {
  id: string;
  nombre: string;
  /** A dónde le llegan los avisos. Vacío significa que no le llega ninguno. */
  correo: string;
};

const CARPETA_DE_DATOS = path.join(process.cwd(), "datos");
const ARCHIVO = path.join(CARPETA_DE_DATOS, "equipo.json");

/**
 * Una dirección de correo con forma de dirección de correo.
 *
 * No valida que exista —eso solo lo dice mandarle algo— pero descarta lo que
 * seguro no va a andar: sin arroba, sin punto después, con espacios.
 */
export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
}

function normalizar(datos: unknown): Persona[] {
  if (!Array.isArray(datos)) return [];
  const salida: Persona[] = [];
  for (const cruda of datos) {
    if (!cruda || typeof cruda !== "object") continue;
    const p = cruda as Record<string, unknown>;
    if (typeof p.id !== "string" || typeof p.nombre !== "string") continue;
    salida.push({
      id: p.id,
      nombre: p.nombre,
      correo: typeof p.correo === "string" ? p.correo : "",
    });
  }
  return salida;
}

export async function elEquipo(): Promise<Persona[]> {
  try {
    return normalizar(JSON.parse(await readFile(ARCHIVO, "utf8")));
  } catch {
    return [];
  }
}

async function guardar(gente: Persona[]): Promise<void> {
  await mkdir(CARPETA_DE_DATOS, { recursive: true });
  const temporal = `${ARCHIVO}.${process.pid}.tmp`;
  await writeFile(temporal, JSON.stringify(gente, null, 2), "utf8");
  await rename(temporal, ARCHIVO);
}

export async function sumarAlEquipo(nombre: string, correo: string): Promise<Persona> {
  const gente = await elEquipo();
  const persona: Persona = {
    id: randomUUID(),
    nombre: nombre.trim().slice(0, 60),
    correo: correo.trim().slice(0, 120),
  };
  await guardar([...gente, persona]);
  return persona;
}

export async function cambiarPersona(
  id: string,
  nombre: string,
  correo: string
): Promise<void> {
  const gente = await elEquipo();
  await guardar(
    gente.map((p) =>
      p.id === id
        ? { ...p, nombre: nombre.trim().slice(0, 60), correo: correo.trim().slice(0, 120) }
        : p
    )
  );
}

/**
 * Saca a alguien del equipo.
 *
 * No toca lo que tenía asignado: una carpeta asignada a alguien que ya no está
 * queda mostrando «sin asignar», que es la verdad. Reasignarla es una decisión
 * de una persona, no algo que deba pasar solo mientras nadie mira.
 */
export async function sacarDelEquipo(id: string): Promise<void> {
  await guardar((await elEquipo()).filter((p) => p.id !== id));
}

export async function personaPorId(id: string | undefined): Promise<Persona | null> {
  if (!id) return null;
  return (await elEquipo()).find((p) => p.id === id) ?? null;
}
