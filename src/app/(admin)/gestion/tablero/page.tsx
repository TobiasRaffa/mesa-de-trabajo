// Qué pasó, y qué está esperando.
//
// Es la primera pantalla del día. Reemplaza el «¿alguien sabe cómo viene lo de
// Café Otoño?» de los lunes: lo que hizo el cliente, dónde se pasó la fecha, y
// qué falta.

import Link from "next/link";
import { elTablero } from "@/admin/datos/tablero";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { Bandeja } from "@/admin/Bandeja";

export const dynamic = "force-dynamic";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

export default async function TableroPagina() {
  let tablero;
  try {
    tablero = await elTablero();
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  const vencidas = tablero.carpetas.filter((c) => c.vencida);
  const esperando = tablero.carpetas.filter((c) => c.esperandoRespuesta);
  const pendientes = tablero.carpetas.filter((c) => c.sinRevisar > 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <h1 className="text-grande font-extrabold tracking-tight">Qué pasó</h1>
        <p className="mt-2 text-normal text-tinta-suave">
          {tablero.sinVer === 0
            ? "Nada nuevo desde la última vez."
            : `${tablero.sinVer} ${
                tablero.sinVer === 1 ? "novedad" : "novedades"
              } desde la última vez.`}
        </p>
      </header>

      {/* Lo que hay que mirar hoy, si hay algo. */}
      {(vencidas.length > 0 || esperando.length > 0) && (
        <section className="mt-8 flex flex-col gap-3">
          {vencidas.map((c) => (
            <Alerta
              key={`v-${c.carpetaId}`}
              tono="alerta"
              titulo={`Se pasó la fecha de ${c.carpeta}`}
              detalle={`${c.cliente} · ${c.sinRevisar} sin revisar${
                c.asignadaA ? ` · lo lleva ${c.asignadaA}` : " · sin asignar"
              }`}
              href={`/gestion/cliente/${c.clienteId}`}
            />
          ))}
          {esperando.map((c) => (
            <Alerta
              key={`e-${c.carpetaId}`}
              tono="espera"
              titulo={`${c.cliente} escribió en ${c.carpeta}`}
              detalle="El último que habló fue el cliente."
              href="/gestion/chats"
            />
          ))}
        </section>
      )}

      <Bandeja avisos={tablero.avisos} correoConfigurado={tablero.correoConfigurado} />

      <section className="mt-12">
        <h2 className="text-titulo font-extrabold tracking-tight">Cómo viene cada trabajo</h2>

        {tablero.carpetas.length === 0 ? (
          <p className="mt-4 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-normal text-espera">
            No hay carpetas de trabajo en ningún cliente habilitado.
          </p>
        ) : (
          <ul className="mt-4 border-t border-linea">
            {tablero.carpetas.map((c) => (
              <li
                key={c.carpetaId}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-linea px-4 py-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-micro font-extrabold uppercase tracking-widest text-apagado">
                      {c.cliente}
                    </span>
                    <Link
                      href={`/gestion/cliente/${c.clienteId}/carpeta/${c.carpetaId}`}
                      className="text-guia font-bold tracking-tight underline-offset-4 hover:underline"
                    >
                      {c.carpeta}
                    </Link>
                  </div>
                  <p className="mt-1 text-menudo text-apagado">
                    {c.aprobadas} aprobadas · {c.conCambios} con cambios · {c.sinRevisar}{" "}
                    sin revisar
                    {c.vence && (
                      <span className={c.vencida ? "font-bold text-alerta" : ""}>
                        {" · "}
                        {c.vencida ? "venció el" : "vence el"} {fecha.format(c.vence)}
                      </span>
                    )}
                  </p>
                </div>

                <span
                  className={`shrink-0 px-2 py-1 text-micro font-extrabold uppercase tracking-wider ${
                    c.asignadaA ? "bg-hueco text-tinta-suave" : "bg-espera-tenue text-espera"
                  }`}
                >
                  {c.asignadaA ?? "sin asignar"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {pendientes.length === 0 && tablero.carpetas.length > 0 && (
          <p className="mt-4 bg-acento-tenue px-4 py-3 text-normal font-semibold text-acento">
            No queda nada esperando decisión del cliente.
          </p>
        )}
      </section>
    </main>
  );
}

function Alerta({
  tono,
  titulo,
  detalle,
  href,
}: {
  tono: "alerta" | "espera";
  titulo: string;
  detalle: string;
  href: string;
}) {
  const estilos =
    tono === "alerta"
      ? "border-alerta bg-alerta-tenue text-alerta"
      : "border-espera-borde bg-espera-tenue text-espera";

  return (
    <Link
      href={href}
      className={`block border-l-4 px-4 py-3 transition-opacity hover:opacity-80 ${estilos}`}
    >
      <p className="font-bold tracking-tight">{titulo}</p>
      <p className="mt-0.5 text-menudo opacity-80">{detalle}</p>
    </Link>
  );
}
