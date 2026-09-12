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

import { randomUUID } from "node:crypto";
import { coleccion } from "@/lib/almacen";
import type { Estado } from "@/dominio/pieza";
import { archivosDe, metadatosArchivo, type ArchivoDrive } from "@/lib/google";

export type Cambio = { id: string; texto: string };

export type Hito =
  | "entregada"
  | "reabierta_por_agencia"
  | "extra_habilitada"
  | "devuelta_a_su_carpeta"
  | "no_se_pudo_devolver"
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
  /**
   * Cuándo se entregó, si se entregó.
   *
   * **Acá arranca el plazo**, y no cuando el archivo se subió a Drive. Antes
   * el reloj salía de la fecha de modificación del archivo, con dos
   * consecuencias: subías el jueves y avisabas el lunes, y al cliente ya se le
   * habían ido cuatro de sus tres días; y volver a guardar el archivo en Drive
   * por cualquier motivo corría el vencimiento solo, sin que nadie lo decidiera.
   */
  entregadaEl?: string;
  /**
   * El archivo de Drive que se mudó a «Entregas finales», si se mudó.
   *
   * Hace falta porque el identificador de la pieza ya no es el de un archivo:
   * sin esto no habría con qué ir a buscarlo para que siga apareciendo en su
   * carpeta de origen.
   */
  archivoMudado?: string;
  historia: EntradaDeHistoria[];
};

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
/**
 * Una pieza de la que no hay nada anotado.
 *
 * **Está `en_curso`, no `entregada`.** Un archivo que aparece en Drive es
 * trabajo en marcha: el JPG a medio hacer, la prueba de color, el que se
 * guardó en la carpeta equivocada. Antes nacía entregada, y eso significaba
 * que el cliente lo veía —y lo podía aprobar— en el instante en que tocaba
 * Drive, sin que nadie lo hubiera decidido.
 *
 * Entregar es un acto de la agencia y tiene su evento en el dominio. Lo que
 * faltaba era que alguien lo llamara.
 */
function sinTocar(carpetaId: string): EstadoDePieza {
  return {
    carpetaId,
    estado: "en_curso",
    ronda: 0,
    rondasExtra: 0,
    cambios: [],
    enviada: false,
    mudada: false,
    historia: [],
  };
}

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
 * Acepta solo lo que tiene la forma esperada, y completa el resto.
 *
 * Lo que sale del almacén lo pudo escribir una versión anterior de la
 * aplicación, o alguien a mano. Un estado que no existe se cae a «entregada»,
 * que es el más inofensivo: no aprueba nada ni cierra nada.
 */
function esPieza(v: unknown): v is EstadoDePieza {
  return Boolean(v) && typeof v === "object" && typeof (v as EstadoDePieza).carpetaId === "string";
}

function normalizar(v: EstadoDePieza): EstadoDePieza {
  const crudo = v as unknown as Record<string, unknown>;
  return {
    carpetaId: v.carpetaId,
    estado: ESTADOS.includes(crudo.estado as Estado) ? (crudo.estado as Estado) : "entregada",
    ronda: typeof crudo.ronda === "number" && crudo.ronda >= 0 ? crudo.ronda : 0,
    rondasExtra:
      typeof crudo.rondasExtra === "number" && crudo.rondasExtra >= 0 ? crudo.rondasExtra : 0,
    cambios: Array.isArray(crudo.cambios) ? crudo.cambios.filter(esCambio) : [],
    enviada: crudo.enviada === true,
    mudada: crudo.mudada === true,
    entregadaEl: typeof crudo.entregadaEl === "string" ? crudo.entregadaEl : undefined,
    archivoMudado:
      typeof crudo.archivoMudado === "string" ? crudo.archivoMudado : undefined,
    historia: Array.isArray(crudo.historia) ? crudo.historia.filter(esHito) : [],
  };
}

const almacen = coleccion<EstadoDePieza>("piezas", esPieza);

/** El estado de varias piezas de una carpeta. Las que nadie tocó vienen a nuevo. */
export async function estadosDe(
  carpetaId: string,
  piezas: string[]
): Promise<Record<string, EstadoDePieza>> {
  const todo = await almacen.todo();
  return Object.fromEntries(
    piezas.map((id) => [id, todo[id] ? normalizar(todo[id]) : sinTocar(carpetaId)])
  );
}

export async function estadoDe(
  carpetaId: string,
  piezaId: string
): Promise<EstadoDePieza> {
  const guardada = await almacen.uno(piezaId);
  return guardada ? normalizar(guardada) : sinTocar(carpetaId);
}

/**
 * Los archivos que se mudaron a «Entregas finales» pero salieron de esta
 * carpeta.
 *
 * Devuelve identificadores **de Drive**, no de piezas: son para ir a buscar el
 * archivo. Las piezas viejas, guardadas cuando el identificador de la pieza
 * era el del archivo, siguen funcionando porque se cae a la clave.
 */
async function mudadasDe(carpetaId: string): Promise<string[]> {
  const todo = await almacen.todo();
  return Object.entries(todo)
    .filter(([, p]) => p.mudada && p.carpetaId === carpetaId)
    .map(([id, p]) => p.archivoMudado ?? id);
}

export async function guardarPieza(piezaId: string, estado: EstadoDePieza): Promise<void> {
  await almacen.guardar(piezaId, estado);
}

/** Guarda varias de una vez: cerrar una revisión toca todas las piezas juntas. */
export async function guardarPiezas(
  cambios: Record<string, EstadoDePieza>
): Promise<void> {
  await almacen.guardarVarios(cambios);
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

// ---------------------------------------------------------------------------

/** Cómo se cuenta cada hito en la historia que ve una persona. */
export const EN_PALABRAS: Record<Hito, string> = {
  entregada: "Se entregó",
  aprobada: "Aprobó",
  cambios_pedidos: "Pidió cambios",
  cambios_descartados: "Descartó los cambios",
  revision_enviada: "Envió la revisión",
  reabierta: "Reabrió la pieza",
  reabierta_por_agencia: "Reabrió la pieza para que el cliente la vuelva a mirar",
  extra_habilitada: "Habilitó una revisión adicional",
  movida_a_finales: "Se movió a «Entregas finales»",
  no_se_pudo_mover: "No se pudo mover a «Entregas finales»",
  devuelta_a_su_carpeta: "Volvió a su carpeta de trabajo",
  no_se_pudo_devolver: "No se pudo sacar de «Entregas finales»",
};

// ---------------------------------------------------------------------------

/**
 * **Las piezas de una carpeta.** Es la única forma correcta de preguntarlo.
 *
 * Aprobar muda el archivo a «Entregas finales», así que Drive deja de listarlo
 * en la carpeta de trabajo. Preguntarle a Drive directamente —`archivosDe`—
 * devuelve una respuesta que es verdadera sobre Drive y falsa sobre el
 * trabajo: las piezas aprobadas desaparecen.
 *
 * Eso se coló en cinco lugares distintos, de a uno por vez, y cada uno rompía
 * algo diferente: el portal perdía de vista lo aprobado, el tablero contaba
 * «0 aprobadas» justo después de aprobar, el calendario decía que guardaba y
 * descartaba, enviar la revisión salteaba lo aprobado, y no se le podía poner
 * plazo a una pieza aprobada.
 *
 * Por eso `archivosDe` está prohibido fuera de este archivo, y el linter lo
 * verifica: la pregunta correcta tiene que ser también la fácil de escribir.
 */
export async function piezasDeLaCarpeta(carpetaId: string): Promise<ArchivoDrive[]> {
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
