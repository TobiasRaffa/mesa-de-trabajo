// El corazón del producto: cómo se mueve una pieza entre estados.
//
// Está acá, separado de todo lo demás, porque es la única parte que no puede
// estar mal. Las pantallas se rediseñan, la base de datos se cambia, pero si
// estas reglas fallan el portal miente sobre en qué estado está un trabajo, y
// eso es exactamente lo que vino a arreglar.
//
// No sabe nada de Drive, ni de la base de datos, ni de React. Recibe una pieza
// y un evento, y devuelve la pieza nueva o el motivo por el que no se puede.

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
  }
}
