"use client";

// La entrega puesta en el mes.
//
// Doce posteos con fecha no se leen como una lista: se leen como un mes. La
// community manager los piensa así al armarlos y el cliente los mira así al
// aprobarlos, porque lo que quiere saber es qué sale cada día y si hay huecos.
//
// **Cambia de forma según el ancho, y no es capricho.** En una computadora la
// grilla del mes se lee de un vistazo. En un teléfono, siete columnas dejan
// celdas de cuarenta píxeles donde no entra ni la palabra «Boceto» — y el
// estado en palabras es justo lo que hace falta: un punto de color no dice
// nada. Así que en el teléfono es una agenda: los días con trabajo, uno abajo
// del otro, con lugar para decir las cosas por su nombre.

export type PiezaEnCalendario = {
  id: string;
  nombre: string;
  publicaEl: Date;
  miniatura: string;
  /** «Boceto», «Ronda 1», «Aprobada». En palabras, no en color. */
  paso: string;
  aprobada: boolean;
};

// La semana argentina empieza el lunes.
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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

  const delMes = piezas.filter(
    (p) => p.publicaEl.getFullYear() === anio && p.publicaEl.getMonth() === numeroDeMes
  );
  const fuera = piezas.length - delMes.length;

  const porDia = new Map<number, PiezaEnCalendario[]>();
  for (const pieza of delMes) {
    const dia = pieza.publicaEl.getDate();
    porDia.set(dia, [...(porDia.get(dia) ?? []), pieza]);
  }

  const nombreDelMes = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(mes);

  const hoy = new Date();
  const esDeHoy = (dia: number) =>
    hoy.getFullYear() === anio && hoy.getMonth() === numeroDeMes && hoy.getDate() === dia;

  return (
    <section aria-label={`Calendario de ${nombreDelMes}`}>
      <h2 className="text-guia font-semibold capitalize tracking-tight">{nombreDelMes}</h2>

      {/* ----------------------- Teléfono: agenda ----------------------- */}
      <ol className="mt-4 flex flex-col gap-2 sm:hidden">
        {[...porDia.entries()]
          .sort(([a], [b]) => a - b)
          .map(([dia, delDia]) =>
            delDia.map((pieza) => (
              <li key={pieza.id}>
                <button
                  type="button"
                  onClick={() => onAbrir(pieza.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-linea bg-lienzo p-2.5 text-left
                             transition-colors hover:border-apagado"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg ${
                      esDeHoy(dia) ? "bg-acento text-white" : "bg-hueco text-tinta-suave"
                    }`}
                  >
                    <span className="text-normal font-semibold leading-none">{dia}</span>
                    <span className="mt-0.5 text-micro leading-none opacity-80">
                      {DIAS[(pieza.publicaEl.getDay() + 6) % 7]}
                    </span>
                  </span>

                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-linea-tenue bg-hueco">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pieza.miniatura}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{pieza.nombre}</span>
                    <span
                      className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-micro font-semibold ${
                        pieza.aprobada ? "bg-listo-tenue text-listo" : "bg-hueco text-tinta-suave"
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

      {/* ------------------- Computadora: el mes entero ------------------ */}
      <div className="mt-4 hidden sm:block">
        <div className="grid grid-cols-7 gap-2">
          {DIAS.map((dia) => (
            <div
              key={dia}
              className="pb-1 text-center text-micro font-semibold uppercase tracking-wider text-apagado"
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
            const hoyEs = esDeHoy(dia);

            if (delDia.length === 0) {
              return (
                <div
                  key={dia}
                  className="min-h-24 rounded-lg border border-linea-tenue bg-lienzo/40 p-2"
                >
                  <span
                    className={`text-micro font-semibold ${
                      hoyEs ? "text-acento" : "text-apagado"
                    }`}
                  >
                    {dia}
                  </span>
                </div>
              );
            }

            const [primera, ...resto] = delDia;

            return (
              <button
                key={dia}
                type="button"
                onClick={() => onAbrir(primera.id)}
                aria-label={`${dia}: ${primera.nombre}, ${primera.paso}${
                  resto.length ? ` y ${resto.length} más` : ""
                }`}
                className="group relative flex min-h-24 flex-col overflow-hidden rounded-lg border border-linea bg-lienzo p-2 text-left
                           transition-all duration-150 hover:z-10 hover:scale-[1.12] hover:border-acento hover:shadow-lg"
              >
                <span className="flex items-center justify-between">
                  <span
                    className={`text-micro font-semibold ${hoyEs ? "text-acento" : "text-tinta"}`}
                  >
                    {dia}
                  </span>
                  {resto.length > 0 && (
                    <span className="text-micro text-apagado">+{resto.length}</span>
                  )}
                </span>

                <span className="relative mt-1.5 h-14 w-full overflow-hidden rounded-md bg-hueco">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={primera.miniatura}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </span>

                {/* El estado en palabras. Un punto de color no dice nada. */}
                <span
                  className={`mt-1.5 truncate rounded px-1.5 py-0.5 text-center text-micro font-semibold ${
                    primera.aprobada ? "bg-listo-tenue text-listo" : "bg-hueco text-tinta-suave"
                  }`}
                >
                  {primera.paso}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {fuera > 0 && (
        <p className="mt-4 text-menudo text-apagado">
          {fuera === 1
            ? "Hay una pieza que sale fuera de este mes."
            : `Hay ${fuera} piezas que salen fuera de este mes.`}{" "}
          Están en la lista de abajo.
        </p>
      )}
    </section>
  );
}
