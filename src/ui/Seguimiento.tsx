// El camino que hizo una pieza: Boceto, las rondas que hubo, y Final.
//
// Antes era una fila de puntitos con texto gris, y se leía como información de
// depuración. Ahora es lo que en realidad es: **una etiqueta que dice dónde
// está el trabajo**, con el paso actual marcado de verdad y los anteriores
// apenas presentes.
//
// No enumera las rondas que todavía no pasaron. Mostrar «Boceto · Ronda 1 ·
// Ronda 2 · Final» desde el principio da a entender que va a haber cambios, y
// muchas veces al cliente le gusta el boceto y se termina ahí. El camino se
// dibuja a medida que se recorre.

type Props = {
  ronda: number;
  rondasIncluidas: number;
  rondasExtra: number;
  aprobada: boolean;
  /** En el calendario y en las filas alcanza con el paso actual. */
  compacto?: boolean;
};

/** Cómo se llama el paso número `n`. El cero es el boceto. */
function nombreDelPaso(n: number, rondasIncluidas: number) {
  if (n === 0) return "Boceto";
  // Las rondas habilitadas por encima de las incluidas se llaman distinto: el
  // cliente ve que fue algo adicional sin que diga la palabra factura.
  return n <= rondasIncluidas ? `Ronda ${n}` : "Revisión adicional";
}

export function pasoActual(ronda: number, rondasIncluidas: number, aprobada: boolean) {
  return aprobada ? "Aprobada" : nombreDelPaso(ronda, rondasIncluidas);
}

export function Seguimiento({
  ronda,
  rondasIncluidas,
  rondasExtra,
  aprobada,
  compacto = false,
}: Props) {
  const quedan = rondasIncluidas + rondasExtra - ronda;
  const actual = pasoActual(ronda, rondasIncluidas, aprobada);

  if (compacto) {
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-micro font-semibold ${
          aprobada ? "bg-listo-tenue text-listo" : "bg-hueco text-tinta-suave"
        }`}
      >
        {actual}
      </span>
    );
  }

  const anteriores = Array.from({ length: ronda }, (_, i) =>
    nombreDelPaso(i, rondasIncluidas)
  );

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {anteriores.map((paso) => (
        <span key={paso} className="flex items-center gap-1.5">
          <span className="text-menudo text-apagado">{paso}</span>
          <span aria-hidden="true" className="text-linea">
            ›
          </span>
        </span>
      ))}

      <span
        className={`rounded-md px-2.5 py-1 text-menudo font-semibold ${
          aprobada ? "bg-listo-tenue text-listo" : "bg-acento-tenue text-acento"
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
          <span className="text-menudo text-linea">Final</span>
        </>
      )}

      {/* Solo cuando queda poco margen. Antes de eso es un dato que no le sirve
          a nadie, y decirlo suena a advertencia. */}
      {!aprobada && quedan <= 1 && (
        <span className="ml-1 rounded-md bg-espera-tenue px-2 py-0.5 text-micro font-semibold text-espera">
          {quedan === 1 ? "última incluida" : "sin rondas incluidas"}
        </span>
      )}
    </div>
  );
}
