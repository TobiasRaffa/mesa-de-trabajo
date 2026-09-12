// El tablero: cómo viene todo, de un vistazo.
//
// Es la primera pantalla del día, y reemplaza el «¿alguien sabe cómo viene lo
// de Café Otoño?» de los lunes.
//
// **Está armado por canchas y no por cliente.** La pregunta que se hace
// alguien mirando esto no es «qué hay de Café Otoño», es **«qué tengo que
// mover yo»**. Ordenado por cliente hay que leer carpeta por carpeta para
// separar lo que espera trabajo nuestro de lo que espera al cliente; en tres
// columnas, eso se ve sin leer.
//
// El orden de las columnas es el de la urgencia: primero lo nuestro —que es lo
// único sobre lo que se puede hacer algo ahora—, después lo que está en manos
// del cliente, y al final lo terminado, que está para saber que existe.
//
// Las notificaciones se fueron a su propia sección. Eran dos cosas distintas
// peleando por la misma pantalla: una lista de lo que pasó, que se lee una vez
// y se archiva, y el estado de los trabajos, que se mira para decidir.

import Link from "next/link";
import { elTablero, type CarpetaEnElTablero, type Cancha } from "@/admin/datos/tablero";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";

export const dynamic = "force-dynamic";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

/**
 * Cada cancha con su color y su explicación.
 *
 * El color dice de quién es el próximo movimiento y no «qué tan mal viene»:
 * que algo esté en la cancha del cliente no es un problema, es lo normal.
 * Por eso lo nuestro es el acento —donde hay que mirar— y lo del cliente es
 * neutro. El rojo queda reservado para lo que de verdad se pasó de fecha.
 */
const CANCHAS: Record<
  Cancha,
  { titulo: string; explica: string; filo: string; chip: string }
> = {
  agencia: {
    titulo: "Lo tenemos nosotros",
    explica: "El cliente ya habló. Falta hacerlo.",
    filo: "border-acento",
    chip: "bg-acento text-white",
  },
  cliente: {
    titulo: "Lo tiene el cliente",
    explica: "Se lo entregamos y todavía no decidió.",
    filo: "border-espera-borde",
    chip: "bg-espera-tenue text-espera",
  },
  listo: {
    titulo: "Terminado",
    explica: "No queda nada esperando de ningún lado.",
    filo: "border-linea",
    chip: "bg-hueco text-tinta-suave",
  },
};

const ORDEN: Cancha[] = ["agencia", "cliente", "listo"];

export default async function TableroPagina() {
  let tablero;
  try {
    tablero = await elTablero();
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  const porCancha = (cual: Cancha) => tablero.carpetas.filter((c) => c.cancha === cual);
  const vencidas = tablero.carpetas.filter((c) => c.vencida);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-tinta pb-6">
        <h1 className="text-grande font-extrabold tracking-tight">Tablero</h1>
        <p className="text-menudo text-apagado">
          {tablero.carpetas.length}{" "}
          {tablero.carpetas.length === 1 ? "trabajo" : "trabajos"} ·{" "}
          {porCancha("agencia").length} para hacer
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

      {/* Lo vencido va arriba de todo y fuera de las columnas: es lo único que
          hay que mirar aunque no se mire nada más. */}
      {vencidas.length > 0 && (
        <section className="mt-6 border-l-4 border-alerta bg-alerta-tenue px-5 py-4">
          <h2 className="text-normal font-extrabold text-alerta">
            {vencidas.length === 1 ? "Se pasó una fecha" : `Se pasaron ${vencidas.length} fechas`}
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

      {tablero.carpetas.length === 0 ? (
        <p className="mt-8 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-normal text-espera">
          No hay carpetas de trabajo en ningún cliente habilitado.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {ORDEN.map((cual) => (
            <Columna key={cual} cual={cual} carpetas={porCancha(cual)} />
          ))}
        </div>
      )}
    </main>
  );
}

function Columna({ cual, carpetas }: { cual: Cancha; carpetas: CarpetaEnElTablero[] }) {
  const { titulo, explica, filo } = CANCHAS[cual];

  return (
    // `min-w-0` para que un nombre largo no ensanche la columna y saque la
    // página de ancho. Ya pasó en el portal.
    <section className={`min-w-0 border-t-4 pt-4 ${filo}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-guia font-extrabold tracking-tight">{titulo}</h2>
        <span className="cifras text-titulo font-extrabold leading-none tracking-tighter text-apagado">
          {carpetas.length}
        </span>
      </div>
      <p className="mt-0.5 text-micro text-apagado">{explica}</p>

      {carpetas.length === 0 ? (
        <p className="mt-4 text-menudo text-apagado">Nada por acá.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {carpetas.map((c) => (
            <Ficha key={c.carpetaId} carpeta={c} cancha={cual} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Ficha({ carpeta: c, cancha }: { carpeta: CarpetaEnElTablero; cancha: Cancha }) {
  const { chip } = CANCHAS[cancha];

  // Cuántas piezas están de cada lado, para la barra. Lo terminado es el resto:
  // así los tres pedazos siempre suman el total y la barra no miente.
  const enAgencia = c.enAgencia;
  const enCliente = c.sinRevisar;
  const cerradas = Math.max(0, c.piezas - enAgencia - enCliente);

  return (
    <li className="border border-linea bg-lienzo p-4">
      <p className="text-micro font-extrabold uppercase tracking-widest text-apagado">
        {c.cliente}
      </p>
      <Link
        href={`/gestion/cliente/${c.clienteId}/carpeta/${c.carpetaId}`}
        className="mt-0.5 block text-guia font-bold leading-tight tracking-tight underline-offset-4 hover:underline"
      >
        {c.carpeta}
      </Link>

      {/* La barra dice de un vistazo cómo está repartido el trabajo. Los
          colores son los mismos de las columnas, así que no hay leyenda que
          aprender: el verde es nuestro, el ámbar del cliente, el gris cerrado. */}
      {c.piezas > 0 && (
        <div
          className="mt-3 flex h-2 overflow-hidden bg-hueco"
          role="img"
          aria-label={`${enAgencia} para hacer, ${enCliente} esperando al cliente, ${cerradas} cerradas`}
        >
          {enAgencia > 0 && (
            <span className="bg-acento" style={{ width: `${(enAgencia / c.piezas) * 100}%` }} />
          )}
          {enCliente > 0 && (
            <span
              className="bg-espera-borde"
              style={{ width: `${(enCliente / c.piezas) * 100}%` }}
            />
          )}
          {cerradas > 0 && (
            <span
              className="bg-tinta-suave"
              style={{ width: `${(cerradas / c.piezas) * 100}%` }}
            />
          )}
        </div>
      )}

      <p className="mt-2 text-menudo text-apagado">
        {c.piezas} {c.piezas === 1 ? "pieza" : "piezas"}
        {enAgencia > 0 && ` · ${enAgencia} para hacer`}
        {enCliente > 0 && ` · ${enCliente} sin revisar`}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider ${
            c.asignadaA ? chip : "bg-espera-tenue text-espera"
          }`}
        >
          {c.asignadaA ?? "sin asignar"}
        </span>

        {c.vence && (
          <span
            className={`text-micro ${c.vencida ? "font-extrabold text-alerta" : "text-apagado"}`}
          >
            {c.vencida ? "venció el" : "vence el"} {fecha.format(c.vence)}
          </span>
        )}

        {c.sinLeer > 0 && (
          <Link
            href="/gestion/chats"
            className="text-micro font-extrabold text-acento underline underline-offset-4"
          >
            {c.sinLeer} sin leer
          </Link>
        )}
      </div>
    </li>
  );
}
