// La conversación entre el cliente y el equipo, guardada del lado del servidor.
//
// Está acá y no en el navegador porque una conversación necesita **dos lados**:
// el cliente escribe desde el portal y la agencia contesta desde la app de
// gestión. Guardado en el navegador, cada uno hablaría solo.
//
// Hoy vive en un archivo al lado de la aplicación, igual que los ajustes. Es
// lo que corresponde mientras corre en una computadora: se abre con el Bloc de
// notas y se copia. **Cuando exista Supabase se cambia el cuerpo de estas tres
// funciones y no se toca ninguna pantalla** —por eso todo pasa por acá—.
//
// **Del otro lado siempre hay una persona.** Este módulo guarda y devuelve lo
// que alguien escribió; no genera respuestas, no sugiere, no resume. Lo único
// que escribe la aplicación son avisos de estado, con `de: "sistema"`, que la
// pantalla dibuja distinto para que nadie los confunda con alguien hablando.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type Quien = "cliente" | "agencia" | "sistema";

export type Mensaje = {
  id: string;
  de: Quien;
  /** El nombre que se muestra. Cuando haya usuarios, sale de la sesión. */
  quien: string;
  texto: string;
  /** En ISO, para que sobreviva a `JSON.stringify`. */
  cuando: string;
};

/** Nadie escribe un mensaje más largo que esto sin querer romper algo. */
export const LARGO_MAXIMO = 4000;

const CARPETA_DE_DATOS = path.join(process.cwd(), "datos");
const ARCHIVO = path.join(CARPETA_DE_DATOS, "conversaciones.json");

type Guardado = Record<string, Mensaje[]>;

function esMensaje(m: unknown): m is Mensaje {
  if (!m || typeof m !== "object") return false;
  const x = m as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    typeof x.quien === "string" &&
    typeof x.texto === "string" &&
    typeof x.cuando === "string" &&
    (x.de === "cliente" || x.de === "agencia" || x.de === "sistema")
  );
}

/**
 * Todo lo guardado.
 *
 * Lo que sale del archivo se valida igual que lo que llega por la red: el
 * archivo se puede editar a mano, y un mensaje con la forma rota reventaría
 * la pantalla en vez de simplemente no aparecer.
 */
async function leerTodo(): Promise<Guardado> {
  try {
    const crudo = await readFile(ARCHIVO, "utf8");
    const datos = JSON.parse(crudo) as unknown;
    if (!datos || typeof datos !== "object") return {};

    const salida: Guardado = {};
    for (const [carpeta, mensajes] of Object.entries(datos as Record<string, unknown>)) {
      if (Array.isArray(mensajes)) salida[carpeta] = mensajes.filter(esMensaje);
    }
    return salida;
  } catch {
    // No existe todavía, o quedó a medio escribir. En los dos casos la
    // respuesta correcta es «no hay nada dicho», que es un estado válido.
    return {};
  }
}

export async function leerConversacion(carpetaId: string): Promise<Mensaje[]> {
  return (await leerTodo())[carpetaId] ?? [];
}

/**
 * Agrega un mensaje y devuelve la conversación entera.
 *
 * Devuelve todo y no solo el mensaje nuevo para que quien escribió vea al
 * instante lo que el otro lado dijo mientras tanto.
 *
 * Escribe a un archivo temporal y después lo renombra encima. Renombrar es
 * atómico: si se corta la luz en el medio queda la conversación vieja entera,
 * en vez de una nueva por la mitad.
 */
export async function agregarMensaje(
  carpetaId: string,
  de: Quien,
  quien: string,
  texto: string
): Promise<Mensaje[]> {
  const limpio = texto.trim().slice(0, LARGO_MAXIMO);
  if (!limpio) return leerConversacion(carpetaId);

  const todo = await leerTodo();
  const mensajes = [
    ...(todo[carpetaId] ?? []),
    { id: randomUUID(), de, quien, texto: limpio, cuando: new Date().toISOString() },
  ];

  await mkdir(CARPETA_DE_DATOS, { recursive: true });
  const temporal = `${ARCHIVO}.${process.pid}.tmp`;
  await writeFile(temporal, JSON.stringify({ ...todo, [carpetaId]: mensajes }, null, 2), "utf8");
  await rename(temporal, ARCHIVO);

  return mensajes;
}

/** Cuántos mensajes hay en cada carpeta. Para las listas de administración. */
export async function cuentaPorCarpeta(): Promise<Record<string, number>> {
  const todo = await leerTodo();
  return Object.fromEntries(Object.entries(todo).map(([id, m]) => [id, m.length]));
}
