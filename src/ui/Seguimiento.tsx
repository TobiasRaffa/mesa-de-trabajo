// El camino que hizo una pieza: V1, las vueltas que hubo, y Final.
//
// **Se habla de versiones y no de rondas.** Decía «Boceto · Ronda 1 · Ronda 2»
// y en el estudio se habla de otra cosa: el archivo se llama «V2», el cliente
// pregunta por la V2, y la pantalla le contestaba «ronda 1». Dos nombres para
// la misma cosa, y uno solo estaba escrito en el archivo. Ahora la vuelta 0 es
// **V1** —el archivo sin marca— y cada ronda cerrada es la versión siguiente.
//
// No enumera las versiones que todavía no pasaron. Mostrar «V1 · V2 · V3 ·
// Final» desde el principio da a entender que va a haber cambios, y muchas
// veces al cliente le gusta la primera y se termina ahí. El camino se dibuja a
// medida que se recorre.
//
// **Y se dibuja con las versiones que existen, no con las rondas.** Cuando el
// cliente manda sus cambios la ronda avanza en el acto, pero la versión
// siguiente todavía no está hecha: el camino decía «V3» encima de un archivo
// que era la V2. La versión la marca el archivo, no la intención.
//
// **Con el número que dice el archivo, además.** Los pasos se numeraban de
// corrido —primero, segundo, tercero— y eso alcanzaba mientras nadie mirara
// los dos lados: el cliente veía «V4» sobre un archivo llamado
// «V5_stickers.jpeg», y al hablar por teléfono cada uno nombraba otra cosa.

type Props = {
  /**
   * Los números de vuelta que hay, en orden: `[1, 2, 4, 5]`.
   *
   * **Son los del nombre del archivo, no un conteo.** Antes acá venía cuántas
   * vueltas había y los pasos se numeraban de corrido, con dos consecuencias:
   * el cliente veía «V4» sobre un archivo llamado «V5_stickers.jpeg» —y al
   * hablar con la agencia cada uno nombraba otra cosa— y, peor, la cuenta de
   * archivos se usaba como si fueran rondas gastadas.
   *
   * Si el equipo salta un número, se ve el salto. Es información: el salto
   * está en Drive y lo arregla quien nombra los archivos.
   */
  vueltas: number[];
  /**
   * Cuántas vueltas **pidió** el cliente. De esto depende si le quedan.
   *
   * No sale de cuántos archivos hay: subir una versión es trabajo nuestro, no
   * una revisión que el cliente haya gastado.
   */
  ronda: number;
  rondasIncluidas: number;
  rondasExtra: number;
  aprobada: boolean;
  /** En listas y calendarios alcanza con el paso actual. */
  compacto?: boolean;
};

/**
 * Si la pieza está corriendo sobre una revisión que hubo que habilitar.
 *
 * **Sale de las rondas y no de cuántos archivos hay.** Antes se deducía del
 * número de versión —«si es la V4 y entraban dos vueltas, la última fue
 * adicional»—, y eso da falsos: una pieza que volvió a empezar conserva sus
 * archivos y aparecía como «adicional» sin que nadie hubiera pedido nada.
 */
const esAdicional = (ronda: number, rondasIncluidas: number) => ronda > rondasIncluidas;

/**
 * Cómo se nombra el paso en el que está la pieza.
 *
 * Las versiones que salieron de una revisión adicional se nombran igual —son
 * la V4, no otra cosa— pero se aclara de dónde salieron, para que el cliente
 * vea que fue algo aparte sin que diga la palabra factura.
 */
export function pasoActual(
  vueltas: number[],
  ronda: number,
  rondasIncluidas: number,
  aprobada: boolean
) {
  if (aprobada) return "Aprobada";
  const version = `V${vueltas[vueltas.length - 1] ?? 1}`;
  return esAdicional(ronda, rondasIncluidas) ? `${version} · adicional` : version;
}

export function Seguimiento({
  vueltas,
  ronda,
  rondasIncluidas,
  rondasExtra,
  aprobada,
  compacto = false,
}: Props) {
  const quedan = rondasIncluidas + rondasExtra - ronda;
  const actual = pasoActual(vueltas, ronda, rondasIncluidas, aprobada);

  if (compacto) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider ${
          aprobada ? "bg-acento text-white" : "bg-hueco text-tinta-suave"
        }`}
      >
        {actual}
      </span>
    );
  }

  // **Aprobada, la última versión no desaparece del camino.** El paso actual
  // pasa a decir «Aprobada», y con eso se perdía de vista *cuál* se aprobó:
  // «esto ya lo habíamos aprobado» sin poder decir qué, que es exactamente la
  // discusión que esta pantalla vino a cerrar.
  const anteriores = aprobada ? vueltas : vueltas.slice(0, -1);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {anteriores.map((numero) => (
        <span key={numero} className="flex items-center gap-2">
          <span className="text-menudo font-semibold text-apagado">V{numero}</span>
          <span aria-hidden="true" className="text-linea">
            ›
          </span>
        </span>
      ))}

      <span
        className={`px-2.5 py-1 text-menudo font-extrabold uppercase tracking-wider ${
          aprobada ? "bg-acento text-white" : "bg-tinta text-lienzo"
        }`}
        aria-current="step"
      >
        {actual}
      </span>

      {!aprobada && (
        <>
          <span aria-hidden="true" className="text-linea">
            ›
          </span>
          <span className="text-menudo font-semibold text-linea">Final</span>
        </>
      )}

      {/* Cuando ya no quedan rondas incluidas sí hay algo que decir, porque
          cambia lo que se puede hacer. Que sea la última no hace falta
          aclararlo: se lee del camino. */}
      {!aprobada && quedan <= 0 && (
        <span className="border-l-4 border-espera-borde bg-espera-tenue px-2 py-0.5 text-micro font-bold text-espera">
          sin rondas incluidas
        </span>
      )}
    </div>
  );
}
