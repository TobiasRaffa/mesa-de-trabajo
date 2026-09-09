// El camino que hizo una pieza: Boceto, y las rondas que efectivamente hubo.
//
// No enumera las rondas que todavía no pasaron. Mostrar «Boceto · Ronda 1 ·
// Ronda 2 · Final» desde el principio da a entender que va a haber cambios, y
// muchas veces al cliente le gusta el boceto y se termina ahí. El camino se
// dibuja a medida que se recorre.
//
// Es información, no reproche. Por eso va en chico y sin color fuerte.

type Props = {
  ronda: number;
  rondasIncluidas: number;
  rondasExtra: number;
  aprobada: boolean;
};

export function Seguimiento({ ronda, rondasIncluidas, rondasExtra, aprobada }: Props) {
  const disponibles = rondasIncluidas + rondasExtra;

  const recorrido = [
    "Boceto",
    ...Array.from({ length: ronda }, (_, i) =>
      // Las habilitadas por encima de las incluidas se llaman distinto: el
      // cliente ve que fue algo adicional sin que diga la palabra factura.
      i < rondasIncluidas ? `Ronda ${i + 1}` : "Revisión adicional"
    ),
  ];

  const quedan = disponibles - ronda;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-micro text-apagado">
      <ol className="flex flex-wrap items-baseline gap-x-1.5">
        {recorrido.map((paso, i) => {
          const aca = !aprobada && i === recorrido.length - 1;
          return (
            <li key={paso} className="flex items-baseline gap-1.5">
              {i > 0 && <span aria-hidden="true">·</span>}
              <span
                className={aca ? "font-semibold text-tinta" : ""}
                aria-current={aca ? "step" : undefined}
              >
                {paso}
              </span>
            </li>
          );
        })}
        <li className="flex items-baseline gap-1.5">
          <span aria-hidden="true">·</span>
          <span className={aprobada ? "font-semibold text-listo" : "text-linea"}>
            Final
          </span>
        </li>
      </ol>

      {/* Solo cuando queda poco margen: antes de eso es un dato que no le
          sirve a nadie, y decirlo suena a advertencia. */}
      {!aprobada && quedan <= 1 && (
        <span className="text-espera">
          {quedan === 1 ? "última ronda incluida" : "sin rondas incluidas"}
        </span>
      )}
    </div>
  );
}
