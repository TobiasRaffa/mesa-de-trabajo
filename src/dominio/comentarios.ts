// Los comentarios escritos encima del archivo, en Drive.
//
// **Pasa todo el tiempo y la aplicación no se enteraba.** El cliente abre el
// PDF, comenta en la hoja 7 señalando un pedazo del diseño, y eso vivía en
// Drive nada más: la mitad de la devolución de un lado, la mitad del otro, y
// la pantalla que dice «qué pidió el cliente» contando solo una mitad.
//
// Acá viven las tres decisiones que eso necesita, sin nada del servidor
// adentro: **de quién es** un comentario, **cómo se lee** convertido en pedido,
// y **con qué nombre** se guarda para no copiarlo dos veces.

/** Lo mínimo de un comentario de Drive para poder decidir sobre él. */
export type ComentarioParaDecidir = {
  id: string;
  /** El nombre para mostrar que da Google. Es lo único que siempre viene. */
  quien: string;
  /** Su dirección, si Google la da. Suele no darla. */
  correo?: string;
  texto: string;
  /** La hoja del PDF, si Drive la dice. */
  hoja?: number;
};

/**
 * Si lo escribió alguien del equipo.
 *
 * **Es la pregunta de la que depende todo lo demás.** Desde Drive, un
 * comentario del cliente y una nota que el diseñador se deja a sí mismo son
 * exactamente lo mismo: un nombre y un texto. Sin separarlos, esa nota entra a
 * la lista de cambios pedidos por el cliente, se le entrega, y cuenta como una
 * vuelta del presupuesto.
 *
 * Se compara contra lo que se sepa de cada persona —cómo aparece en Drive, su
 * nombre, su correo—, sin distinguir mayúsculas ni espacios de más, porque
 * nadie escribe dos veces igual.
 */
export function esDelEquipo(
  comentario: Pick<ComentarioParaDecidir, "quien" | "correo">,
  /** Cómo se llama cada persona del equipo: en Drive, en la app, su correo. */
  identidadesDelEquipo: string[]
): boolean {
  const suyas = [comentario.quien, comentario.correo].map(parejo).filter(Boolean);
  if (suyas.length === 0) return false;

  return identidadesDelEquipo
    .map(parejo)
    .filter(Boolean)
    .some((del) => suyas.includes(del));
}

const parejo = (x?: string) => (x ?? "").trim().toLowerCase();

/**
 * Cómo se lee un comentario de Drive convertido en pedido del cliente.
 *
 * **La hoja va adelante y no al final.** Un pedido de un PDF de veinte hojas
 * sin decir en cuál está manda a buscarlo a mano por todo el archivo, y esa
 * búsqueda es justo lo que este trabajo venía a sacar del medio. Adelante se
 * lee antes que el pedido, que es el orden en que hace falta.
 *
 * Si Drive no dice la hoja no se inventa ninguna: queda el texto solo.
 */
export function comoPedido(comentario: Pick<ComentarioParaDecidir, "texto" | "hoja">): string {
  const texto = comentario.texto.trim();
  return comentario.hoja === undefined ? texto : `Hoja ${comentario.hoja}: ${texto}`;
}

/**
 * Con qué nombre se guarda el pedido que salió de un comentario.
 *
 * Lleva de dónde vino adentro del nombre a propósito: es lo que deja mirar una
 * lista de cambios y saber cuáles se escribieron en el portal y cuáles encima
 * del archivo, sin guardar un campo aparte que alguien se olvide de completar.
 */
export const idDelComentario = (comentarioId: string) => `drive:${comentarioId}`;

/** Si este pedido salió de un comentario de Drive. */
export const vieneDeDrive = (idDelCambio: string) => idDelCambio.startsWith("drive:");

/**
 * De qué comentario de Drive salió un pedido.
 *
 * Es la vuelta de `idDelComentario`, y está acá al lado por eso: son las dos
 * mitades de la misma decisión. Sirve para seguirle el rastro al comentario
 * mientras la vuelta está abierta —si lo corrigen o lo borran en Drive, acá
 * pasa lo mismo—.
 */
export const idDeDrive = (idDelCambio: string) =>
  vieneDeDrive(idDelCambio) ? idDelCambio.slice("drive:".length) : idDelCambio;
