"use client";

// El tablero: tres canchas, y en cada una los clientes cerrados.
//
// **La columna la decide el trabajo, no el cliente.** Un trabajo aprobado va a
// «Terminado» aunque el mismo cliente tenga otro esperando: lo que se mira es
// el estado del trabajo, y mandarlo a otra columna porque su cliente tiene algo
// más urgente sería esconderlo donde nadie lo busca. Ningún trabajo está en dos
// columnas.
//
// El nombre del cliente sí puede aparecer en dos, como rótulo del grupo: quiere
// decir que tiene cosas de las dos clases.
//
// Y abriéndolo se ven **los trabajos por su nombre**, cada uno con su propio
// estado. Así se sabe que hay dos, cuáles son, y en qué anda cada uno sin
// tener que ir a otra pantalla.
//
// Tres formas de mirar, de menos a más:
//
//   · **Cerrado**: el cliente y cuántos trabajos tiene.
//   · **Abierto**: los nombres, con el estado de cada uno.
//   · **Tocando uno**: el resumen entero, con sus piezas.
//
// El orden de las columnas es el de la urgencia: primero lo nuestro, que es lo
// único sobre lo que se puede hacer algo ahora.

import { useState } from "react";
import { Plegable } from "@/admin/Plegable";
import { ResumenDeTrabajo } from "@/admin/ResumenDeTrabajo";
import {
  FiltrosDelTablero,
  filtrar,
  hayFiltros,
  SIN_FILTROS,
  type Filtros,
} from "@/admin/FiltrosDelTablero";
import type { Cancha, CarpetaEnElTablero } from "@/admin/datos/tablero";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

const CANCHAS: Record<
  Cancha,
  { titulo: string; explica: string; filo: string; punto: string; comoEsta: string }
> = {
  sin_entregar: {
    titulo: "Sin entregar",
    explica: "Ya está hecho y el cliente todavía no lo vio.",
    filo: "border-alerta",
    punto: "bg-alerta",
    comoEsta: "Sin entregar",
  },
  agencia: {
    titulo: "Lo tenemos nosotros",
    explica: "El cliente ya habló. Falta hacerlo.",
    filo: "border-acento",
    punto: "bg-acento",
    comoEsta: "Falta hacerlo",
  },
  cliente: {
    titulo: "Lo tiene el cliente",
    explica: "Se lo entregamos y todavía no decidió.",
    filo: "border-espera-borde",
    punto: "bg-espera-borde",
    comoEsta: "Esperando al cliente",
  },
  listo: {
    // **Aprobado, no «terminado».** Es la palabra que usan, y además es más
    // exacta: lo que pasó es que el cliente dijo que sí. «Terminado» suena a
    // que la agencia lo dio por cerrado, que es otra cosa y la decide otro.
    titulo: "Aprobado",
    explica: "El cliente ya dijo que sí. No espera nada de nadie.",
    filo: "border-linea",
    punto: "bg-tinta-suave",
    comoEsta: "Aprobado",
  },
};

/**
 * De más urgente a menos.
 *
 * Primero lo que se resuelve en un clic —está hecho y falta mandarlo—, después
 * lo que hay que hacer, después lo que espera al cliente, y al final lo
 * cerrado. Es el orden en que conviene gastar la mañana.
 */
const ORDEN: Cancha[] = ["sin_entregar", "agencia", "cliente", "listo"];

type PorCliente = {
  clienteId: string;
  cliente: string;
  carpetas: CarpetaEnElTablero[];
};

/**
 * Agrupa por cliente **adentro de una columna**.
 *
 * **La columna la decide el trabajo, no el cliente.** Un trabajo aprobado va a
 * «Terminado» aunque el mismo cliente tenga otro esperando: lo que se está
 * mirando es el estado del trabajo, y mandarlo a otra columna porque su cliente
 * tiene algo más urgente sería esconderlo donde nadie lo busca.
 *
 * El nombre del cliente puede aparecer en dos columnas, y eso no es lo mismo
 * que un trabajo repetido: **ningún trabajo está dos veces**. El nombre es el
 * rótulo del grupo, y decir «Café Otoño» en dos columnas es decir que tiene
 * cosas de las dos clases.
 */
function porCliente(carpetas: CarpetaEnElTablero[]): PorCliente[] {
  const salida: PorCliente[] = [];
  for (const carpeta of carpetas) {
    const suyo = salida.find((c) => c.clienteId === carpeta.clienteId);
    if (suyo) suyo.carpetas.push(carpeta);
    else
      salida.push({
        clienteId: carpeta.clienteId,
        cliente: carpeta.cliente,
        carpetas: [carpeta],
      });
  }
  return salida;
}

export function TableroPorCliente({ carpetas }: { carpetas: CarpetaEnElTablero[] }) {
  // Cuál se está mirando en grande. Vive acá arriba y no en cada ficha: la
  // ventana tapa la pantalla entera, así que solo puede haber una.
  const [mirando, setMirando] = useState<CarpetaEnElTablero | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);

  const aLaVista = filtrar(carpetas, filtros);

  return (
    <>
      {/*
        **El tablero se dibuja aunque no haya nada.** Antes, sin un solo
        trabajo, la pantalla entera se reemplazaba por un cartel: se iban las
        cuatro columnas, los filtros y cualquier idea de dónde estaba uno
        parado. Un tablero vacío sigue siendo el tablero —cuatro canchas que
        dicen «nada por acá»— y eso es una pantalla que se entiende; el cartel
        solo era un error que no lo era.
      */}
      {carpetas.length === 0 && (
        <p className="mt-6 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-normal text-espera">
          Todavía no hay trabajos. Aparecen solos cuando subís archivos a una
          carpeta adentro de la carpeta de un cliente, en Drive.
        </p>
      )}

      <FiltrosDelTablero
        carpetas={carpetas}
        filtros={filtros}
        onCambiar={setFiltros}
        cuantos={aLaVista.length}
      />

      {hayFiltros(filtros) && aLaVista.length === 0 ? (
        <p className="mt-8 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-normal text-espera">
          Ningún trabajo pasa ese filtro.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ORDEN.map((cual) => (
            <Columna
              key={cual}
              cual={cual}
              clientes={porCliente(aLaVista.filter((c) => c.cancha === cual))}
              hayVentana={mirando !== null}
              onMirar={setMirando}
            />
          ))}
        </div>
      )}

      {mirando && (
        <ResumenDeTrabajo carpeta={mirando} onCerrar={() => setMirando(null)} />
      )}
    </>
  );
}

function Columna({
  cual,
  clientes,
  hayVentana,
  onMirar,
}: {
  cual: Cancha;
  clientes: PorCliente[];
  hayVentana: boolean;
  onMirar: (c: CarpetaEnElTablero) => void;
}) {
  const { titulo, explica, filo } = CANCHAS[cual];
  const trabajos = clientes.reduce((n, c) => n + c.carpetas.length, 0);

  return (
    // `min-w-0` para que un nombre largo no ensanche la columna y saque la
    // página de ancho. Ya pasó en el portal.
    <section className={`min-w-0 border-t-4 pt-4 ${filo}`}>
      {/*
        **El número cuenta trabajos, no clientes.** Contaba clientes, y era la
        clase de dato que parece información y engaña: «Lo tiene el cliente: 1»
        con tres trabajos adentro de ese cliente. Lo que se pregunta mirando
        una columna es cuánto hay ahí, y cuánto hay son trabajos.
      */}
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-guia font-extrabold tracking-tight">{titulo}</h2>
        <span className="cifras text-titulo font-extrabold leading-none tracking-tighter text-apagado">
          {trabajos}
        </span>
      </div>
      <p className="mt-0.5 text-micro text-apagado">{explica}</p>

      {clientes.length === 0 ? (
        <p className="mt-4 text-menudo text-apagado">Nada por acá.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {clientes.map((c) => (
            <li
              key={c.clienteId}
              className={`border border-linea border-l-4 bg-lienzo px-3 py-2 ${filo}`}
            >
              <Plegable
                // **Sin recuerdo, a propósito.** En Admin conviene que una
                // sección quede abierta: se entra a hacer una cosa puntual.
                // Acá no: el tablero se mira para ver cómo viene todo, y
                // heredar lo que quedó abierto hace tres días lo devuelve al
                // párrafo del que se lo sacó. Siempre arranca cerrado.
                titulo={<span className="text-normal">{c.cliente}</span>}
                resumen={<Senales cliente={c} />}
              >
                <ul className="mt-2 flex flex-col">
                  {c.carpetas.map((carpeta) => (
                    <Trabajo
                      key={carpeta.carpetaId}
                      carpeta={carpeta}
                      hayVentana={hayVentana}
                      onMirar={onMirar}
                    />
                  ))}
                </ul>
              </Plegable>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Lo que se ve de un cliente **sin abrirlo**.
 *
 * Es el punto del tablero. Cerrado decía «1 trabajo» y nada más, así que para
 * saber si había algo que atender había que abrir cliente por cliente —o sea,
 * volver a la lista larga que el tablero vino a reemplazar—.
 *
 * Se dicen tres cosas y no más, y son las tres que hacen que alguien se
 * levante de la silla: **algo vencido**, **algo sin entregar** y **mensajes
 * sin leer**. El resto —cuántas piezas, quién lo lleva, cuándo vence— aparece
 * al abrir, que es cuando importa.
 */
function Senales({ cliente }: { cliente: PorCliente }) {
  const cuantos = cliente.carpetas.length;
  const vencidos = cliente.carpetas.filter((c) => c.vencida).length;
  const sinEntregar = cliente.carpetas.reduce((n, c) => n + c.sinEntregar, 0);
  // Los mensajes sin leer son del cliente, no de cada carpeta: el mismo número
  // viene repetido en todas. Sumarlos sería contarlos una vez por trabajo.
  const sinLeer = cliente.carpetas[0]?.sinLeer ?? 0;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>
        {cuantos} {cuantos === 1 ? "trabajo" : "trabajos"}
      </span>
      {vencidos > 0 && (
        <Senal tono="alerta">
          {vencidos === 1 ? "vencido" : `${vencidos} vencidos`}
        </Senal>
      )}
      {sinEntregar > 0 && <Senal tono="acento">{sinEntregar} sin entregar</Senal>}
      {/* Dice «mensajes» y no «sin leer» porque arriba, en el encabezado del
          tablero, «sin leer» son las notificaciones. Dos cosas distintas con
          el mismo nombre en la misma pantalla se leen como una sola. */}
      {sinLeer > 0 && (
        <Senal tono="acento">
          {sinLeer} {sinLeer === 1 ? "mensaje" : "mensajes"}
        </Senal>
      )}
    </span>
  );
}

function Senal({ tono, children }: { tono: "alerta" | "acento"; children: React.ReactNode }) {
  return (
    <span
      className={`px-1.5 py-0.5 text-micro font-extrabold uppercase tracking-wider ${
        tono === "alerta" ? "bg-alerta-tenue text-alerta" : "bg-acento-tenue text-acento"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Un trabajo: el nombre, y el resto al pasar por encima.
 *
 * El renglón dice lo mínimo —cómo se llama y de quién es la pelota— y el
 * detalle aparece al apoyar el mouse o al llegar con el teclado. Meterlo todo
 * en el renglón vuelve la columna un párrafo; esconderlo del todo obliga a
 * abrir una ventana para saber si vale la pena abrirla.
 *
 * El toque abre el resumen entero. En un teléfono no hay «pasar por encima»,
 * así que ese es el único camino y tiene que llevar a todo.
 */
function Trabajo({
  carpeta: c,
  hayVentana,
  onMirar,
}: {
  carpeta: CarpetaEnElTablero;
  /** Si hay una ventana abierta encima, de este trabajo o de cualquier otro. */
  hayVentana: boolean;
  onMirar: (c: CarpetaEnElTablero) => void;
}) {
  const cancha = CANCHAS[c.cancha];
  const cerradas = Math.max(0, c.piezas - c.enAgencia - c.sinRevisar);
  const unaPieza = c.enJuego === 1;

  // **Este renglón abrió la ventana.** Mientras siga siendo cierto, la vista
  // rápida no se muestra por el foco: al cerrar la ventana el foco vuelve acá
  // —tiene que volver, es lo correcto para quien usa teclado— y sin esto la
  // vista quedaba abierta encima del renglón de abajo, que era justo el que se
  // estaba mirando. Se apaga solo cuando el foco se va a otro lado.
  const [abrioLaVentana, setAbrioLaVentana] = useState(false);

  return (
    <li className="group relative border-t border-linea-tenue">
      <button
        type="button"
        onClick={() => {
          setAbrioLaVentana(true);
          onMirar(c);
        }}
        // El foco se va dos veces: primero a la ventana que se acaba de abrir
        // —y ahí hay que seguir callado— y después, cuando alguien sigue
        // recorriendo la pantalla. La segunda es la que apaga la marca.
        onBlur={() => {
          if (!hayVentana) setAbrioLaVentana(false);
        }}
        className="peer flex w-full items-center gap-2 py-2 text-left transition-colors
                   hover:text-acento focus-visible:outline-2 focus-visible:outline-acento"
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${cancha.punto}`}
        />
        <span className="min-w-0 flex-1 truncate font-bold tracking-tight">
          {c.carpeta}
        </span>
        {/* **La fecha va en el renglón y no solo al apoyar el mouse.** Es lo
            primero que se pregunta de un trabajo abierto, y en un teléfono no
            hay dónde apoyar nada. */}
        {c.vence && (
          <span
            className={`cifras shrink-0 text-micro ${
              c.vencida ? "font-extrabold text-alerta" : "text-apagado"
            }`}
          >
            {c.vencida ? "venció " : ""}
            {fecha.format(c.vence)}
          </span>
        )}
      </button>

      {/*
        La vista rápida. Aparece al apoyar el mouse o al llegar con el teclado,
        y no se puede tocar: es para mirar, no para usar. Por eso
        `pointer-events-none`, que además evita que tape el renglón de abajo.

        **`focus-visible` y no `focus-within`.** Con `focus-within` la vista
        quedaba trabada: al tocar un trabajo se abre la ventana, y al cerrarla
        el foco vuelve al botón —tiene que volver, es lo correcto para quien
        usa teclado—, así que el botón seguía con foco y la vista seguía
        abierta aunque el mouse estuviera tres renglones más abajo, tapando la
        del renglón que sí se estaba mirando.

        `focus-visible` es exactamente la diferencia que hace falta: el
        navegador lo enciende cuando se llegó con el teclado y no cuando se
        llegó con el mouse. Quien tabula sigue viendo la vista rápida; quien
        hace clic ve la ventana, que dice todo eso y más.

        Y va como `peer-` del botón, no como `group-` del renglón: `group-`
        pregunta si **el renglón** tiene el foco, y un renglón no puede
        tenerlo, así que no se encendía nunca. `peer-` pregunta por el botón,
        que es el que lo tiene y el hermano de acá al lado.

        `focus-visible` solo no alcanzaba: si se abre con el mouse y se cierra
        con Escape, el navegador considera —con razón— que ahora se está
        usando el teclado, y la vista volvía a quedarse. Por eso además está
        `abrioLaVentana`, que es la pregunta que de verdad importa: ¿este
        renglón acaba de mandar a alguien a la ventana grande? Entonces no
        tiene nada nuevo que mostrar.
      */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-4 right-0 top-full z-20 hidden
                    border-2 border-tinta bg-lienzo px-3 py-2 shadow-lg
                    group-hover:block ${abrioLaVentana ? "" : "peer-focus-visible:block"}`}
      >
        <p className="flex flex-wrap items-baseline gap-x-2 text-micro">
          <span className="font-extrabold uppercase tracking-widest text-apagado">
            {cancha.comoEsta}
          </span>
          <span className="text-apagado">
            {c.asignadaA ?? "sin asignar"}
            {c.vence && (
              <span className={c.vencida ? "font-extrabold text-alerta" : ""}>
                {" · "}
                {c.vencida ? "venció el" : "vence el"} {fecha.format(c.vence)}
              </span>
            )}
          </span>
        </p>

        {c.piezas > 0 && (
          <div className="mt-1.5 flex h-1.5 overflow-hidden bg-hueco">
            {c.enAgencia > 0 && (
              <span
                className="bg-acento"
                style={{ width: `${(c.enAgencia / c.piezas) * 100}%` }}
              />
            )}
            {c.sinRevisar > 0 && (
              <span
                className="bg-espera-borde"
                style={{ width: `${(c.sinRevisar / c.piezas) * 100}%` }}
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

        {/*
          **Lo que se cuenta es lo que está en juego.** Una pieza aprobada ya
          no es trabajo de nadie: sumarla acá hacía que un trabajo con una sola
          cosa pendiente dijera «2 piezas», y que lo terminado siguiera pesando
          en la columna del que todavía espera. Las terminadas se dicen aparte
          y en voz baja, que es lo que son: algo que ya pasó.
        */}
        <p className="mt-1.5 text-micro text-apagado">
          {c.enJuego === 0 ? (
            c.piezas === 0 ? (
              "Sin piezas"
            ) : (
              `Todo aprobado · ${c.piezas} ${c.piezas === 1 ? "pieza" : "piezas"}`
            )
          ) : (
            <>
              {c.enJuego} {unaPieza ? "pieza" : "piezas"} en juego
              {c.sinEntregar > 0 && (
                <span className="font-bold text-acento">
                  {" · "}
                  {c.sinEntregar} sin entregar
                </span>
              )}
              {c.sinRevisar > 0 && ` · ${c.sinRevisar} sin revisar`}
              {c.terminadas > 0 &&
                ` · ${c.terminadas} aprobada${c.terminadas === 1 ? "" : "s"}`}
            </>
          )}
          {c.sinLeer > 0 && (
            <span className="font-bold text-acento"> · {c.sinLeer} sin leer</span>
          )}
        </p>
      </div>
    </li>
  );
}
