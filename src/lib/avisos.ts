// Los avisos: qué pasó, a quién le importa, y si se le pudo decir.
//
// Es el bucle que este proyecto vino a cerrar. El cliente aprueba o devuelve
// algo, y hasta hoy nadie se enteraba salvo que entrara a mirar. Ahora queda
// anotado y, si hay correo configurado, sale por correo.
//
// **Se anota siempre, se manda si se puede.** Son dos cosas separadas a
// propósito: que el correo no esté configurado —o que el servidor de correo se
// caiga— no puede hacer que el aviso se pierda. Queda en la bandeja de gestión
// igual, y ahí se ve.
//
// Nada de esto le escribe al cliente. Los avisos van **hacia adentro**, al
// equipo. Lo que sale hacia el cliente lo escribe una persona.

import { randomUUID } from "node:crypto";
import { coleccion } from "@/lib/almacen";

export type ClaseDeAviso =
  | "aprobo"
  | "pidio_cambios"
  | "envio_revision"
  | "escribio"
  | "vencio";

export type Aviso = {
  id: string;
  clase: ClaseDeAviso;
  cuando: string;
  cliente: string;
  clienteId: string;
  carpeta: string;
  carpetaId: string;
  /** Una línea, ya escrita para leer. */
  texto: string;
  /**
   * A quiénes les tocaba: quien lo lleva, más quienes reciben todo.
   *
   * Son varios porque el trabajo puede estar repartido: dos personas con
   * subcarpetas distintas del mismo cliente reciben cada una lo suyo, y quien
   * lleva la agencia recibe las dos cosas.
   */
  paraQuienes?: string[];
  /** Cómo se guardaba antes, cuando era uno solo. Se sigue leyendo. */
  paraQuien?: string;
  /** Si salió por correo, y si no, por qué. */
  correo: "sin_configurar" | "enviado" | "fallo" | "sin_destinatario";
  detalleDelCorreo?: string;
  /** Alguien de la agencia ya lo miró. */
  visto: boolean;
};

/** Cuántos se guardan. Más viejo que esto es historia, y esa vive en la pieza. */
const TOPE = 500;

function esAviso(v: unknown): v is Aviso {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return typeof a.id === "string" && typeof a.cuando === "string";
}

const almacen = coleccion<Aviso>("avisos", esAviso);

export async function losAvisos(): Promise<Aviso[]> {
  // Lo más nuevo primero. Se ordena al leer y no al guardar: el almacén guarda
  // documentos sueltos, y el orden es una decisión de esta pantalla.
  return Object.values(await almacen.todo()).sort((a, b) =>
    b.cuando.localeCompare(a.cuando)
  );
}

export async function anotarAviso(
  aviso: Omit<Aviso, "id" | "cuando" | "visto">
): Promise<Aviso> {
  const nuevo: Aviso = {
    ...aviso,
    id: randomUUID(),
    cuando: new Date().toISOString(),
    visto: false,
  };

  const todos = await losAvisos();
  // La bandeja es para enterarse, no un archivo histórico: lo que pasa el tope
  // se va en la misma escritura que entra lo nuevo.
  const sobran = todos.slice(TOPE - 1).map((a) => a.id);
  const cambios: Record<string, Aviso | undefined> = { [nuevo.id]: nuevo };
  for (const id of sobran) cambios[id] = undefined;

  await almacen.guardarVarios(cambios);
  return nuevo;
}

export async function marcarTodosVistos(): Promise<void> {
  const cambios: Record<string, Aviso> = {};
  for (const aviso of await losAvisos()) {
    if (!aviso.visto) cambios[aviso.id] = { ...aviso, visto: true };
  }
  await almacen.guardarVarios(cambios);
}
