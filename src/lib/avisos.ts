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

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
  /** A quién estaba asignado el trabajo, si lo estaba. */
  paraQuien?: string;
  /** Si salió por correo, y si no, por qué. */
  correo: "sin_configurar" | "enviado" | "fallo" | "sin_destinatario";
  detalleDelCorreo?: string;
  /** Alguien de la agencia ya lo miró. */
  visto: boolean;
};

const CARPETA_DE_DATOS = path.join(process.cwd(), "datos");
const ARCHIVO = path.join(CARPETA_DE_DATOS, "avisos.json");

/** Cuántos se guardan. Más viejo que esto es historia, y esa vive en la pieza. */
const TOPE = 500;

function normalizar(datos: unknown): Aviso[] {
  if (!Array.isArray(datos)) return [];
  const salida: Aviso[] = [];
  for (const cruda of datos) {
    if (!cruda || typeof cruda !== "object") continue;
    const a = cruda as Record<string, unknown>;
    if (typeof a.id !== "string" || typeof a.cuando !== "string") continue;
    salida.push({
      id: a.id,
      clase: (a.clase as ClaseDeAviso) ?? "escribio",
      cuando: a.cuando,
      cliente: String(a.cliente ?? ""),
      clienteId: String(a.clienteId ?? ""),
      carpeta: String(a.carpeta ?? ""),
      carpetaId: String(a.carpetaId ?? ""),
      texto: String(a.texto ?? ""),
      paraQuien: typeof a.paraQuien === "string" ? a.paraQuien : undefined,
      correo: (a.correo as Aviso["correo"]) ?? "sin_configurar",
      detalleDelCorreo:
        typeof a.detalleDelCorreo === "string" ? a.detalleDelCorreo : undefined,
      visto: a.visto === true,
    });
  }
  return salida;
}

export async function losAvisos(): Promise<Aviso[]> {
  try {
    return normalizar(JSON.parse(await readFile(ARCHIVO, "utf8")));
  } catch {
    return [];
  }
}

async function guardar(avisos: Aviso[]): Promise<void> {
  await mkdir(CARPETA_DE_DATOS, { recursive: true });
  const temporal = `${ARCHIVO}.${process.pid}.tmp`;
  // Lo más nuevo primero, y se corta: la bandeja es para enterarse, no un
  // archivo histórico.
  const recortados = avisos.slice(0, TOPE);
  await writeFile(temporal, JSON.stringify(recortados, null, 2), "utf8");
  await rename(temporal, ARCHIVO);
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
  await guardar([nuevo, ...(await losAvisos())]);
  return nuevo;
}

export async function marcarTodosVistos(): Promise<void> {
  await guardar((await losAvisos()).map((a) => ({ ...a, visto: true })));
}

