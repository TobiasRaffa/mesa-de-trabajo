// El camino de una pieza: Boceto, Ronda 1, Ronda 2, Final.
//
// Es información, no reproche. Por eso va en chico y sin color fuerte: dice
// dónde está el trabajo a quien lo busca, y no le grita nada a quien no.

type Props = {
  ronda: number;
  rondasIncluidas: number;
  rondasExtra: number;
  aprobada: boolean;
};

export function Seguimiento({ ronda, rondasIncluidas, rondasExtra, aprobada }: Props) {
  const total = rondasIncluidas + rondasExtra;

  const pasos = [
    { nombre: "Boceto", numero: 0 },
    ...Array.from({ length: total }, (_, i) => ({
      // Las que se habilitaron por encima de las incluidas se llaman distinto:
      // el cliente ve que fue algo adicional sin que diga la palabra factura.
      nombre: i < rondasIncluidas ? `Ronda ${i + 1}` : "Revisión adicional",
      numero: i + 1,
    })),
    { nombre: "Final", numero: total + 1 },
  ];

  const actual = aprobada ? total + 1 : ronda;

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-micro text-apagado">
      {pasos.map((paso, i) => {
        const hecho = paso.numero < actual;
        const aca = paso.numero === actual;

        return (
          <li key={paso.numero} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">·</span>}
            <span
              className={
                aca ? "font-semibold text-tinta" : hecho ? "text-apagado" : "text-linea"
              }
              aria-current={aca ? "step" : undefined}
            >
              {paso.nombre}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
