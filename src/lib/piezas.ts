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

import { cache } from "react";
import { randomUUID } from "node:crypto";
import { coleccion } from "@/lib/almacen";
import type { Estado } from "@/dominio/pieza";
import { archivosDe, metadatosArchivo, type ArchivoDrive } from "@/lib/google";
import { mudarPublicacion } from "@/lib/publicaciones";
import { mudarPlazo } from "@/lib/plazos";
import { mudarResponsable } from "@/lib/responsables";
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
   * El archivo de Drive que se le entregó, con su identificador.
   *
   * **El número de vuelta sale del nombre, y el nombre lo cambia cualquiera.**
   * Con solo `versionEntregada`, un segundo archivo que dijera ser la misma
   * vuelta —«9304.jpeg» y «9304 V1.jpeg», o una V2 vuelta a subir— podía
   * reemplazar en el portal al que se entregó, sin que nadie lo entregara. El
   * identificador de Drive no cambia al renombrar: es lo que se le mandó.
   * Las piezas entregadas antes de que existiera no lo tienen, y para esas
   * sigue valiendo el número.
   */
  archivoEntregado?: string;
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

/**
 * Todo lo guardado de todas las piezas, **una sola vez por pedido**.
 *
 * Las tres preguntas que se hacen sobre una carpeta —en qué anda cada pieza,
 * qué se mudó a «Entregas finales» y cuántas aprobadas ya no están— se
 * contestan recorriendo la colección entera, y se hacen **por cada carpeta del
 * árbol**. Un tablero con cuarenta carpetas eran unas ochenta descargas de la
 * misma tabla en un solo render: en la computadora, ochenta lecturas del mismo
 * archivo; en internet, ochenta viajes.
 *
 * `cache` de React lo recuerda mientras dure el pedido y lo olvida después, así
 * que nada queda viejo entre una pantalla y la siguiente. Lo que esto mismo
 * escribe se le anota encima, abajo, para que el recuerdo no quede atrasado
 * respecto de lo que acaba de guardar.
 */
const cajaDePiezas = cache(() => ({
  // La **promesa**, no el resultado: dos lecturas que salen a la vez tienen
  // que colgarse del mismo viaje, no hacer dos.
  pedido: null as Promise<Record<string, EstadoDePieza>> | null,
}));

function todasLasPiezas(): Promise<Record<string, EstadoDePieza>> {
  const caja = cajaDePiezas();
  caja.pedido ??= almacen.todo();
  return caja.pedido;
}

/**
 * **La única forma de escribir piezas**, y por eso.
 *
 * El recuerdo de arriba es una optimización, y una optimización que contesta
 * distinto que la base es un error con otro nombre: una acción que guarda una
 * pieza y después lee la carpeta vería la foto de **antes** de su propia
 * escritura. Que las tres escrituras del módulo pasen por acá hace que eso no
 * dependa de que alguien se acuerde —hay un guardián en `cimientos.test.ts` que
 * verifica que nadie escriba por otro lado—.
 *
 * Se le anota encima al recuerdo en vez de tirarlo: acá ya sabemos exactamente
 * qué cambió, y tirarlo obligaría a volver a leer la colección entera en la
 * carpeta siguiente del mismo render, que es justo lo que esto vino a evitar.
 * Si nadie leyó todavía, no hay nada que poner al día.
 */
async function escribir(cambios: Record<string, EstadoDePieza | undefined>): Promise<void> {
  if (Object.keys(cambios).length === 0) return;
  await almacen.guardarVarios(cambios);

  const caja = cajaDePiezas();
  if (!caja.pedido) return;

  const leido = await caja.pedido;
  for (const [id, valor] of Object.entries(cambios)) {
    if (valor === undefined) delete leido[id];
    else leido[id] = valor;
  }
}

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
    // **`en_curso`, que es el estado seguro.** Caía a `entregada`, con el
    // argumento de que es «el más inofensivo: no aprueba nada ni cierra nada».
    // No lo es: `entregada` quiere decir que el cliente la ve y la puede
    // aprobar. Una pieza guardada por una versión anterior, o tocada a mano en
    // el archivo, se le aparecía al cliente sin que nadie hubiera decidido
    // entregársela. `sinTocar` —cincuenta líneas más arriba, por este mismo
    // motivo— ya había elegido `en_curso` para el mismo caso.
    estado: ESTADOS.includes(crudo.estado as Estado) ? (crudo.estado as Estado) : "en_curso",
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
    archivoEntregado:
      typeof crudo.archivoEntregado === "string" ? crudo.archivoEntregado : undefined,
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
  const todo = await todasLasPiezas();

  const salida: Record<string, EstadoDePieza> = {};
  const aGuardar: Record<string, EstadoDePieza | undefined> = {};

  /**
   * Lo guardado de esta carpeta que ninguna pieza de ahora reclama por nombre.
   *
   * **Es lo que hace que la identidad de una pieza sobreviva a un cambio de
   * extensión.** La identidad es `carpeta::nombre.ext`, y el nombre sale de la
   * vuelta **más baja** que hay en Drive: una pieza con `stickers.pdf` y
   * `V2 stickers.jpg` se llama `::stickers.pdf`, y el día que alguien borra el
   * PDF viejo pasa a llamarse `::stickers.jpg`. Con la identidad se perdía todo
   * lo anotado —estado, rondas, cambios, historia— y la pieza renacía en curso,
   * como si el trabajo empezara de nuevo. Lo mismo al revés, cuando aparece
   * después una vuelta más baja de otro formato.
   *
   * No se toca la regla de agrupar —dos formatos con el mismo nombre siguen
   * siendo dos piezas a propósito, porque nadie puede decidir por el usuario
   * cuál es cuál—: lo que se arregla es la mudanza de la ficha cuando la pieza
   * es demostrablemente la misma.
   */
  const huerfanas = Object.entries(todo).filter(
    ([clave]) => clave.startsWith(`${carpetaId}::`) && !piezas.some((p) => p.id === clave)
  );
  const yaAdoptadas = new Set<string>();
  /** Las que cambiaron de nombre: hay que escribirlas bajo el de ahora. */
  const mudadas = new Set<string>();
  /**
   * De qué nombre a qué nombre se mudó cada ficha, para mudar con ella lo que
   * se guarda aparte por la identidad de la pieza. `pisar` es cuando bajo el
   * nombre de ahora había una ficha de un archivo que ya no existe: lo suyo no
   * vale más que lo de la pieza de verdad.
   */
  const mudanzas: Array<{ viejo: string; nuevo: string; pisar: boolean }> = [];

  const compartenArchivos = (guardada: EstadoDePieza, archivos: string[]) =>
    (normalizar(guardada).archivos ?? []).some((a) => archivos.includes(a));

  /**
   * Si una ficha huérfana es de esta pieza.
   *
   * Compartir un archivo alcanza **salvo cuando la pieza se partió en dos**:
   * renombrar la V1 deja dos piezas que comparten archivos con la misma ficha,
   * y se la llevaba la primera en el orden de Drive, aunque no tuviera la vuelta
   * que el cliente aprobó. Ahí decide la última vuelta anotada —la más alta, que
   * es la que se le entregó—: si la tiene otra pieza de ahora, la ficha es de
   * esa. Si no la tiene nadie, vale la regla de siempre.
   */
  const esDeEsta = (guardada: EstadoDePieza, archivos: string[]) => {
    if (!compartenArchivos(guardada, archivos)) return false;
    const ultima = normalizar(guardada).archivos?.at(-1);
    if (ultima === undefined || archivos.includes(ultima)) return true;
    return !piezas.some((p) => p.archivos.includes(ultima));
  };

  /**
   * La ficha de esta pieza, buscándola también con su nombre anterior.
   *
   * **Lo que decide es compartir un archivo de Drive, no parecerse de nombre.**
   * Un archivo pertenece a una sola pieza dentro de una carpeta, así que si lo
   * guardado nombra alguno de los archivos que tengo ahora, es esta pieza y no
   * otra. Es la misma comprobación con la que más abajo se decide si una pieza
   * vuelve a empezar, usada para lo contrario: reconocerla.
   *
   * Por eso la ficha que ya está bajo este nombre gana solo si comparte algún
   * archivo. Si no comparte ninguno —es de un archivo que ya no existe— y hay
   * una huérfana que sí, la de verdad es la huérfana: quedarse con la del
   * nombre hacía renacer en curso una pieza aprobada, y la aprobada, huérfana,
   * se contaba además como entregada.
   */
  const laFicha = (id: string, archivos: string[]) => {
    const propia = todo[id];
    if (propia && compartenArchivos(propia, archivos)) return propia;

    const vieja = huerfanas.find(
      ([clave, guardada]) => !yaAdoptadas.has(clave) && esDeEsta(guardada, archivos)
    );
    // Sin huérfana que reclamar, la propia —si hay— sigue su camino: más abajo
    // se decide si es de estos archivos o si la pieza vuelve a empezar.
    if (!vieja) return propia;

    // La ficha se muda al nombre de ahora y la vieja se borra: dejar las dos
    // sería que la próxima lectura encontrara dos candidatas para lo mismo.
    yaAdoptadas.add(vieja[0]);
    mudadas.add(id);
    aGuardar[vieja[0]] = undefined;
    mudanzas.push({ viejo: vieja[0], nuevo: id, pisar: Boolean(propia) });
    return vieja[1];
  };

  for (const { id, archivos, masVieja, version } of piezas) {
    const encontrada = laFicha(id, archivos);
    const tal = encontrada ? normalizar(encontrada) : null;
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

  // Lo que se mudó de nombre se escribe siempre, haya cambiado algo o no: la
  // ficha vieja se está borrando en la misma tanda, y no escribir la nueva
  // sería perder justo lo que esta mudanza viene a salvar.
  for (const id of mudadas) if (!(id in aGuardar)) aGuardar[id] = salida[id];

  // **La fecha de publicación, el plazo y el responsable propios se mudan
  // con la ficha.** Se guardan aparte, por la identidad de la pieza, y
  // quedaban bajo el nombre viejo: la pieza caía en «sin fecha» y su plazo y su
  // responsable volvían a heredarse de la carpeta, sin que nadie lo decidiera.
  //
  // Van **antes** que la ficha a propósito: si algo falla en el medio, la
  // ficha sigue bajo el nombre viejo y la próxima lectura vuelve a intentar la
  // mudanza entera. Al revés, la ficha ya estaría mudada y lo demás quedaría
  // huérfano para siempre. Mudar dos veces no hace daño: la segunda no
  // encuentra nada bajo el nombre viejo.
  await Promise.all(
    mudanzas.flatMap(({ viejo, nuevo, pisar }) => [
      mudarPublicacion(viejo, nuevo, { pisar }),
      mudarPlazo(viejo, nuevo, { pisar }),
      mudarResponsable(viejo, nuevo, { pisar }),
    ])
  );

  // Se escribe solo cuando de verdad cambió algo, y todo junto.
  await escribir(aGuardar);

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
  const todo = await todasLasPiezas();
  return Object.entries(todo)
    .filter(([, p]) => p.mudada && p.carpetaId === carpetaId)
    .map(([id, p]) => p.archivoMudado ?? id);
}

/**
 * Cuántas piezas aprobadas de esta carpeta **ya no están en ella**.
 *
 * Es la otra mitad de «ya se entregó»: si el equipo movió a «Entregas finales»
 * el único archivo que había, la pieza desaparece de la carpeta entera y la
 * única huella que queda es lo guardado acá. Sin esto la carpeta quedaba
 * vacía, y vacía se lee como «falta subir algo», que es lo contrario.
 *
 * `presentes` son las identidades de lo que Drive todavía lista: las de pieza
 * y las de archivo, porque las guardadas antes van con la clave del archivo.
 * Lo mudado por la aplicación no cuenta: eso vuelve a listarse solo.
 */
export async function aprobadasQueSeFueron(
  carpetaId: string,
  presentes: string[]
): Promise<number> {
  const quedan = new Set(presentes);
  const todo = await todasLasPiezas();
  return Object.entries(todo).filter(
    ([id, p]) =>
      p.carpetaId === carpetaId && p.estado === "final" && !p.mudada && !quedan.has(id)
  ).length;
}

export async function guardarPieza(piezaId: string, estado: EstadoDePieza): Promise<void> {
  await escribir({ [piezaId]: estado });
}

/** Guarda varias de una vez: cerrar una revisión toca todas las piezas juntas. */
export async function guardarPiezas(
  cambios: Record<string, EstadoDePieza>
): Promise<void> {
  await escribir(cambios);
}

/**
 * Aplica un cambio a una pieza **sin pisar lo que otro guardó en el medio**.
 *
 * **Es la forma correcta de mover una pieza, y `guardarPieza` no lo era.** Una
 * transición —aprobar, entregar, reabrir, cerrar la vuelta— se hacía leyendo el
 * estado, calculando el nuevo y guardándolo en tres pasos: si entre el primero
 * y el tercero alguien más movía la misma pieza, su cambio desaparecía sin
 * error y sin rastro. El cliente aprueba en el teléfono mientras la agencia
 * reabre desde la computadora, y una de las dos cosas no pasó nunca. Es la peor
 * clase de falla que puede tener esto, porque lo que se pierde es una decisión
 * que alguien tomó. El propio almacén construyó `cambiar` justo para esto.
 *
 * `transform` recibe el estado que hay **ahora** en la base —no una foto vieja—
 * y devuelve `{ commit }` con el estado nuevo, o `{ abort }` para no tocar nada
 * y contar por qué. **Puede correr más de una vez** (si alguien ganó la carrera
 * se vuelve a leer y se vuelve a llamar con lo nuevo), así que no puede tener
 * efectos: avisar, mandar correos o mover archivos va después, con lo que esto
 * devuelve.
 */
export async function cambiarPieza<E>(
  carpetaId: string,
  piezaId: string,
  transform: (actual: EstadoDePieza) => { commit: EstadoDePieza } | { abort: E }
): Promise<{ pieza: EstadoDePieza } | { abort: E }> {
  let salida: { pieza: EstadoDePieza } | { abort: E } | null = null;
  let comprometida: EstadoDePieza | null = null;

  await almacen.cambiar(piezaId, (crudo) => {
    const actual = crudo ? normalizar(crudo) : sinTocar(carpetaId);
    const r = transform(actual);
    if ("abort" in r) {
      salida = { abort: r.abort };
      comprometida = null;
      // No se toca: se devuelve lo que había, sin pisar a nadie.
      return actual;
    }
    salida = { pieza: r.commit };
    comprometida = r.commit;
    return r.commit;
  });

  // Se le anota encima al recuerdo por-pedido, igual que `escribir`: leer la
  // carpeta después de esto tiene que ver lo que esto acaba de guardar.
  const caja = cajaDePiezas();
  if (caja.pedido && comprometida) {
    (await caja.pedido)[piezaId] = comprometida;
  }

  // `salida` siempre queda seteada: `almacen.cambiar` llama a `transform` al
  // menos una vez antes de devolver.
  return salida!;
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
        // **Lo que está en la papelera ya no es una pieza.** Drive contesta
        // igual por un archivo tirado —pedirlo por su id no mira la papelera—,
        // así que lo mudado a «Entregas finales» y después borrado seguía
        // apareciendo en su carpeta de origen como si estuviera. Los listados
        // ya lo excluían; esto es lo único que lo pedía por id.
        if (datos.trashed) return null;
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
