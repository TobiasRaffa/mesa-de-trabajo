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
  /** La agencia entregó una tanda. Es el único que va hacia el cliente. */
  | "entregamos"
  | "aprobo"
  | "pidio_cambios"
  /** Se le acabaron las vueltas incluidas y pide una más. Espera una decisión. */
  | "pidio_extra"
  | "envio_revision"
  | "escribio"
  /** Pasó la mitad del plazo y el cliente todavía no decidió. Lo manda el calendario. */
  | "por_vencer"
  /** Se cumplió el plazo y todavía falta revisar. Lo manda el calendario. */
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
  /**
   * Cuántas veces pasó lo mismo seguido, cuando el aviso junta varias.
   *
   * Sin esto es una. Lo llevan los mensajes: cuatro seguidos del cliente son
   * un aviso que dice «cuatro», no cuatro renglones iguales.
   */
  veces?: number;
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

/**
 * Cuánto tiempo seguido cuenta como «la misma vez». Cinco minutos: lo que
 * tarda alguien en escribir una idea en cuatro mensajes.
 */
export const VENTANA_DE_RACHA = 5 * 60 * 1000;

/**
 * ¿Este aviso es la continuación de aquel?
 *
 * **Cuatro mensajes seguidos del cliente son una sola novedad.** Uno por
 * mensaje llenaba la bandeja de renglones iguales —«Escribió en la
 * conversación» cuatro veces— y hacía que el número de sin leer dijera cuatro
 * cuando lo que había era una persona escribiendo.
 *
 * Se suma al anterior cuando es de la misma clase, del mismo cliente, llegó
 * dentro de la ventana **y nadie lo vio todavía**. Visto, lo nuevo es nuevo:
 * si alguien miró la bandeja entre un mensaje y el otro, el segundo tiene que
 * volver a avisarle.
 */
export function continuaA(
  anterior: Pick<Aviso, "clase" | "clienteId" | "cuando" | "visto">,
  nuevo: { clase: ClaseDeAviso; clienteId: string },
  ahora: Date,
  ventana = VENTANA_DE_RACHA
): boolean {
  if (anterior.visto) return false;
  if (anterior.clase !== nuevo.clase || anterior.clienteId !== nuevo.clienteId) return false;
  const desde = new Date(anterior.cuando).getTime();
  if (Number.isNaN(desde)) return false;
  const pasaron = ahora.getTime() - desde;
  return pasaron >= 0 && pasaron <= ventana;
}

/**
 * El aviso más nuevo al que se sumaría uno de esta clase y cliente, si hay.
 *
 * Solo tiene sentido para lo que se repite —mensajes—: una aprobación y otra
 * son dos cosas distintas aunque vengan seguidas, y quien llama decide.
 */
export async function avisoQueContinua(
  nuevo: { clase: ClaseDeAviso; clienteId: string },
  ahora = new Date()
): Promise<Aviso | null> {
  const ultimo = (await losAvisos()).find(
    (a) => a.clase === nuevo.clase && a.clienteId === nuevo.clienteId
  );
  return ultimo && continuaA(ultimo, nuevo, ahora) ? ultimo : null;
}

/** Reescribe un aviso que ya está: el texto y la hora, que pasa a ser ahora. */
export async function actualizarAviso(
  aviso: Aviso,
  cambios: Partial<Pick<Aviso, "texto" | "cuando" | "veces">>
): Promise<Aviso> {
  const nuevo = { ...aviso, ...cambios };
  await almacen.guardar(aviso.id, nuevo);
  return nuevo;
}

/**
 * Marca como vistos los avisos que se le digan.
 *
 * **Recibe cuáles y no los marca todos**: quien lleva dos clientes de ocho no
 * puede, tocando «marcar leído», bajarle el contador a los otros seis —que ni
 * siquiera ve—. Quien llega a todos le pasa todos, y queda igual que antes.
 */
export async function marcarVistos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const cuales = new Set(ids);
  const cambios: Record<string, Aviso> = {};
  for (const aviso of await losAvisos()) {
    if (!aviso.visto && cuales.has(aviso.id)) cambios[aviso.id] = { ...aviso, visto: true };
  }
  await almacen.guardarVarios(cambios);
}
