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
import { MensajesSinLeer } from "@/admin/MensajesSinLeer";
import { ResumenDeTrabajo } from "@/admin/ResumenDeTrabajo";
import {
  FiltrosDelTablero,
  filtrar,
  hayFiltros,
  SIN_FILTROS,
  type Filtros,
} from "@/admin/FiltrosDelTablero";
import type {
  Cancha,
  CarpetaEnElTablero,
  PiezaEnElTablero,
} from "@/admin/datos/tablero";
import { Estado } from "@/ui/Estado";
import { IconoFlecha } from "@/ui/Icono";
import type { Persona } from "@/lib/equipo";
import { Miniatura } from "@/ui/Miniatura";
import { tonoDeEspera, tonoDelNombre } from "@/ui/tonos";
import { masVieja, AVISA_DESDE, ALARMA_DESDE } from "@/dominio/espera";
import { urlDeMiniatura } from "@/lib/miniaturas";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

// **Solo el título.** Cada columna llevaba debajo una frase que la explicaba
// —«El cliente ya habló. Falta hacerlo.»— y se pidió sacarla: se lee una vez,
// y después es un renglón gris que empuja los trabajos para abajo.
const CANCHAS: Record<Cancha, { titulo: string; filo: string; punto: string; comoEsta: string }> =
  {
    sin_entregar: {
      titulo: "Sin entregar",
      filo: "border-alerta",
      punto: "bg-alerta",
      comoEsta: "Sin entregar",
    },
    agencia: {
      titulo: "A cargo nuestro",
      filo: "border-acento",
      punto: "bg-acento",
      comoEsta: "Falta hacerlo",
    },
    cliente: {
      titulo: "A cargo del cliente",
      filo: "border-espera-borde",
      punto: "bg-espera-borde",
      comoEsta: "Esperando al cliente",
    },
    listo: {
      // **Aprobado, no «terminado».** Es la palabra que usan, y además es más
      // exacta: lo que pasó es que el cliente dijo que sí. «Terminado» suena a
      // que la agencia lo dio por cerrado, que es otra cosa y la decide otro.
      titulo: "Aprobado",
      filo: "border-lima",
      punto: "bg-lima",
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

export function TableroPorCliente({
  carpetas,
  equipo,
}: {
  carpetas: CarpetaEnElTablero[];
  /** Para poder cambiar quién lleva un trabajo sin salir del tablero. */
  equipo: Persona[];
}) {
  // Cuál se está mirando en grande. Vive acá arriba y no en cada ficha: la
  // ventana tapa la pantalla entera, así que solo puede haber una.
  const [mirando, setMirando] = useState<{
    carpeta: CarpetaEnElTablero;
    /** Con cuál pieza abrir, cuando se tocó una y no la carpeta. */
    pieza?: string;
  } | null>(null);
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
              onMirar={(carpeta, pieza) => setMirando({ carpeta, pieza })}
            />
          ))}
        </div>
      )}

      {mirando && (
        <ResumenDeTrabajo
          carpeta={mirando.carpeta}
          soloPieza={mirando.pieza}
          equipo={equipo}
          onCerrar={() => setMirando(null)}
        />
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
  onMirar: (c: CarpetaEnElTablero, pieza?: string) => void;
}) {
  const { titulo, filo } = CANCHAS[cual];
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
        <h2 className="text-guia font-extrabold tracking-tight [font-stretch:100%]">{titulo}</h2>
        <span className="cifras text-titulo font-extrabold leading-none tracking-tighter text-apagado">
          {trabajos}
        </span>
      </div>
      {clientes.length === 0 ? (
        <p className="mt-4 text-menudo text-apagado">Nada por acá.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {clientes.map((c) => (
            <li
              key={c.clienteId}
              className={`rounded-campo border border-linea border-l-4 bg-lienzo px-3 py-2 ${filo}`}
            >
              <Plegable
                // **Sin recuerdo, a propósito.** En Admin conviene que una
                // sección quede abierta: se entra a hacer una cosa puntual.
                // Acá no: el tablero se mira para ver cómo viene todo, y
                // heredar lo que quedó abierto hace tres días lo devuelve al
                // párrafo del que se lo sacó. Siempre arranca cerrado.
                // **El nombre del cliente se pinta.** La señal de al lado
                // dice cuántos días, pero el tablero se barre con la vista y
                // lo que se barre es la columna de nombres: si el problema no
                // llega hasta ahí, hay que leer renglón por renglón para
                // encontrarlo.
                titulo={
                  <span className="inline-flex items-center gap-2">
                    <span className={`text-normal ${tonoDelNombre(esperaDelCliente(c))}`}>
                      {c.cliente}
                    </span>
                    {/* Los mensajes sin leer van pegados al nombre, a la
                        derecha: son del cliente, no de sus trabajos. Los
                        mensajes son del cliente entero, así que el mismo
                        número viene repetido en todas sus carpetas. */}
                    <MensajesSinLeer
                      cuantos={c.carpetas[0]?.sinLeer ?? 0}
                      clienteId={c.clienteId}
                    />
                  </span>
                }
                resumen={<Senales cliente={c} />}
                // **Cerrado de entrada, siempre.** Se abría solo con pocos
                // clientes en la columna, y se pidió que no: el tablero se
                // barre con la vista y las señales de al lado del nombre ya
                // dicen si vale la pena abrirlo. Abierto de entrada, cada
                // columna era una lista y el resumen no servía de nada.
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
  const porVencer = cliente.carpetas.filter((c) => c.porVencer).length;
  const sinEntregar = cliente.carpetas.reduce((n, c) => n + c.sinEntregar, 0);

  // **Lo más viejo que tiene este cliente de nuestro lado.** Cada carpeta ya
  // suma lo suyo y lo de sus subcarpetas; acá se junta el peor de todos. Sin
  // esto, un archivo parado hace cinco días se veía solo abriendo el cliente,
  // abriendo la carpeta y leyendo el renglón: tres pasos para enterarse de lo
  // único que hacía falta saber desde afuera.
  const masVieja = esperaDelCliente(cliente);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>
        {cuantos} {cuantos === 1 ? "trabajo" : "trabajos"}
      </span>
      {/* Desde los dos días avisa y desde los tres alarma, igual que adentro:
          un número que cambia de color según dónde se lo mire no es una
          señal, es una sorpresa. */}
      {masVieja !== null && masVieja >= AVISA_DESDE && (
        <Senal tono={masVieja >= ALARMA_DESDE ? "alerta" : "espera"}>
          {masVieja} {masVieja === 1 ? "día" : "días"} con nosotros
        </Senal>
      )}
      {vencidos > 0 && (
        <Senal tono="alerta">
          {vencidos === 1 ? "vencido" : `${vencidos} vencidos`}
        </Senal>
      )}
      {/* Naranja: todavía se llega, pero hay que moverse hoy. Rojo y naranja
          conviven —un cliente puede tener uno de cada—, así que no es un
          «si no». */}
      {porVencer > 0 && (
        <Senal tono="espera">
          {porVencer === 1 ? "por vencer" : `${porVencer} por vencer`}
        </Senal>
      )}
      {sinEntregar > 0 && <Senal tono="acento">{sinEntregar} sin entregar</Senal>}
    </span>
  );
}

/**
 * Hace cuánto que tenemos lo más viejo de este cliente.
 *
 * Cada carpeta ya suma lo suyo y lo de sus subcarpetas, así que acá alcanza
 * con quedarse con el peor. Vive suelta porque la usan dos: el nombre del
 * cliente, que se pinta, y sus señales, que lo cuentan. Escrita dos veces es
 * como un día el nombre queda rojo al lado de una señal que dice dos días.
 */
function esperaDelCliente(cliente: PorCliente): number | null {
  return masVieja(cliente.carpetas.map((c) => c.diasConNosotros));
}

const TONOS = {
  alerta: "bg-alerta-tenue text-alerta",
  espera: "bg-espera-tenue text-espera",
  acento: "bg-acento-tenue text-acento",
} as const;

function Senal({
  tono,
  children,
}: {
  tono: keyof typeof TONOS;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`px-1.5 py-0.5 text-micro font-extrabold uppercase tracking-wider ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}

/**
 * Un trabajo: el nombre, el reloj, y lo que tiene adentro si se lo abre.
 *
 * El renglón dice lo mínimo —cómo se llama, de quién es la pelota y hace
 * cuánto que está quieto— y el detalle aparece al apoyar el mouse o al llegar
 * con el teclado. Meterlo todo en el renglón vuelve la columna un párrafo;
 * esconderlo del todo obliga a abrir una ventana para saber si vale la pena
 * abrirla.
 *
 * **Y se abre acá mismo.** El número rojo de una carpeta suma lo que tiene
 * adentro, incluidas sus subcarpetas: sirve para avisar, pero deja a alguien
 * mirando «Banners: 5d» sin saber si son los cinco archivos o uno. La flecha
 * abre la carpeta en su lugar y muestra pieza por pieza —y carpeta por
 * carpeta— cuál está en rojo y cuál no. Antes eso obligaba a irse a la ficha
 * del cliente, que es la lista larga que el tablero vino a reemplazar.
 *
 * El toque en el nombre abre el resumen entero. En un teléfono no hay «pasar
 * por encima», así que ese es el único camino y tiene que llevar a todo.
 */
function Trabajo({
  carpeta: c,
  hayVentana,
  onMirar,
  nivel = 0,
}: {
  carpeta: CarpetaEnElTablero;
  /** Si hay una ventana abierta encima, de este trabajo o de cualquier otro. */
  hayVentana: boolean;
  onMirar: (c: CarpetaEnElTablero, pieza?: string) => void;
  /** Qué tan hondo está, para la sangría. */
  nivel?: number;
}) {
  const cancha = CANCHAS[c.cancha];
  const unaPieza = c.enJuego === 1;
  const hayAdentro = c.piezasEnJuego.length > 0 || c.hijas.length > 0;

  const [abierto, setAbierto] = useState(false);

  // **Este renglón abrió la ventana.** Mientras siga siendo cierto, la vista
  // rápida no se muestra por el foco: al cerrar la ventana el foco vuelve acá
  // —tiene que volver, es lo correcto para quien usa teclado— y sin esto la
  // vista quedaba abierta encima del renglón de abajo, que era justo el que se
  // estaba mirando. Se apaga solo cuando el foco se va a otro lado.
  const [abrioLaVentana, setAbrioLaVentana] = useState(false);

  return (
    <li className="group relative border-t border-linea-tenue">
      <div className="flex items-center" style={{ paddingLeft: nivel * 16 }}>
        {hayAdentro ? (
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
            aria-label={`${abierto ? "Cerrar" : "Abrir"} ${c.carpeta}`}
            className="grid h-7 w-5 shrink-0 place-items-center text-apagado transition-colors
                       hover:text-tinta focus-visible:outline-2 focus-visible:outline-acento"
          >
            <IconoFlecha className={abierto ? "rotate-90" : ""} />
          </button>
        ) : (
          <span aria-hidden="true" className="w-5 shrink-0" />
        )}

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
          className="peer flex min-w-0 flex-1 items-center gap-2 py-2 text-left transition-colors
                     hover:text-acento focus-visible:outline-2 focus-visible:outline-acento"
        >
          {/* El punto dice de quién es la pelota, salvo cuando el reloj manda:
              un trabajo vencido es rojo esté en la cancha que esté. */}
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${
              c.vencida ? "bg-alerta" : c.porVencer ? "bg-espera-borde" : cancha.punto
            }`}
          />
          {/* Y el de la carpeta, con la misma regla: rojo solo si de verdad
              tiene algo en rojo adentro. Una carpeta al día al lado de otra
              atrasada tiene que verse distinta sin abrir ninguna. */}
          <span
            className={`min-w-0 flex-1 truncate font-bold tracking-tight ${tonoDelNombre(
              c.diasConNosotros
            )}`}
          >
            {c.carpeta}
          </span>
          {/* **Hace cuánto que lo tenemos nosotros.** No es un plazo —no
              tenemos límite— pero es lo que dice si algo se está quedando
              quieto. Suma lo de adentro: el problema tiene que verse desde
              afuera, y cuál es exactamente se ve abriendo. */}
          {c.diasConNosotros !== null && (
            <span
              className={`cifras shrink-0 text-micro font-extrabold ${tonoDeEspera(
                c.diasConNosotros
              )}`}
              title={`Lo más viejo de acá adentro lo tenemos hace ${c.diasConNosotros} ${
                c.diasConNosotros === 1 ? "día" : "días"
              }`}
            >
              {c.diasConNosotros}d
            </span>
          )}

          {/* **La fecha va en el renglón y no solo al apoyar el mouse.** Es lo
              primero que se pregunta de un trabajo abierto, y en un teléfono no
              hay dónde apoyar nada. */}
          {c.vence && (
            <span
              className={`cifras shrink-0 text-micro ${
                c.vencida
                  ? "font-extrabold text-alerta"
                  : c.porVencer
                    ? "font-extrabold text-espera"
                    : "text-apagado"
              }`}
            >
              {c.vencida ? "venció " : ""}
              {fecha.format(c.vence)}
            </span>
          )}
        </button>
      </div>

      {/*
        La vista rápida. Aparece al apoyar el mouse o al llegar con el teclado,
        y no se puede tocar: es para mirar, no para usar. Por eso
        `pointer-events-none`, que además evita que tape el renglón de abajo.

        **Con el renglón abierto no aparece.** Se dibuja encima de lo que sigue,
        y lo que sigue pasó a ser el contenido de esta misma carpeta: taparlo
        para mostrar un resumen de lo que está tapando no tiene sentido.

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
      {!abierto && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute left-4 right-0 top-full z-20 hidden
                      border-2 border-tinta bg-lienzo p-2 shadow-lg
                      group-hover:block ${abrioLaVentana ? "" : "peer-focus-visible:block"}`}
        >
          {/*
            **Se mira, no se lee.** Antes había acá un párrafo, una barra de
            progreso y cuatro cuentas separadas por puntos: había que detenerse a
            leerlo, y para eso ya está la ventana. Lo que hace falta al pasar por
            encima es reconocer el trabajo —«ah, son los banners del día del
            padre»— y eso se contesta con la imagen, no con números.

            Debajo, una sola línea: qué está esperando y de quién. Si hay algo
            que pide una decisión, lo dice primero y en rojo.
          */}
          {c.muestras.length > 0 && (
            <div className="flex gap-1">
              {c.muestras.map((m) => (
                <span
                  key={m.archivo}
                  className="relative h-20 min-w-0 flex-1 overflow-hidden bg-hueco"
                >
                  <Miniatura
                    src={urlDeMiniatura(m.archivo, 400, m.modificado)}
                    alt=""
                    nombre={m.nombre}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </span>
              ))}
            </div>
          )}

          <p
            className={`flex flex-wrap items-baseline gap-x-2 text-micro ${
              c.muestras.length > 0 ? "mt-1.5" : ""
            }`}
          >
            {c.extraPedida > 0 ? (
              <span className="font-extrabold uppercase tracking-widest text-alerta">
                Pide otra vuelta
              </span>
            ) : (
              <span className="font-extrabold uppercase tracking-widest text-apagado">
                {cancha.comoEsta}
              </span>
            )}
            <span className="text-apagado">
              {c.asignadaA ?? "sin asignar"}
              {c.diasConNosotros !== null && (
                <span className={`font-extrabold ${tonoDeEspera(c.diasConNosotros)}`}>
                  {" · "}
                  {c.diasConNosotros} {c.diasConNosotros === 1 ? "día" : "días"} con
                  nosotros
                </span>
              )}
              {c.enJuego > 0 && ` · ${c.enJuego} ${unaPieza ? "pieza" : "piezas"}`}
              {c.vence && (
                <span
                  className={
                    c.vencida
                      ? "font-extrabold text-alerta"
                      : c.porVencer
                        ? "font-extrabold text-espera"
                        : ""
                  }
                >
                  {" · "}
                  {c.vencida ? "venció el" : "vence el"} {fecha.format(c.vence)}
                </span>
              )}
            </span>
          </p>
        </div>
      )}

      {abierto && (
        <ul className="flex flex-col">
          {/* Las piezas de esta carpeta, cada una con su reloj propio: acá se
              ve cuál es la que está en rojo. Las carpetas de adentro van
              después, porque son otro escalón y no otra pieza. */}
          {c.piezasEnJuego.map((p) => (
            <RenglonDePieza
              key={p.id}
              pieza={p}
              nivel={nivel + 1}
              onMirar={() => onMirar(c, p.id)}
            />
          ))}
          {c.hijas.map((h) => (
            <Trabajo
              key={h.carpetaId}
              carpeta={h}
              hayVentana={hayVentana}
              onMirar={onMirar}
              nivel={nivel + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Una pieza adentro de un trabajo abierto.
 *
 * **Es el último escalón del rojo.** La carpeta lo dice sumado, para avisar;
 * acá se dice por archivo, para no mandar a revisar cinco por culpa de uno.
 * Con su nombre de Drive, que es el que hay que ir a buscar allá.
 */
function RenglonDePieza({
  pieza: p,
  nivel,
  onMirar,
}: {
  pieza: PiezaEnElTablero;
  nivel: number;
  onMirar: () => void;
}) {
  return (
    <li className="border-t border-linea-tenue">
      {/*
        **El nombre arriba solo, y lo que lo describe abajo.** En una columna
        del tablero no entran cuatro cosas en un renglón: el nombre —que es lo
        que se viene a leer— quedaba cortado en «V…» al lado de una etiqueta
        entera. Arriba el nombre con todo el ancho, abajo el estado, el reloj y
        la fecha, que se leen de un vistazo aunque estén apretados.
      */}
      <button
        type="button"
        onClick={onMirar}
        style={{ paddingLeft: nivel * 16 + 20 }}
        className="flex w-full flex-col items-start gap-0.5 py-1.5 text-left transition-colors
                   hover:text-acento focus-visible:outline-2 focus-visible:outline-acento"
      >
        <span
          title={p.nombre}
          className={`max-w-full truncate text-menudo ${tonoDelNombre(p.diasConNosotros)}`}
        >
          {p.nombre}
        </span>
        <span className="flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <Estado estado={p.estado} />
          {p.diasConNosotros !== null && (
            <span
              className={`cifras text-micro font-extrabold ${tonoDeEspera(
                p.diasConNosotros
              )}`}
              title={`La tenemos nosotros hace ${p.diasConNosotros} ${
                p.diasConNosotros === 1 ? "día" : "días"
              }`}
            >
              {p.diasConNosotros}d
            </span>
          )}
          {p.vence && (
            <span
              className={`cifras text-micro ${
                p.vencida
                  ? "font-extrabold text-alerta"
                  : p.porVencer
                    ? "font-extrabold text-espera"
                    : "text-apagado"
              }`}
            >
              {p.vencida ? "venció " : ""}
              {fecha.format(p.vence)}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
