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
// Los hitos y cómo se leen viven en el dominio: los necesita una pantalla, y
// este módulo lee y escribe archivos. Se reexportan para no obligar a nadie a
// cambiar de puerta.
export { EN_PALABRAS, type Hito } from "@/dominio/historia";
import type { Hito } from "@/dominio/historia";

export type Cambio = { id: string; texto: string };


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
  /**
   * Los comentarios de Drive que ya se copiaron a `cambios`.
   *
   * **No se vacía nunca, ni cuando se vacía `cambios`.** Esa lista se limpia
   * al entregar la vuelta siguiente —es lo correcto, la revisión nueva empieza
   * en blanco— pero el comentario sigue estando en Drive, así que sin esta
   * memoria volvería a copiarse en la lectura siguiente, y el cliente vería
   * resucitar un pedido que ya le contestamos.
   */
  comentariosCopiados?: string[];
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
   * Qué número de vuelta se le entregó al cliente.
   *
   * **Es lo único que contesta «¿hay algo nuevo para entregar?».** Se deducía
   * de la ronda, y eso vale solo mientras las versiones vayan una por ronda:
   * con una versión de más, el tablero ofrecía entregarle al cliente el mismo
   * archivo que acababa de devolver.
   */
  versionEntregada?: number;
  /**
   * El archivo de Drive que se mudó a «Entregas finales», si se mudó.
   *
   * Hace falta porque el identificador de la pieza ya no es el de un archivo:
   * sin esto no habría con qué ir a buscarlo para que siga apareciendo en su
   * carpeta de origen.
   */
  archivoMudado?: string;
  /**
   * Los archivos de Drive que eran esta pieza la última vez que se la miró.
   *
   * **Es lo que distingue una vuelta nueva de un archivo nuevo.** La pieza se
   * llama por su nombre —«stickers»—, porque subir la V2 no puede borrar lo
   * anotado sobre la V1. Pero entonces borrar el archivo y subir otro con el
   * mismo nombre heredaba una vida ajena: el archivo nuevo nacía aprobado, con
   * las rondas gastadas y los cambios de otro. Dentro de un año, peor.
   *
   * La diferencia está acá. Subir la V2 **agrega** un archivo y deja la V1 en
   * su lugar: algo de lo conocido sigue estando, es la misma pieza. Borrar y
   * volver a subir no deja nada: ninguno de los archivos conocidos existe, y
   * eso ya no es la misma pieza aunque se llame igual.
   *
   * Vacío en las piezas guardadas antes de que esto existiera. La primera vez
   * que se las mira se anota lo que hay y no se decide nada: no se puede
   * inventar un pasado que nadie guardó.
   */
  archivos?: string[];
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
    comentariosCopiados: Array.isArray(crudo.comentariosCopiados)
      ? crudo.comentariosCopiados.filter((x): x is string => typeof x === "string")
      : undefined,
    enviada: crudo.enviada === true,
    mudada: crudo.mudada === true,
    entregadaEl: typeof crudo.entregadaEl === "string" ? crudo.entregadaEl : undefined,
    versionEntregada:
      typeof crudo.versionEntregada === "number" && crudo.versionEntregada >= 1
        ? crudo.versionEntregada
        : undefined,
    archivoMudado:
      typeof crudo.archivoMudado === "string" ? crudo.archivoMudado : undefined,
    archivos: Array.isArray(crudo.archivos)
      ? crudo.archivos.filter((a): a is string => typeof a === "string")
      : undefined,
    historia: Array.isArray(crudo.historia) ? crudo.historia.filter(esHito) : [],
  };
}

const almacen = coleccion<EstadoDePieza>("piezas", esPieza);

/**
 * El estado de varias piezas de una carpeta. Las que nadie tocó vienen a nuevo.
 *
 * **Pide los archivos de cada pieza y no solo su nombre**, a propósito: es lo
 * único con lo que se puede distinguir una vuelta nueva de un archivo nuevo
 * que se llama igual, y pedirlo en la firma hace que ninguna pantalla pueda
 * olvidarse de preguntarlo. No compila sin decirlo.
 *
 * Cuando ninguno de los archivos conocidos sigue en Drive, la pieza **vuelve a
 * empezar**: el archivo que estaba se borró y el que hay ahora es otro, aunque
 * se llame igual. No se borra nada —la historia sigue entera y se le anota el
 * reemplazo—, pero el estado, las rondas y los cambios arrancan de cero. Sin
 * esto, un archivo subido un año después nacía aprobado.
 */
export async function estadosDe(
  carpetaId: string,
  piezas: Array<{ id: string; archivos: string[]; masVieja?: string; version?: number }>
): Promise<Record<string, EstadoDePieza>> {
  const todo = await almacen.todo();

  const salida: Record<string, EstadoDePieza> = {};
  const aGuardar: Record<string, EstadoDePieza> = {};

  for (const { id, archivos, masVieja, version } of piezas) {
    const tal = todo[id] ? normalizar(todo[id]) : null;
    const guardada = tal ? conLaVueltaEntregada(tal, version) : null;
    // Lo completado hay que guardarlo, no solo mostrarlo: si se recalculara en
    // cada lectura, la vuelta nueva que suban mañana quedaría anotada como «lo
    // que ya se entregó» y nunca se ofrecería para entregar.
    const seCompleto = Boolean(tal && guardada && tal !== guardada);

    if (!guardada) {
      salida[id] = sinTocar(carpetaId);
      continue;
    }

    const conocidos = guardada.archivos ?? [];

    // **Guardada antes de que existiera la lista de archivos.**
    //
    // No se puede saber si es de estos archivos... salvo por una cosa: un
    // trabajo no pudo entregarse antes de que existiera el archivo que se
    // entregó. Si todo lo que hay ahora es más nuevo que lo anotado, lo
    // anotado es de otro archivo, y adoptarlo pone delante del cliente una
    // pieza «entregada» que nadie entregó —con su botón de aprobar incluido—.
    //
    // Pasó al mover unos archivos a una carpeta donde, meses antes, había
    // habido otro con el mismo nombre.
    if (conocidos.length === 0) {
      salida[id] = puedeSerDeEstos(guardada, masVieja)
        ? { ...guardada, archivos }
        : vuelveAEmpezar(guardada, carpetaId, archivos);
      aGuardar[id] = salida[id];
      continue;
    }

    if (!conocidos.some((a) => archivos.includes(a))) {
      salida[id] = vuelveAEmpezar(guardada, carpetaId, archivos);
      aGuardar[id] = salida[id];
      continue;
    }

    // Sigue siendo la misma pieza. Si aparecieron o se fueron vueltas, se
    // anota lo que hay ahora: es lo que se va a comparar la próxima vez.
    if (distintos(conocidos, archivos)) {
      salida[id] = { ...guardada, archivos };
      aGuardar[id] = salida[id];
    } else {
      salida[id] = guardada;
      if (seCompleto) aGuardar[id] = guardada;
    }
  }

  // Se escribe solo cuando de verdad cambió algo, y todo junto.
  if (Object.keys(aGuardar).length > 0) await almacen.guardarVarios(aGuardar);

  return salida;
}

/**
 * Completa qué vuelta se le entregó, en las piezas guardadas de antes.
 *
 * **Sin esto, todo lo entregado antes de que este dato existiera parecía tener
 * algo nuevo para entregar.** La pregunta «¿hay una versión más alta que la
 * entregada?» con «entregada» en blanco contesta que sí siempre, y el tablero
 * volvía a ofrecer el mismo archivo que el cliente acababa de devolver.
 *
 * Se asume que lo entregado fue lo que hay ahora, que es lo más probable y
 * además el error seguro: peor que no ofrecer una entrega es ofrecer una que
 * le manda al cliente lo mismo. Y se anota, así la próxima vuelta que suban sí
 * se detecta.
 */
function conLaVueltaEntregada(
  pieza: EstadoDePieza,
  version: number | undefined
): EstadoDePieza {
  if (!pieza.entregadaEl || pieza.versionEntregada !== undefined || !version) {
    return pieza;
  }
  return { ...pieza, versionEntregada: version };
}

const distintos = (a: string[], b: string[]) =>
  a.length !== b.length || a.some((x) => !b.includes(x));

/**
 * Si lo anotado puede ser de los archivos que hay ahora.
 *
 * Contesta que sí salvo cuando es **imposible**: cuando lo más viejo que hay
 * en Drive es más nuevo que lo primero que se anotó. Ahí no hay duda —nada
 * pudo pasarle a un archivo antes de que el archivo existiera— y es la única
 * certeza disponible sin la lista de archivos.
 *
 * Sin fecha de Drive contesta que sí: ante la duda, se conserva lo anotado.
 */
function puedeSerDeEstos(guardada: EstadoDePieza, masVieja: string | undefined): boolean {
  if (!masVieja) return true;

  const primero = guardada.historia[0]?.cuando ?? guardada.entregadaEl;
  if (!primero) return true;

  return masVieja <= primero;
}

/**
 * La pieza empieza de nuevo, con su historia intacta.
 *
 * Se guarda todo lo que pasó —acá no se borra nada— y se le anota encima que
 * el archivo se reemplazó. Lo que arranca de cero es lo que describe al
 * archivo que ya no está: el estado, las rondas, los cambios pedidos.
 */
function vuelveAEmpezar(
  vieja: EstadoDePieza,
  carpetaId: string,
  archivos: string[]
): EstadoDePieza {
  return anotar(
    {
      ...sinTocar(carpetaId),
      historia: vieja.historia,
      archivos,
    },
    "archivo_reemplazado",
    "La aplicación"
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
