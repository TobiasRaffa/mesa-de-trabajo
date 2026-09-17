// Lo que pasó desde la última vez que miraste.
//
// Es la pantalla que reemplaza el «¿alguien sabe cómo viene lo de Café Otoño?»
// de los lunes. Contesta tres preguntas, en este orden, porque es el orden en
// que importan:
//
//   1. **¿Qué hizo el cliente?** Aprobó, devolvió, escribió.
//   2. **¿Dónde se me pasó la fecha?**
//   3. **¿Qué está esperando en mi cancha?**
//
// Todo sale de datos que ya existen: no hay un estado nuevo que mantener.

import { ajustesDe, esCarpetaReservada } from "@/lib/ajustes";
import { losAvisos, type Aviso } from "@/lib/avisos";
import { clientesHabilitados } from "@/lib/clientes";
import { sinLeerPorCliente } from "@/lib/conversaciones";
import { correoConfigurado } from "@/lib/correo";
import { personaPorId } from "@/lib/equipo";
import { responsableDe, responsableQueCorre } from "@/lib/responsables";
import { subcarpetasDe } from "@/lib/google";
import { piezasDeLaCarpeta, estadosDe } from "@/lib/piezas";
import { calcularVencimiento } from "@/lib/fechas";
import { plazoDe, plazosDe, plazoQueCorre } from "@/lib/plazos";
import { agruparVersiones, conSusArchivos } from "@/lib/versiones";
import {
  diasConNosotros,
  hayAlgoParaEntregar,
  sigueEnJuego,
  type Estado,
} from "@/dominio/pieza";

/**
 * De quién es el próximo movimiento.
 *
 * Es la pregunta que la agencia se hace mirando el tablero: **¿esto lo tengo
 * que mover yo, o estoy esperando al cliente?** El estado de cada pieza ya lo
 * dice, pero repartido en cinco nombres; esto los junta en la única distinción
 * que cambia lo que alguien hace a continuación.
 *
 * Cuando hay de las dos, manda la agencia: si algo espera trabajo nuestro, la
 * carpeta está en nuestra cancha aunque además falte que el cliente mire otra
 * pieza.
 *
 * **«Sin entregar» se separó de «lo tenemos nosotros».** Las dos son nuestras,
 * pero no piden lo mismo: una pide diseñar y la otra pide apretar un botón.
 * Mezcladas, lo que está listo y sin mandar se perdía entre lo que todavía hay
 * que hacer, que es la peor forma de perderlo: el cliente espera algo que ya
 * está hecho. Manda «sin entregar» cuando hay de las dos, porque es lo que se
 * resuelve en un clic.
 */
export type Cancha = "sin_entregar" | "agencia" | "cliente" | "listo";

export type CarpetaEnElTablero = {
  clienteId: string;
  cliente: string;
  carpetaId: string;
  carpeta: string;
  asignadaA: string | null;
  /**
   * Quién lo lleva, por identificador.
   *
   * Hace falta además del nombre porque la ventana del tablero vuelve a pedir
   * la carpeta, y lo que se hereda hacia cada pieza es el identificador. Sin
   * esto la ventana pedía con la herencia en blanco y cada pieza decía «sin
   * asignar» al lado de una carpeta que tiene dueño.
   */
  responsableQueCorre: string | null;
  /** Cuándo vence la revisión de esta carpeta. */
  vence: Date | null;
  /** Está vencida y todavía falta que el cliente decida. */
  vencida: boolean;
  /**
   * Le quedan dos días o menos, y todavía falta que el cliente decida.
   *
   * **Dos días y no un porcentaje del plazo.** Con plazos de 3 a 30 días, un
   * porcentaje da avisos de un día en uno y de una semana en el otro; «te
   * quedan dos días» quiere decir lo mismo siempre y se entiende sin pensar.
   *
   * Solo cuenta si hay algo esperando al cliente: un plazo que corre sobre una
   * carpeta donde no queda nada por decidir no es un problema de nadie.
   */
  porVencer: boolean;
  /** Cuántas hay en total, terminadas incluidas. */
  piezas: number;
  /**
   * Las que todavía están en juego.
   *
   * **Lo aprobado o no es de cada pieza, no del trabajo.** Un trabajo con dos
   * piezas —una aprobada y otra esperando— no tiene «2 piezas» pendientes:
   * tiene una. Contarlas juntas hacía que una pieza terminada siguiera pesando
   * en un trabajo que figura como «lo tiene el cliente», y eso es justo lo que
   * el tablero no tiene que hacer: hablar de trabajo que ya no existe.
   */
  enJuego: number;
  sinRevisar: number;
  /** Ya no están en juego: aprobadas —en «Entregas finales»— o canceladas. */
  terminadas: number;
  /**
   * Cuántas piezas se quedaron sin vueltas y piden una más.
   *
   * Es lo único del tablero que **espera una decisión de la agencia** y no
   * trabajo: alguien tiene que decir que sí. Sin esto, el cliente pedía y se
   * quedaba esperando a que alguien entrara a mirar por casualidad.
   */
  extraPedida: number;
  /**
   * Unas pocas piezas con qué mirarlas, para la vista rápida.
   *
   * **Sin viajes de más**: los archivos ya se leyeron para contar las piezas;
   * esto es quedarse con los primeros en vez de tirarlos. Son la última vuelta
   * de cada una, que es la que hay que ver.
   */
  muestras: Array<{ archivo: string; nombre: string; modificado?: string }>;
  /** Mensajes del cliente que nadie leyó. */
  sinLeer: number;
  /** Piezas que esperan trabajo de la agencia. */
  enAgencia: number;
  /** De esas, las que solo esperan que alguien apriete «Entregar». */
  sinEntregar: number;
  /** De quién es el próximo movimiento. */
  cancha: Cancha;
  /** Los días de revisión que corren acá, ya heredados. */
  diasQueCorren: number;
  /**
   * Hace cuántos días lo tenemos nosotros, contando la pieza más vieja.
   *
   * `null` cuando no hay nada de nuestro lado. No es un plazo —nosotros no
   * tenemos límite— pero es lo que ordena el tablero: lo que más tiempo lleva
   * quieto de nuestro lado va arriba.
   */
  diasConNosotros: number | null;
  /** Si el cliente ve esta carpeta en su portal. */
  visible: boolean;
  /** Si el cliente la ve como lista o como calendario. */
  vista: "lista" | "calendario";
  /**
   * Las piezas de **esta** carpeta que siguen en juego, cada una con su reloj.
   *
   * **No incluye las de adentro**, y es a propósito: los números de arriba
   * suman todo para poder avisar, y esto es lo que hace falta para después no
   * mandar a nadie a revisar cinco archivos por culpa de uno. Con las dos
   * cosas, el renglón cerrado dice «acá hay un problema» y abierto dice «es
   * este».
   */
  piezasEnJuego: PiezaEnElTablero[];
  /**
   * Las carpetas que cuelgan de esta, armadas igual.
   *
   * El trabajo no siempre está en el primer escalón: «Banners / Septiembre»
   * es una carpeta de trabajo tanto como «Banners». Antes el tablero solo
   * miraba los archivos sueltos de cada carpeta, así que todo lo que estuviera
   * un nivel más abajo no existía para esta pantalla.
   */
  hijas: CarpetaEnElTablero[];
};

/**
 * Una pieza en el tablero: lo justo para decir si está atrasada y abrirla.
 *
 * Es menos de lo que sabe la ficha de una pieza, y eso es lo que la hace
 * servir acá: el tablero se mira para decidir **a cuál entrar**, no para
 * trabajarla.
 */
export type PiezaEnElTablero = {
  id: string;
  /** El nombre del archivo en Drive, que es el que hay que ir a buscar allá. */
  nombre: string;
  estado: Estado;
  /** La última vuelta, para la miniatura. */
  archivo: string;
  modificado?: string;
  /** Hace cuántos días la tenemos nosotros. `null` si está del otro lado. */
  diasConNosotros: number | null;
  vence: Date | null;
  vencida: boolean;
  porVencer: boolean;
};

export type Tablero = {
  avisos: Aviso[];
  sinVer: number;
  carpetas: CarpetaEnElTablero[];
  correoConfigurado: boolean;
};

export async function elTablero(): Promise<Tablero> {
  const [avisos, clientes] = await Promise.all([losAvisos(), clientesHabilitados()]);

  const sinLeer = await sinLeerPorCliente("agencia");

  const porCliente = await Promise.all(
    clientes.map(async (cliente) => {
      const [carpetas, diasDelCliente, deQuienEsElCliente] = await Promise.all([
        subcarpetasDe(cliente.id),
        plazoDe(cliente.id),
        responsableDe(cliente.id),
      ]);

      return Promise.all(
        carpetas
          .filter((c) => !esCarpetaReservada(c.name))
          .map((carpeta) =>
            ramaDelTablero(
              { id: cliente.id, nombre: cliente.nombre },
              carpeta,
              { dias: diasDelCliente, responsable: deQuienEsElCliente },
              sinLeer[cliente.id] ?? 0,
              0
            )
          )
      );
    })
  );

  return {
    avisos: avisos.slice(0, 30),
    sinVer: avisos.filter((a) => !a.visto).length,
    // **Una carpeta vacía no va al tablero.** Estaba y no decía nada: ni
    // trabajo pendiente ni trabajo hecho, un renglón que hay que leer para
    // descubrir que no hay nada. Sigue estando en la ficha del cliente, que es
    // donde se la configura o se le sube algo.
    //
    // Vacía de verdad: sin piezas **y** sin carpetas adentro. Una que guarda
    // su trabajo un nivel más abajo también da cero piezas, y esconderla sería
    // esconder trabajo.
    // **Primero lo que más tiempo lleva de nuestro lado.** Un tablero ordenado
    // por como Drive devuelve las carpetas no dice nada; ordenado por cuánto
    // hace que algo está quieto, lo primero que se ve es lo que se está
    // atrasando. Lo que no está de nuestro lado va después, en su orden.
    carpetas: porCliente
      .flat()
      .filter((c) => c.piezas > 0 || c.hijas.length > 0)
      .sort((a, b) => (b.diasConNosotros ?? -1) - (a.diasConNosotros ?? -1)),
    correoConfigurado: correoConfigurado(),
  };
}

/**
 * Hasta dónde baja el tablero.
 *
 * El trabajo de verdad está a uno o dos escalones —«Banners / Septiembre»— y
 * más abajo empieza a ser el archivo del estudio. Un tope evita además que una
 * carpeta que alguien encadenó sin querer cueste veinte viajes a Drive.
 */
const HONDURA = 3;

/**
 * Una carpeta del tablero, con lo que cuelga de ella.
 *
 * **Los números de una carpeta incluyen lo que tiene adentro.** Es la
 * diferencia entre un tablero que avisa y uno al que hay que abrirle todo para
 * creerle: si una pieza de «Banners / Septiembre» lleva cinco días quieta,
 * «Banners» tiene que verse en rojo desde afuera, y el cliente también. Sin
 * esto, el único lugar donde el problema se veía era el último escalón, que es
 * justamente el que nadie abre.
 *
 * Lo que **no** se suma es `piezasEnJuego`: ahí va lo propio de esta carpeta y
 * nada más. Así el número de arriba avisa, y al abrir se ve exactamente cuál
 * está en rojo y cuál no —que es lo que evita salir a revisar cinco archivos
 * por culpa de uno—.
 */
async function ramaDelTablero(
  cliente: { id: string; nombre: string },
  carpeta: { id: string; name: string },
  heredado: { dias: number | undefined; responsable: string | null | undefined },
  sinLeer: number,
  hondura: number
): Promise<CarpetaEnElTablero> {
  const [archivos, diasDeLaCarpeta, deQuienEsLaCarpeta, ajustes, adentro] =
    await Promise.all([
      piezasDeLaCarpeta(carpeta.id),
      plazoDe(carpeta.id),
      responsableDe(carpeta.id),
      ajustesDe(carpeta.id),
      subcarpetasDe(carpeta.id).catch(() => []),
    ]);

  const dias = diasDeLaCarpeta ?? heredado.dias;
  const quien = responsableQueCorre(undefined, deQuienEsLaCarpeta, heredado.responsable);

  // Lo que cuelga de acá, con la herencia ya aplicada. Se pide antes de contar
  // nada porque los números de esta carpeta incluyen los de abajo.
  const hijas =
    hondura >= HONDURA
      ? []
      : await Promise.all(
          adentro
            .filter((c) => !esCarpetaReservada(c.name))
            .map((c) =>
              ramaDelTablero(cliente, c, { dias, responsable: quien }, sinLeer, hondura + 1)
            )
        );

  const agrupadas = agruparVersiones(archivos);
  const conArchivos = conSusArchivos(carpeta.id, agrupadas);
  const identidades = conArchivos.map((p) => p.id);
  const [estados, propios] = await Promise.all([
    estadosDe(carpeta.id, conArchivos),
    plazosDe(identidades),
  ]);

  const ahora = new Date();

  // Cada pieza de **esta** carpeta, con su reloj propio. Es lo que se ve al
  // abrir el renglón, y lo que deja señalar a la que está atrasada en vez de
  // mandar a mirar las cinco.
  const piezasEnJuego: PiezaEnElTablero[] = agrupadas.flatMap((pieza, i) => {
    const suya = identidades[i];
    const estado = estados[suya];
    if (!sigueEnJuego(estado.estado)) return [];

    const ultima = pieza.versiones[pieza.versiones.length - 1].archivo;
    const espera = diasConNosotros(estado.estado, estado.historia.at(-1)?.cuando, ahora);
    const vence = venceLaPieza(estado.entregadaEl, propios[suya], dias);
    const esperandoAlCliente =
      estado.estado === "entregada" || estado.estado === "en_revision";

    return [
      {
        id: suya,
        // El nombre de Drive: es el que hay que ir a buscar allá.
        nombre: ultima.name,
        estado: estado.estado,
        archivo: ultima.id,
        modificado: ultima.modifiedTime,
        diasConNosotros: espera,
        vence,
        vencida: Boolean(vence && vence < hoyALaMedianoche() && esperandoAlCliente),
        porVencer: Boolean(
          vence && vence >= hoyALaMedianoche() && vence <= enDias(2) && esperandoAlCliente
        ),
      },
    ];
  });

  const piezas = Object.values(estados);

  // Lo que espera al cliente: se la entregamos y todavía no decidió.
  const sinRevisar =
    piezas.filter((p) => p.estado === "entregada" || p.estado === "en_revision").length +
    suma(hijas, (h) => h.sinRevisar);

  // Lo que espera a la agencia: el cliente ya habló y falta hacerlo.
  // «extra_pedida» también es nuestra: el cliente pidió una revisión adicional
  // y está esperando que alguien la habilite.
  const enAgencia =
    piezas.filter(
      (p) =>
        p.estado === "en_curso" ||
        p.estado === "extra_pedida" ||
        (p.estado === "cambios_marcados" && p.enviada)
    ).length + suma(hijas, (h) => h.enAgencia);

  // Lo que está en Drive y todavía no se entregó. Es un subconjunto de lo
  // anterior —también es nuestro— pero se cuenta aparte porque lo que hay que
  // hacer con esto es apretar un botón, no diseñar.
  // **No alcanza con estar de nuestro lado.** Una pieza que el cliente devolvió
  // con cambios vuelve a `en_curso`, y ofrecerla para entregar ahí le manda el
  // mismo archivo que acaba de devolver. Falta la vuelta nueva.
  const sinEntregar =
    conArchivos.filter(({ id, version }) =>
      hayAlgoParaEntregar(estados[id].estado, version, estados[id].versionEntregada)
    ).length + suma(hijas, (h) => h.sinEntregar);

  // Lo que ya no está en juego. Sigue existiendo —nada se borra— pero no es
  // trabajo pendiente de nadie.
  const terminadas =
    piezas.filter((p) => !sigueEnJuego(p.estado)).length +
    suma(hijas, (h) => h.terminadas);

  const cuantas = piezas.length + suma(hijas, (h) => h.piezas);

  // Una carpeta **vacía** no está aprobada: no hay nada que aprobar. Caía en
  // «Aprobado» porque no esperaba nada de nadie, y con ese título puesto se
  // leía como un trabajo terminado. Lo que le falta es que alguien suba algo,
  // así que es nuestra.
  const vacia = cuantas === 0;

  const cancha: Cancha =
    sinEntregar > 0
      ? "sin_entregar"
      : enAgencia > 0 || vacia
        ? "agencia"
        : sinRevisar > 0
          ? "cliente"
          : "listo";

  // Lo que más tiempo lleva de nuestro lado manda, esté donde esté: es lo que
  // hay que ver primero cuando algo se está quedando quieto.
  const esperas = [
    ...piezasEnJuego.map((p) => p.diasConNosotros),
    ...hijas.map((h) => h.diasConNosotros),
  ].filter((d): d is number => d !== null);

  // El vencimiento que manda es el más cercano, esté en esta carpeta o abajo.
  const fechas = [
    ...piezasEnJuego.map((p) => p.vence),
    ...hijas.map((h) => h.vence),
  ].filter((f): f is Date => f !== null);

  const persona = await personaPorId(quien ?? undefined);

  return {
    cancha,
    diasQueCorren: plazoQueCorre(undefined, diasDeLaCarpeta, heredado.dias),
    diasConNosotros: esperas.length > 0 ? Math.max(...esperas) : null,
    enAgencia,
    sinEntregar,
    clienteId: cliente.id,
    cliente: cliente.nombre,
    carpetaId: carpeta.id,
    carpeta: carpeta.name,
    asignadaA: persona?.nombre ?? null,
    responsableQueCorre: quien ?? null,
    vence:
      fechas.length > 0 ? new Date(Math.min(...fechas.map((f) => f.getTime()))) : null,
    // Vencida solo cuenta si todavía falta que el cliente decida: una carpeta
    // terminada con fecha vieja no es un problema.
    vencida: piezasEnJuego.some((p) => p.vencida) || hijas.some((h) => h.vencida),
    porVencer: piezasEnJuego.some((p) => p.porVencer) || hijas.some((h) => h.porVencer),
    piezas: cuantas,
    enJuego: cuantas - terminadas,
    sinRevisar,
    terminadas,
    extraPedida:
      piezas.filter((p) => p.estado === "extra_pedida").length +
      suma(hijas, (h) => h.extraPedida),
    muestras: piezasEnJuego.slice(0, 4).map((p) => ({
      archivo: p.archivo,
      nombre: p.nombre,
      modificado: p.modificado,
    })),
    sinLeer,
    visible: ajustes.visible,
    vista: ajustes.vista,
    piezasEnJuego,
    hijas,
  };
}

const suma = <T,>(xs: T[], de: (x: T) => number) => xs.reduce((n, x) => n + de(x), 0);

/**
 * Cuándo vence la revisión de una pieza.
 *
 * **El reloj arranca cuando se entrega, no cuando se sube.** Salía de la fecha
 * de modificación del archivo, con dos consecuencias: subías el jueves y
 * avisabas el lunes, y al cliente ya se le habían ido cuatro de sus tres días;
 * y volver a guardar el archivo en Drive corría el vencimiento solo.
 *
 * Una pieza sin entregar no vence: todavía no empezó a correr.
 */
function venceLaPieza(
  entregadaEl: string | undefined,
  propio: number | undefined,
  heredado: number | undefined
): Date | null {
  if (!entregadaEl) return null;
  return calcularVencimiento(
    new Date(entregadaEl),
    plazoQueCorre(propio, heredado, undefined)
  );
}

/**
 * Hoy a las 00:00.
 *
 * Se compara contra la medianoche y no contra el instante: una entrega que
 * vence «hoy» no está vencida a las nueve de la mañana.
 */
/** La medianoche de dentro de tantos días. */
function enDias(cuantos: number): Date {
  const d = hoyALaMedianoche();
  d.setDate(d.getDate() + cuantos);
  return d;
}

function hoyALaMedianoche(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}
