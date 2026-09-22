// El corazón del producto: cómo se mueve una pieza entre estados.
//
// Está acá, separado de todo lo demás, porque es la única parte que no puede
// estar mal. Las pantallas se rediseñan, la base de datos se cambia, pero si
// estas reglas fallan el portal miente sobre en qué estado está un trabajo, y
// eso es exactamente lo que vino a arreglar.
//
// No sabe nada de Drive, ni de la base de datos, ni de React. Recibe una pieza
// y un evento, y devuelve la pieza nueva o el motivo por el que no se puede.

// La cuenta de días de calendario, que es una regla y no una utilidad.
import { diasDeDiferencia } from "@/dominio/tiempo";

/**
 * Dónde está una pieza.
 *
 * De quién es la pelota se deduce del estado, y ese es todo el punto:
 *   - agencia:  en_curso, cambios_marcados (después de cerrar la ronda)
 *   - cliente:  entregada, en_revision
 *   - nadie:    extra_pedida (espera una decisión interna), final, cancelada
 */
export type Estado =
  /** La agencia la está trabajando. El cliente no la ve. */
  | "en_curso"
  /** Entregada al cliente. Corre el plazo. Todavía no la abrió. */
  | "entregada"
  /** El cliente la abrió y todavía no decidió. */
  | "en_revision"
  /**
   * El cliente pidió cambios, pero la ronda sigue abierta.
   * Los comentarios NO llegan a la agencia hasta que se cierre.
   */
  | "cambios_marcados"
  /** Se agotaron las rondas incluidas. Espera que una administradora habilite. */
  | "extra_pedida"
  /** Aprobada y bloqueada. Solo una administradora puede reabrirla. */
  | "final"
  /** El proyecto se cayó. No se borra: queda con su historia. */
  | "cancelada";

export type Pieza = {
  estado: Estado;
  /** 0 es el boceto original. 1 es la ronda 1, y así. */
  ronda: number;
  /** Cuántas rondas de cambio entran en el presupuesto. Por defecto 2. */
  rondasIncluidas: number;
  /** Rondas que una administradora habilitó por encima de las incluidas. */
  rondasExtra: number;
};

export type Evento =
  /** La agencia la marca como entregada. Acá arranca el plazo. */
  | { tipo: "entregar" }
  /** El cliente abrió la entrega. Solo cambia lo que ve la agencia. */
  | { tipo: "abrir" }
  /** El cliente la aprueba. Es inmediato y definitivo. */
  | { tipo: "aprobar"; por: string }
  /** El cliente pide cambios. Se guardan hasta que cierre la ronda. */
  | { tipo: "pedir_cambios" }
  /** Se arrepiente del pedido de cambios y vuelve a dejarla sin decidir. */
  | { tipo: "descartar_cambios" }
  /** Se acabaron las rondas: el cliente (o la agencia) pide una más. */
  | { tipo: "pedir_revision_extra" }
  /** Una administradora habilita esa revisión. Suma una ronda. */
  | { tipo: "habilitar_extra" }
  /** El cliente cierra la ronda. Recién acá la devolución llega a la agencia. */
  | { tipo: "cerrar_revision" }
  /** Una administradora reabre algo aprobado. Se le avisa al cliente. */
  | { tipo: "reabrir"; por: string }
  /** El proyecto se cayó. */
  | { tipo: "cancelar" };

export type Resultado =
  | { ok: true; pieza: Pieza }
  | { ok: false; motivo: string };

export const RONDAS_INCLUIDAS_POR_DEFECTO = 2;

/** Una pieza recién creada, antes de mostrarle nada a nadie. */
export function piezaNueva(rondasIncluidas = RONDAS_INCLUIDAS_POR_DEFECTO): Pieza {
  return { estado: "en_curso", ronda: 0, rondasIncluidas, rondasExtra: 0 };
}

/** Cuántas rondas de cambio admite en total, contando las habilitadas aparte. */
export const rondasDisponibles = (p: Pieza) => p.rondasIncluidas + p.rondasExtra;

/** ¿Le queda alguna ronda de cambio? */
export const quedanRondas = (p: Pieza) => p.ronda < rondasDisponibles(p);

/** Una pieza aprobada está cerrada con llave: no admite comentarios ni versiones. */
export const estaBloqueada = (p: Pieza) => p.estado === "final";

/**
 * ¿Sigue en juego?
 *
 * **El estado es de cada pieza, no del trabajo.** Un trabajo con dos piezas
 * —una aprobada y otra esperando— tiene una sola cosa pendiente, y las
 * pantallas que cuentan «2 piezas» hacen que lo terminado siga pesando donde
 * ya no tiene nada que hacer.
 *
 * Vive acá y no en cada pantalla porque la misma pregunta se hace en tres
 * lugares —el tablero, la ventana de un trabajo y el árbol de un cliente— y
 * escrita tres veces se separa: alguien agrega un estado nuevo y lo cuenta
 * distinto en cada una. Acá el compilador obliga a decidir qué es.
 */
export function sigueEnJuego(estado: Estado): boolean {
  switch (estado) {
    case "en_curso":
    case "entregada":
    case "en_revision":
    case "cambios_marcados":
    case "extra_pedida":
      return true;
    // Aprobada —ya está en «Entregas finales»— o caída. Sigue existiendo,
    // porque acá no se borra nada, pero no espera a nadie.
    case "final":
    case "cancelada":
      return false;
  }
}

/**
 * ¿Puede el cliente escribir cambios ahora?
 *
 * Dos condiciones, y las dos hacen falta: que la pieza **esté de su lado** y
 * que **todavía no la haya mandado**. Mandada, lo escrito queda firme: es lo
 * que la agencia ya está trabajando, y agregarle un renglón por atrás sería
 * cambiarle el pedido a alguien que ya empezó.
 *
 * Existe por los comentarios de Drive. Uno escrito mientras la pieza está de
 * nuestro lado no es un pedido de esta vuelta —el cliente no la tiene— y
 * meterlo igual en su lista le pone en la boca algo que no dijo ahora. Se
 * queda esperando, y entra cuando le vuelva a tocar.
 */
export function puedeEscribirCambios(estado: Estado, enviada: boolean): boolean {
  if (enviada) return false;

  switch (estado) {
    case "entregada":
    case "en_revision":
    case "cambios_marcados":
      return true;
    // `en_curso` y `extra_pedida` la tenemos nosotros; `final` y `cancelada`
    // ya no esperan a nadie.
    case "en_curso":
    case "extra_pedida":
    case "final":
    case "cancelada":
      return false;
  }
}

/**
 * ¿Hay algo nuevo para entregarle al cliente?
 *
 * **No alcanza con que la pieza esté de nuestro lado.** Cuando el cliente
 * devuelve la V1 con cambios, la pieza vuelve a nosotros —queda `en_curso`— y
 * la aplicación ofrecía entregarla de nuevo en el acto. Entregar ahí le manda
 * al cliente **el mismo archivo que acaba de devolver**, sin una línea
 * cambiada: el peor mensaje posible, porque parece que se hizo el trabajo.
 *
 * Lo que falta es la vuelta nueva, y la pregunta se contesta con una sola
 * comparación: **¿hay en Drive una versión más alta que la que se le
 * entregó?** Si no la hay, lo que se le mandaría es lo mismo que devolvió.
 *
 * **Se comparaba contra la ronda** —«la vuelta 1 necesita la V2»— y eso vale
 * solo mientras las versiones vayan una por ronda, sin saltos y sin que la
 * pieza haya vuelto a empezar. Cuando no, sobran versiones: una pieza con
 * cuatro archivos y una ronda daba «hay algo para entregar» al segundo
 * siguiente de que el cliente devolviera la última, con el mismo archivo.
 *
 * Sin nada entregado todavía, cualquier versión es nueva para el cliente.
 */
export function hayAlgoParaEntregar(
  estado: Estado,
  /** El número de vuelta más alto que hay en Drive. */
  version: number,
  /** El que se le entregó al cliente, si se le entregó alguno. */
  entregada: number | undefined
): boolean {
  if (estado !== "en_curso" || version < 1) return false;
  return entregada === undefined || version > entregada;
}

/**
 * ¿Ya se entregó de verdad: el archivo aprobado se fue a «Entregas finales»?
 *
 * **Aprobada no es el final del camino; entregada sí.** Cuando el cliente
 * aprueba, la pieza queda en «Aprobado» del tablero esperando que el equipo
 * suba lo terminado a «Entregas finales». El equipo lo hace moviendo el
 * archivo aprobado a mano, en Drive, y ahí el trabajo llegó a su fin: no
 * tiene por qué seguir ocupando una columna.
 *
 * Se nota porque **la vuelta que se le entregó ya no está en la carpeta**: las
 * versiones viejas pueden quedar —la V1, la V4—, pero la V6 que el cliente
 * aprobó se fue. Si la vuelta entregada sigue ahí, sigue en «Aprobado»: quizás
 * la copiaron en vez de moverla, y eso no es entregar.
 */
export function yaSeEntrego(
  estado: Estado,
  /** La vuelta que se le entregó al cliente, si se anotó. */
  versionEntregada: number | undefined,
  /** La vuelta más alta que queda hoy en la carpeta. */
  versionMasAlta: number
): boolean {
  if (estado !== "final" || versionEntregada === undefined) return false;
  return versionMasAlta < versionEntregada;
}

/**
 * ¿La tenemos nosotros?
 *
 * **Decide cuál de los dos relojes se muestra.** Hay dos y son distintos: el
 * del cliente —los días que tiene para revisar, que se le vencen— y el
 * nuestro, que no es un plazo sino una cuenta de cuánto hace que algo no se
 * mueve. Mostrar el vencimiento del cliente sobre una pieza que está de
 * nuestro lado es mostrar un reloj que no corre para nadie: el cliente ya
 * contestó, y lo que falta es trabajo nuestro.
 */
export function laTenemosNosotros(estado: Estado): boolean {
  return estado === "en_curso" || estado === "extra_pedida";
}

/**
 * Hace cuántos días lo tenemos nosotros.
 *
 * **No es un plazo: es una cuenta.** El cliente tiene días para revisar y se le
 * vencen; nosotros no tenemos límite, pero saber que algo lleva cuatro días
 * quieto de nuestro lado es la mitad de lo que se mira en un tablero por la
 * mañana. Sin esto, un trabajo podía estar dos semanas esperando sin que nada
 * lo dijera.
 *
 * Cuenta desde lo último que le pasó a la pieza, que es cuando volvió a
 * nuestras manos. Devuelve `null` cuando la pelota no es nuestra: ahí el reloj
 * que corre es el del cliente, y son dos cuentas distintas.
 */
export function diasConNosotros(
  estado: Estado,
  ultimoMovimiento: string | undefined,
  ahora: Date
): number | null {
  if (deQuienEsLaPelota({ estado, ronda: 0, rondasIncluidas: 0, rondasExtra: 0 }) !== "agencia") {
    return null;
  }
  if (!ultimoMovimiento) return null;

  const desde = new Date(ultimoMovimiento);
  if (Number.isNaN(desde.getTime())) return null;

  // **Días de calendario, no bloques de veinticuatro horas.** Dividir por un
  // día en milisegundos —que es lo que hacía— cuenta otra cosa: algo que
  // volvió el viernes a las seis de la tarde y se mira el domingo al mediodía
  // daba «1» acá y «2» en todo el resto de la aplicación, así que el semáforo
  // del tablero —que se prende a los dos días— se prendía un día tarde.
  return Math.max(0, diasDeDiferencia(desde, ahora));
}

/**
 * ¿La pieza está esperando al cliente?
 *
 * **Incluye la que tiene cambios escritos que todavía no mandó.** Se contaba a
 * mano en tres lugares como «entregada o en revisión», y `cambios_marcados` sin
 * enviar no entraba en ninguna cuenta: no era del cliente ni de la agencia. El
 * tablero ponía ese trabajo en «Aprobado» —«mové el archivo a Entregas finales
 * para cerrarlo»— mientras el cliente estaba escribiendo cambios, y su plazo no
 * se marcaba nunca como vencido. La pelota la tiene el cliente hasta que manda.
 *
 * Mandados (`enviada`), los cambios ya son de la agencia.
 */
export function esperaAlCliente(p: { estado: Estado; enviada: boolean }): boolean {
  switch (p.estado) {
    case "entregada":
    case "en_revision":
      return true;
    case "cambios_marcados":
      return !p.enviada;
    case "en_curso":
    case "extra_pedida":
    case "final":
    case "cancelada":
      return false;
  }
}

/** ¿De quién se está esperando algo? Es la pregunta que contesta el tablero. */
export function deQuienEsLaPelota(p: Pieza): "agencia" | "cliente" | "nadie" {
  switch (p.estado) {
    case "en_curso":
      return "agencia";
    case "entregada":
    case "en_revision":
    case "cambios_marcados":
      return "cliente";
    case "extra_pedida":
      // Espera una decisión de una administradora, no del cliente.
      return "agencia";
    case "final":
    case "cancelada":
      return "nadie";
  }
}

const no = (motivo: string): Resultado => ({ ok: false, motivo });
const si = (pieza: Pieza): Resultado => ({ ok: true, pieza });

/**
 * Aplica un evento a una pieza.
 *
 * Devuelve la pieza nueva, o el motivo por el que no se puede — así la pantalla
 * puede explicar por qué un botón no está disponible en vez de simplemente
 * esconderlo.
 *
 * Tres reglas que no se pueden romper, y que están probadas una por una:
 *
 *   1. Aprobar es inmediato y por pieza. No espera a que se cierre la ronda ni
 *      a que se resuelvan las demás piezas de la entrega.
 *   2. Los pedidos de cambio esperan al cierre de la ronda. La agencia recibe
 *      la devolución completa de una vez, no de a goteo.
 *   3. Que venza el plazo no cambia ningún estado. Por eso no existe un evento
 *      de vencimiento: el plazo dispara avisos, nunca decisiones.
 */
export function aplicar(pieza: Pieza, evento: Evento): Resultado {
  // Una pieza cancelada no vuelve por sí sola desde ningún lado.
  if (pieza.estado === "cancelada") {
    return no("La pieza está cancelada.");
  }

  switch (evento.tipo) {
    case "cancelar":
      return si({ ...pieza, estado: "cancelada" });

    case "entregar":
      if (pieza.estado !== "en_curso") {
        return no("Solo se puede entregar una pieza que se esté trabajando.");
      }
      return si({ ...pieza, estado: "entregada" });

    case "abrir":
      if (pieza.estado !== "entregada") {
        // Que el cliente vuelva a abrir algo que ya miró no es un error, pero
        // tampoco cambia nada.
        return no("La pieza no está esperando que el cliente la abra.");
      }
      return si({ ...pieza, estado: "en_revision" });

    case "aprobar":
      // Se puede aprobar incluso una pieza donde ya se habían marcado cambios,
      // mientras la ronda siga abierta: nada salió todavía hacia la agencia,
      // así que cambiar de opinión no rompe nada. Si no se pudiera, el cliente
      // quedaría atrapado por un clic.
      if (
        pieza.estado !== "entregada" &&
        pieza.estado !== "en_revision" &&
        pieza.estado !== "cambios_marcados"
      ) {
        return no("Solo se puede aprobar una pieza que esté en revisión.");
      }
      // Regla 1: es inmediato. No espera el cierre de la ronda.
      return si({ ...pieza, estado: "final" });

    case "pedir_cambios":
      if (pieza.estado !== "entregada" && pieza.estado !== "en_revision") {
        return no("Solo se pueden pedir cambios sobre una pieza en revisión.");
      }
      if (!quedanRondas(pieza)) {
        // El tope. Acá el botón de pedir cambios desaparece y aparece el de
        // pedir una revisión adicional.
        return no("Se agotaron las rondas incluidas. Hay que pedir una revisión adicional.");
      }
      return si({ ...pieza, estado: "cambios_marcados" });

    case "descartar_cambios":
      if (pieza.estado !== "cambios_marcados") {
        return no("No hay ningún pedido de cambios que descartar.");
      }
      // Vuelve a quedar sin decidir, no aprobada: descartar lo que escribí no
      // es lo mismo que decir que está bien. Nada salió hacia la agencia, así
      // que tampoco consume una ronda.
      return si({ ...pieza, estado: "en_revision" });

    case "pedir_revision_extra":
      if (pieza.estado !== "entregada" && pieza.estado !== "en_revision") {
        return no("Solo se pide una revisión adicional sobre una pieza en revisión.");
      }
      if (quedanRondas(pieza)) {
        return no("Todavía quedan rondas incluidas: no hace falta pedir una adicional.");
      }
      return si({ ...pieza, estado: "extra_pedida" });

    case "habilitar_extra":
      if (pieza.estado !== "extra_pedida") {
        return no("No hay ninguna revisión adicional pendiente de habilitar.");
      }
      // Vuelve a revisión con una ronda más disponible. El cliente recibe aviso.
      return si({ ...pieza, estado: "en_revision", rondasExtra: pieza.rondasExtra + 1 });

    case "cerrar_revision":
      // Regla 2: recién acá la devolución llega a la agencia.
      if (pieza.estado === "cambios_marcados") {
        return si({ ...pieza, estado: "en_curso", ronda: pieza.ronda + 1 });
      }
      // Cerrar la ronda no toca lo que ya se aprobó ni lo que está esperando
      // una decisión interna.
      if (pieza.estado === "final" || pieza.estado === "extra_pedida") {
        return si(pieza);
      }
      if (pieza.estado === "entregada" || pieza.estado === "en_revision") {
        // El cliente cerró sin decidir sobre esta pieza. Queda esperándolo:
        // el sistema no aprueba nada por su cuenta.
        return si(pieza);
      }
      return no("La pieza no forma parte de una revisión abierta.");

    case "reabrir":
      if (pieza.estado !== "final") {
        return no("Solo se reabre una pieza aprobada.");
      }
      // Vuelve a manos del cliente, que va a tener que aprobarla de nuevo.
      return si({ ...pieza, estado: "entregada" });

    // **Nunca cae acá con un `Evento` de verdad**: el `switch` los cubre a
    // todos y el tipo lo garantiza. Está por lo que llega cuando el tipo
    // miente —un evento armado a mano con un `tipo` que no es ninguno de
    // estos—. Sin este caso, la función devolvía `undefined` en silencio y
    // quien la llama reventaba al leer `resultado.ok`. Devolver un «no» es el
    // lado seguro del error.
    default:
      return no("Esa acción no existe.");
  }
}
