// El tablero: cómo viene todo, de un vistazo.
//
// Es la primera pantalla del día, y reemplaza el «¿alguien sabe cómo viene lo
// de Café Otoño?» de los lunes.
//
// **Cerrado por cliente, y adentro por carpeta.** Estuvo un tiempo en tres
// columnas por cancha —lo nuestro, lo del cliente, lo terminado—, que contesta
// bien «qué tengo que mover yo» pero obliga a recorrer las tres para contestar
// «cómo viene Café Otoño». Cerrado por cliente contesta las dos: el renglón de
// cada uno dice cuánto hay de cada lado, y se abre solo el que interesa.
//
// Lo vencido va arriba de todo y fuera de los plegables: es lo único que hay
// que ver aunque no se abra nada.
//
// Las notificaciones se fueron a su propia sección. Eran dos cosas distintas
// peleando por la misma pantalla: una lista de lo que pasó, que se lee una vez
// y se archiva, y el estado de los trabajos, que se mira para decidir.

import Link from "next/link";
import { elTablero } from "@/admin/datos/tablero";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { TableroPorCliente } from "@/admin/TableroPorCliente";

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
  const paraHacer = tablero.carpetas.reduce((t, c) => t + c.enAgencia, 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-tinta pb-6">
        <h1 className="text-grande font-extrabold tracking-tight">Tablero</h1>
        <p className="text-menudo text-apagado">
          {tablero.carpetas.length}{" "}
          {tablero.carpetas.length === 1 ? "trabajo" : "trabajos"}
          {paraHacer > 0 && (
            <span className="font-bold text-acento"> · {paraHacer} para hacer</span>
          )}
          {tablero.sinVer > 0 && (
            <>
              {" · "}
              <Link
                href="/gestion/notificaciones"
                className="font-bold text-acento underline underline-offset-4"
              >
                {tablero.sinVer} sin leer
              </Link>
            </>
          )}
        </p>
      </header>

      {/* Lo vencido, arriba y afuera: es lo único que hay que ver aunque no se
          abra ningún cliente. */}
      {vencidas.length > 0 && (
        <section className="mt-6 border-l-4 border-alerta bg-alerta-tenue px-5 py-4">
          <h2 className="text-normal font-extrabold text-alerta">
            {vencidas.length === 1
              ? "Se pasó una fecha"
              : `Se pasaron ${vencidas.length} fechas`}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {vencidas.map((c) => (
              <li key={c.carpetaId} className="text-menudo font-semibold text-alerta">
                <Link
                  href={`/gestion/cliente/${c.clienteId}/carpeta/${c.carpetaId}`}
                  className="underline underline-offset-4"
                >
                  {c.cliente} · {c.carpeta}
                </Link>{" "}
                <span className="font-normal">
                  venció el {c.vence && fecha.format(c.vence)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TableroPorCliente carpetas={tablero.carpetas} />
    </main>
  );
}
