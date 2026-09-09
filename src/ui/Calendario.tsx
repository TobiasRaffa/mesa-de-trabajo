"use client";

// La entrega puesta en el mes.
//
// Doce posteos con fecha no se leen como una lista: se leen como un mes. La
// community manager los piensa así al armarlos y el cliente los mira así al
// aprobarlos, porque lo que quiere saber es qué sale cada día y si hay algún
// hueco.
//
// La fecha viene cargada a mano al armar la entrega. Se descartó sacarla del
// nombre del archivo porque esa convención se rompe la primera vez que alguien
// nombra un archivo distinto, y la rotura sería silenciosa: la pieza no
// aparecería y nadie sabría por qué.

export type PiezaEnCalendario = {
  id: string;
  nombre: string;
  publicaEl: Date;
  miniatura: string;
  /** El mismo lenguaje de color que las etiquetas de estado. */
  tono: "espera" | "listo" | "mirando" | "quieto";
};

const PUNTOS: Record<PiezaEnCalendario["tono"], string> = {
  espera: "bg-espera",
  listo: "bg-listo",
  mirando: "bg-mirando",
  quieto: "bg-apagado",
};

// La semana argentina empieza el lunes.
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

type Props = {
  /** Cualquier día del mes que se quiere mostrar. */
  mes: Date;
  piezas: PiezaEnCalendario[];
  onAbrir: (id: string) => void;
};

export function Calendario({ mes, piezas, onAbrir }: Props) {
  const anio = mes.getFullYear();
  const numeroDeMes = mes.getMonth();

  const diasDelMes = new Date(anio, numeroDeMes + 1, 0).getDate();

  // getDay() cuenta desde el domingo; acá la semana arranca el lunes.
  const arranca = (new Date(anio, numeroDeMes, 1).getDay() + 6) % 7;

  const porDia = new Map<number, PiezaEnCalendario[]>();
  for (const pieza of piezas) {
    if (pieza.publicaEl.getFullYear() !== anio || pieza.publicaEl.getMonth() !== numeroDeMes) {
      continue;
    }
    const dia = pieza.publicaEl.getDate();
    porDia.set(dia, [...(porDia.get(dia) ?? []), pieza]);
  }

  // Las que quedaron fuera del mes que se está mirando. Es raro, pero pasa
  // cuando una grilla cruza de mes, y esconderlas sería peor que mostrarlas.
  const fueraDelMes = piezas.filter(
    (p) => p.publicaEl.getFullYear() !== anio || p.publicaEl.getMonth() !== numeroDeMes
  );

  const nombreDelMes = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(mes);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-guia font-semibold capitalize">{nombreDelMes}</h2>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {DIAS.map((dia, i) => (
          <div
            key={i}
            className="pb-1 text-center text-micro font-semibold uppercase text-apagado"
            aria-hidden="true"
          >
            {dia}
          </div>
        ))}

        {Array.from({ length: arranca }, (_, i) => (
          <div key={`vacio-${i}`} aria-hidden="true" />
        ))}

        {Array.from({ length: diasDelMes }, (_, i) => {
          const dia = i + 1;
          const delDia = porDia.get(dia) ?? [];

          if (delDia.length === 0) {
            return (
              <div
                key={dia}
                className="aspect-square rounded-md border border-linea-tenue p-1 text-micro text-apagado"
              >
                {dia}
              </div>
            );
          }

          // Con más de una pieza el mismo día se muestra la primera y se avisa
          // cuántas hay: apilarlas en una celda de cuarenta píxeles no se lee.
          const [primera, ...resto] = delDia;

          return (
            <button
              key={dia}
              type="button"
              onClick={() => onAbrir(primera.id)}
              aria-label={`${dia}: ${primera.nombre}${resto.length ? ` y ${resto.length} más` : ""}`}
              className="group relative aspect-square overflow-hidden rounded-md border border-linea bg-hueco
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={primera.miniatura}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {/* Un velo arriba para que el número se lea sobre cualquier
                  imagen, clara u oscura. */}
              <span className="absolute inset-x-0 top-0 bg-tinta/45 px-1 py-0.5 text-left text-micro font-semibold text-white">
                {dia}
              </span>
              <span
                className={`absolute bottom-1 right-1 h-2 w-2 rounded-full ring-2 ring-white ${PUNTOS[primera.tono]}`}
                aria-hidden="true"
              />
              {resto.length > 0 && (
                <span className="absolute bottom-0 left-0 bg-tinta/45 px-1 text-micro text-white">
                  +{resto.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {fueraDelMes.length > 0 && (
        <p className="text-menudo text-apagado">
          {fueraDelMes.length === 1
            ? "Hay una pieza que sale fuera de este mes."
            : `Hay ${fueraDelMes.length} piezas que salen fuera de este mes.`}{" "}
          Están en la lista de abajo.
        </p>
      )}
    </section>
  );
}
