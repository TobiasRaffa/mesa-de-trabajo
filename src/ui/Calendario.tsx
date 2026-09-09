"use client";

// La entrega puesta en el tiempo.
//
// Dos modos: el mes entero, o semana por semana. El tercero que ofrece el
// portal —la lista— no vive acá: es la lista de siempre, y por eso el
// interruptor está afuera.
//
// **El mes cambia de forma según el ancho, y no es capricho.** En una
// computadora la grilla se lee de un vistazo. En un teléfono, siete columnas
// dejan celdas de cuarenta píxeles donde no entra ni la palabra «Boceto» — y
// el estado en palabras es justo lo que hace falta: un punto de color no dice
// nada. Así que en el teléfono el mes es una agenda vertical.

export type PiezaEnCalendario = {
  id: string;
  nombre: string;
  publicaEl: Date;
  miniatura: string;
  /** «Boceto», «Ronda 1», «Aprobada». En palabras, no en color. */
  paso: string;
  aprobada: boolean;
};

export type ModoCalendario = "mes" | "semana";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Props = {
  modo: ModoCalendario;
  /** Cualquier día del mes que se quiere mostrar. */
  mes: Date;
  piezas: PiezaEnCalendario[];
  onAbrir: (id: string) => void;
};

export function Calendario({ modo, mes, piezas, onAbrir }: Props) {
  const anio = mes.getFullYear();
  const numeroDeMes = mes.getMonth();
  const diasDelMes = new Date(anio, numeroDeMes + 1, 0).getDate();

  // getDay() cuenta desde el domingo; acá la semana arranca el lunes.
  const arranca = (new Date(anio, numeroDeMes, 1).getDay() + 6) % 7;

  const delMes = piezas.filter(
    (p) => p.publicaEl.getFullYear() === anio && p.publicaEl.getMonth() === numeroDeMes
  );
  const fuera = piezas.length - delMes.length;

  const porDia = new Map<number, PiezaEnCalendario[]>();
  for (const pieza of delMes) {
    const dia = pieza.publicaEl.getDate();
    porDia.set(dia, [...(porDia.get(dia) ?? []), pieza]);
  }

  const hoy = new Date();
  const esDeHoy = (dia: number) =>
    hoy.getFullYear() === anio && hoy.getMonth() === numeroDeMes && hoy.getDate() === dia;

  const nombreDelMes = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(mes);

  return (
    <section aria-label={`Calendario de ${nombreDelMes}`}>
      {modo === "mes" ? (
        <>
          <VistaAgenda porDia={porDia} esDeHoy={esDeHoy} onAbrir={onAbrir} />
          <VistaMes
            diasDelMes={diasDelMes}
            arranca={arranca}
            porDia={porDia}
            esDeHoy={esDeHoy}
            onAbrir={onAbrir}
          />
        </>
      ) : (
        <VistaSemanas
          diasDelMes={diasDelMes}
          arranca={arranca}
          porDia={porDia}
          esDeHoy={esDeHoy}
          onAbrir={onAbrir}
        />
      )}

      {fuera > 0 && (
        <p className="mt-4 border-l-4 border-espera-borde bg-espera-tenue px-4 py-2 text-menudo font-semibold text-espera">
          {fuera === 1
            ? "Hay una pieza que sale fuera de este mes."
            : `Hay ${fuera} piezas que salen fuera de este mes.`}{" "}
          Están en la vista de lista.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

type VistaProps = {
  porDia: Map<number, PiezaEnCalendario[]>;
  esDeHoy: (dia: number) => boolean;
  onAbrir: (id: string) => void;
};

/** Una celda de día con trabajo: bloque oscuro, miniatura y estado en palabras. */
function Celda({
  dia,
  piezas,
  hoy,
  onAbrir,
  alto = "h-14",
}: {
  dia: number;
  piezas: PiezaEnCalendario[];
  hoy: boolean;
  onAbrir: (id: string) => void;
  alto?: string;
}) {
  const [primera, ...resto] = piezas;

  return (
    <button
      type="button"
      onClick={() => onAbrir(primera.id)}
      aria-label={`${dia}: ${primera.nombre}, ${primera.paso}${
        resto.length ? ` y ${resto.length} más` : ""
      }`}
      className={`group flex flex-col gap-1.5 bg-tinta p-2 text-left transition-all duration-150
                  hover:z-10 hover:scale-[1.1] hover:shadow-xl ${hoy ? "outline-3 outline-acento" : ""}`}
    >
      <span className="flex items-baseline justify-between">
        <span className="text-menudo font-extrabold text-lienzo">{dia}</span>
        {resto.length > 0 && (
          <span className="text-micro font-bold text-lienzo/60">+{resto.length}</span>
        )}
      </span>

      <span className={`relative ${alto} w-full overflow-hidden bg-hueco`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={primera.miniatura}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>

      <span
        className={`truncate px-1.5 py-1 text-center text-micro font-extrabold uppercase tracking-wider ${
          primera.aprobada ? "bg-acento text-white" : "bg-lienzo/20 text-lienzo"
        }`}
      >
        {primera.paso}
      </span>
    </button>
  );
}

/** El mes entero, en computadora. */
function VistaMes({
  diasDelMes,
  arranca,
  porDia,
  esDeHoy,
  onAbrir,
}: VistaProps & { diasDelMes: number; arranca: number }) {
  return (
    <div className="hidden sm:block">
      <div className="grid grid-cols-7 gap-1.5">
        {DIAS.map((dia) => (
          <div
            key={dia}
            className="pb-1 text-micro font-extrabold uppercase tracking-widest text-apagado"
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
              <div key={dia} className="min-h-24 bg-lienzo/50 p-2">
                <span
                  className={`text-menudo font-bold ${
                    esDeHoy(dia) ? "text-acento" : "text-linea"
                  }`}
                >
                  {dia}
                </span>
              </div>
            );
          }

          return (
            <Celda
              key={dia}
              dia={dia}
              piezas={delDia}
              hoy={esDeHoy(dia)}
              onAbrir={onAbrir}
            />
          );
        })}
      </div>
    </div>
  );
}

/** El mes en un teléfono: los días con trabajo, uno abajo del otro. */
function VistaAgenda({ porDia, esDeHoy, onAbrir }: VistaProps) {
  const dias = [...porDia.entries()].sort(([a], [b]) => a - b);

  return (
    <ol className="flex flex-col gap-2 sm:hidden">
      {dias.map(([dia, delDia]) =>
        delDia.map((pieza) => (
          <li key={pieza.id}>
            <button
              type="button"
              onClick={() => onAbrir(pieza.id)}
              className="flex w-full items-center gap-3 border border-linea bg-lienzo p-2.5 text-left
                         transition-colors hover:border-tinta"
            >
              <span
                className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center ${
                  esDeHoy(dia) ? "bg-acento text-white" : "bg-tinta text-lienzo"
                }`}
              >
                <span className="text-guia font-extrabold leading-none">{dia}</span>
                <span className="mt-1 text-micro font-bold uppercase leading-none opacity-70">
                  {DIAS[(pieza.publicaEl.getDay() + 6) % 7]}
                </span>
              </span>

              <span className="relative h-14 w-14 shrink-0 overflow-hidden bg-hueco">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pieza.miniatura}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{pieza.nombre}</span>
                <span
                  className={`mt-1 inline-flex px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider ${
                    pieza.aprobada ? "bg-acento text-white" : "bg-hueco text-tinta-suave"
                  }`}
                >
                  {pieza.paso}
                </span>
              </span>
            </button>
          </li>
        ))
      )}
    </ol>
  );
}

/** Semana por semana, con las piezas más grandes. */
function VistaSemanas({
  diasDelMes,
  arranca,
  porDia,
  esDeHoy,
  onAbrir,
}: VistaProps & { diasDelMes: number; arranca: number }) {
  // Cada semana arranca un lunes. La primera puede empezar antes del día 1.
  const semanas: Array<{ desde: number; hasta: number }> = [];
  for (let inicio = 1 - arranca; inicio <= diasDelMes; inicio += 7) {
    semanas.push({ desde: Math.max(1, inicio), hasta: Math.min(diasDelMes, inicio + 6) });
  }

  return (
    <div className="flex flex-col gap-5">
      {semanas.map(({ desde, hasta }, i) => {
        const dias = [];
        for (let d = desde; d <= hasta; d++) {
          const delDia = porDia.get(d);
          if (delDia?.length) dias.push({ dia: d, piezas: delDia });
        }

        return (
          <div key={desde} className="flex flex-col gap-3 sm:flex-row sm:gap-5">
            <div className="shrink-0 border-tinta sm:w-28 sm:border-r-2 sm:pr-4">
              <div className="text-micro font-extrabold uppercase tracking-widest text-apagado">
                Semana {i + 1}
              </div>
              <div className="text-titulo font-extrabold tracking-tight">
                {desde} — {hasta}
              </div>
            </div>

            {dias.length === 0 ? (
              <div className="flex flex-1 items-center border border-dashed border-linea px-4 py-6 text-menudo font-semibold text-apagado">
                Sin piezas esta semana
              </div>
            ) : (
              <div className="flex flex-1 flex-wrap gap-3">
                {dias.map(({ dia, piezas }) => (
                  <div key={dia} className="w-36">
                    <Celda
                      dia={dia}
                      piezas={piezas}
                      hoy={esDeHoy(dia)}
                      onAbrir={onAbrir}
                      alto="h-24"
                    />
                    <p className="mt-1.5 truncate text-menudo font-bold">
                      {piezas[0].nombre}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
