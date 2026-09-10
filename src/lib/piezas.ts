// En qué anda cada pieza, del lado del servidor.
//
// Hasta ahora esto vivía en el navegador del cliente, y eso tenía un techo:
// **si la aprobación no llega al servidor, nada puede reaccionar a ella**. No
// se puede mover el archivo a «Entregas finales», no se le puede avisar a la
// agencia, y la pantalla de gestión no puede decir qué pasó. Todo lo que sigue
// necesitaba que esto se mudara.
//
// De paso resuelve otra cosa: el cliente que revisa desde el teléfono y sigue
// desde la computadora encontraba dos borradores distintos. Ahora hay uno.
//
// Guarda también **la historia**: quién hizo qué y cuándo. Es lo que contesta
// la discusión de «esto ya lo habíamos aprobado» sin que nadie tenga que
// acordarse.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Estado } from "@/dominio/pieza";
import { archivosDe, metadatosArchivo, type ArchivoDrive } from "@/lib/google";

export type Cambio = { id: string; texto: string };

export type Hito =
  | "entregada"
  | "aprobada"
  | "cambios_pedidos"
  | "cambios_descartados"
  | "revision_enviada"
  | "reabierta"
  | "movida_a_finales"
  | "no_se_pudo_mover";

export type EntradaDeHistoria = {
  id: string;
  que: Hito;
  /** «Cliente», «El equipo». Cuando existan los usuarios, sale de la sesión. */
  quien: string;
  cuando: string;
  detalle?: string;
};

export type EstadoDePieza = {
  /** La carpeta de trabajo de la que salió. Se recuerda porque el archivo
   *  puede mudarse a «Entregas finales» y hay que saber dónde mostrarlo. */
  carpetaId: string;
  estado: Estado;
  ronda: number;
  rondasExtra: number;
  cambios: Cambio[];
  /** La revisión de esta vuelta ya se mandó: lo escrito queda firme. */
  enviada: boolean;
  /** Se movió a «Entregas finales» y ya no está en la carpeta de trabajo. */
  mudada: boolean;
  historia: EntradaDeHistoria[];
};

const CARPETA_DE_DATOS = path.join(process.cwd(), "datos");
const ARCHIVO = path.join(CARPETA_DE_DATOS, "piezas.json");

const ESTADOS: Estado[] = [
  "en_curso",
  "entregada",
  "en_revision",
  "cambios_marcados",
  "extra_pedida",
  "final",
  "cancelada",
];

/** Lo que se asume de una pieza que nadie tocó todavía. */
function sinTocar(carpetaId: string): EstadoDePieza {
  return {
    carpetaId,
    estado: "entregada",
    ronda: 0,
    rondasExtra: 0,
    cambios: [],
    enviada: false,
    mudada: false,
    historia: [],
  };
}

type Guardado = Record<string, EstadoDePieza>;

function esCambio(c: unknown): c is Cambio {
  const x = c as Record<string, unknown> | null;
  return !!x && typeof x.id === "string" && typeof x.texto === "string";
}

function esHito(h: unknown): h is EntradaDeHistoria {
  const x = h as Record<string, unknown> | null;
  return (
    !!x &&
    typeof x.id === "string" &&
    typeof x.que === "string" &&
    typeof x.quien === "string" &&
    typeof x.cuando === "string"
  );
}

/**
 * Acepta solo lo que tiene la forma esperada.
 *
 * El archivo se puede editar a mano y lo escribió una versión anterior de la
 * aplicación: lo que sale de él es tan poco confiable como lo que llega por la
 * red. Un estado que no existe se cae a «entregada», que es el más inofensivo
 * —no aprueba nada ni cierra nada—.
 */
function normalizar(datos: unknown): Guardado {
  const salida: Guardado = {};
  if (!datos || typeof datos !== "object") return salida;

  for (const [id, valor] of Object.entries(datos as Record<string, unknown>)) {
    if (!valor || typeof valor !== "object") continue;
    const v = valor as Record<string, unknown>;
    if (typeof v.carpetaId !== "string") continue;

    salida[id] = {
      carpetaId: v.carpetaId,
      estado: ESTADOS.includes(v.estado as Estado) ? (v.estado as Estado) : "entregada",
      ronda: typeof v.ronda === "number" && v.ronda >= 0 ? v.ronda : 0,
      rondasExtra: typeof v.rondasExtra === "number" && v.rondasExtra >= 0 ? v.rondasExtra : 0,
      cambios: Array.isArray(v.cambios) ? v.cambios.filter(esCambio) : [],
      enviada: v.enviada === true,
      mudada: v.mudada === true,
      historia: Array.isArray(v.historia) ? v.historia.filter(esHito) : [],
    };
  }
  return salida;
}

async function leerTodo(): Promise<Guardado> {
  try {
    return normalizar(JSON.parse(await readFile(ARCHIVO, "utf8")));
  } catch {
    return {};
  }
}

async function escribirTodo(datos: Guardado): Promise<void> {
  await mkdir(CARPETA_DE_DATOS, { recursive: true });
  const temporal = `${ARCHIVO}.${process.pid}.tmp`;
  await writeFile(temporal, JSON.stringify(datos, null, 2), "utf8");
  await rename(temporal, ARCHIVO);
}

/** El estado de varias piezas de una carpeta. Las que nadie tocó vienen a nuevo. */
export async function estadosDe(
  carpetaId: string,
  piezas: string[]
): Promise<Record<string, EstadoDePieza>> {
  const todo = await leerTodo();
  return Object.fromEntries(
    piezas.map((id) => [id, todo[id] ?? sinTocar(carpetaId)])
  );
}

export async function estadoDe(
  carpetaId: string,
  piezaId: string
): Promise<EstadoDePieza> {
  return (await leerTodo())[piezaId] ?? sinTocar(carpetaId);
}

/** Las piezas que se mudaron a «Entregas finales» pero salieron de esta carpeta. */
async function mudadasDe(carpetaId: string): Promise<string[]> {
  const todo = await leerTodo();
  return Object.entries(todo)
    .filter(([, p]) => p.mudada && p.carpetaId === carpetaId)
    .map(([id]) => id);
}

export function anotar(
  pieza: EstadoDePieza,
  que: Hito,
  quien: string,
  detalle?: string
): EstadoDePieza {
  return {
    ...pieza,
    historia: [
      ...pieza.historia,
      { id: randomUUID(), que, quien, cuando: new Date().toISOString(), detalle },
    ],
  };
}

export async function guardarPieza(piezaId: string, estado: EstadoDePieza): Promise<void> {
  const todo = await leerTodo();
  await escribirTodo({ ...todo, [piezaId]: estado });
}

/** Guarda varias de una vez: cerrar una revisión toca todas las piezas juntas. */
export async function guardarPiezas(
  cambios: Record<string, EstadoDePieza>
): Promise<void> {
  const todo = await leerTodo();
  await escribirTodo({ ...todo, ...cambios });
}

// ---------------------------------------------------------------------------

/** Cómo se cuenta cada hito en la historia que ve una persona. */
export const EN_PALABRAS: Record<Hito, string> = {
  entregada: "Se entregó",
  aprobada: "Aprobó",
  cambios_pedidos: "Pidió cambios",
  cambios_descartados: "Descartó los cambios",
  revision_enviada: "Envió la revisión",
  reabierta: "Reabrió la pieza",
  movida_a_finales: "Se movió a «Entregas finales»",
  no_se_pudo_mover: "No se pudo mover a «Entregas finales»",
};

// ---------------------------------------------------------------------------

/**
 * Los archivos de una carpeta, **incluidas las piezas que ya se mudaron**.
 *
 * Aprobar muda el archivo a «Entregas finales», así que Drive deja de listarlo
 * en la carpeta de trabajo. Cualquier pantalla que cuente desde el listado
 * crudo termina diciendo que la pieza aprobada no existe —el portal la perdía
 * de vista, y el tablero contaba «0 aprobadas» justo después de aprobar—.
 *
 * Vive acá y no repetido en cada pantalla porque ya se escribió tres veces, y
 * la tercera fue la que faltaba.
 */
export async function archivosConLasMudadas(carpetaId: string): Promise<ArchivoDrive[]> {
  const presentes = await archivosDe(carpetaId);
  const mudadas = await mudadasDe(carpetaId);
  const faltantes = mudadas.filter((id) => !presentes.some((a) => a.id === id));
  if (faltantes.length === 0) return presentes;

  const traidas = await Promise.all(
    faltantes.map(async (id): Promise<ArchivoDrive | null> => {
      try {
        const datos = await metadatosArchivo(id);
        return {
          id: datos.id,
          name: datos.name,
          mimeType: datos.mimeType,
          thumbnailLink: datos.thumbnailLink,
          modifiedTime: datos.modifiedTime,
          webViewLink: datos.webViewLink,
        };
      } catch {
        // Un archivo que ya no está en Drive no puede tumbar la pantalla.
        return null;
      }
    })
  );

  return [...presentes, ...traidas.filter((a) => a !== null)];
}
