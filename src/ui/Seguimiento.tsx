// El camino que hizo una pieza: Boceto, las rondas que efectivamente hubo, y
// Final.
//
// No enumera las rondas que todavía no pasaron. Mostrar «Boceto · Ronda 1 ·
// Ronda 2 · Final» desde el principio da a entender que va a haber cambios, y
// muchas veces al cliente le gusta el boceto y se termina ahí. El camino se
// dibuja a medida que se recorre.
//
// Tiene marcas y línea, y no solo texto gris: es de lo primero que se mira al
// abrir una pieza, y en una fila de palabras apagadas no se lee. Sigue siendo
// información y no reproche, pero información que se ve.

type Props = {
  ronda: number;
  rondasIncluidas: number;
  rondasExtra: number;
  aprobada: boolean;
};

export function Seguimiento({ ronda, rondasIncluidas, rondasExtra, aprobada }: Props) {
  const pasos = [
    "Boceto",
    ...Array.from({ length: ronda }, (_, i) =>
      // Las habilitadas por encima de las incluidas se llaman distinto: el
      // cliente ve que fue algo adicional sin que diga la palabra factura.
      i < rondasIncluidas ? `Ronda ${i + 1}` : "Revisión adicional"
    ),
    "Final",
  ];

  // Sin aprobar, el punto donde estamos es el último transitado; el «Final»
  // queda por delante.
  const actual = aprobada ? pasos.length - 1 : pasos.length - 2;
  const quedan = rondasIncluidas + rondasExtra - ronda;

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-wrap items-center gap-y-2">
        {pasos.map((paso, i) => {
          const hecho = i < actual;
          const aca = i === actual;

          return (
            <li key={paso} className="flex items-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`mx-2 h-px w-6 ${hecho || aca ? "bg-apagado" : "bg-linea"}`}
                />
              )}
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={
                    aca
                      ? `h-2.5 w-2.5 rounded-full ${aprobada ? "bg-listo" : "bg-acento"}`
                      : hecho
                        ? "h-2.5 w-2.5 rounded-full bg-apagado"
                        : "h-2.5 w-2.5 rounded-full border border-linea bg-lienzo"
                  }
                />
                <span
                  className={
                    aca
                      ? `text-menudo font-semibold ${aprobada ? "text-listo" : "text-tinta"}`
                      : hecho
                        ? "text-menudo text-tinta-suave"
                        : "text-menudo text-apagado"
                  }
                  aria-current={aca ? "step" : undefined}
                >
                  {paso}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {/* Solo cuando queda poco margen: antes de eso es un dato que no le
          sirve a nadie, y decirlo suena a advertencia. */}
      {!aprobada && quedan <= 1 && (
        <p className="text-menudo text-espera">
          {quedan === 1 ? "Es la última ronda incluida" : "Ya no quedan rondas incluidas"}
        </p>
      )}
    </div>
  );
}
