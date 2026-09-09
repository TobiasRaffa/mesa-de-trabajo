// El camino que hizo una pieza: Boceto, las rondas que hubo, y Final.
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
  /** En listas y calendarios alcanza con el paso actual. */
  compacto?: boolean;
};

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
        className={`inline-flex items-center px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider ${
          aprobada ? "bg-acento text-white" : "bg-hueco text-tinta-suave"
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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {anteriores.map((paso) => (
        <span key={paso} className="flex items-center gap-2">
          <span className="text-menudo font-semibold text-apagado">{paso}</span>
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
