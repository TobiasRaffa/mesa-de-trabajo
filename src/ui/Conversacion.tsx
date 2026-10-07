"use client";

// La conversación entre el cliente y el equipo.
//
// Vive en `ui` y no en uno de los dos mundos porque **es la misma pantalla de
// los dos lados**: el cliente la abre desde el portal, la agencia desde la app
// de gestión. Lo único que cambia es quién es «yo», que decide de qué lado va
// cada burbuja. Tener dos copias sería la forma segura de que un día se vean
// distinto.
//
// Reemplaza al «comentario general», que era un cuadro de texto que se mandaba
// y desaparecía. Una entrega no se resuelve con un mensaje suelto: se resuelve
// hablando —«¿podemos correr todo una semana?», «sí, pero el jueves no llega»—
// y eso hoy pasa en WhatsApp, donde se mezcla con todo lo demás y se pierde.
// Acá queda al lado del trabajo del que se está hablando.
//
// **Del otro lado siempre hay una persona.** Es la regla más vieja de este
// proyecto y no se negocia: la aplicación no contesta, no sugiere respuestas,
// no resume lo que dijo el cliente ni le pone palabras a nadie. Lo único que
// hace es mostrar lo que cada uno escribió y cuándo. Si alguna vez esta
// pantalla parece contestar sola, algo se rompió.
//
// Lo que sí hace la aplicación es escribir **avisos de estado**: «se
// entregaron 4 piezas en Banners», «se envió la revisión». Van marcados
// distinto —centrados, en gris, sin burbuja— justamente para que no se
// confundan con lo que dijo alguien. Son los hitos de a tanda y nada más: uno
// por pieza aprobada convertiría esto en un registro, que es lo contrario de
// una conversación.

import { useEffect, useRef, useState } from "react";
import { Boton } from "@/ui/Boton";
import { IconoEnviar } from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import { EncabezadoDeVentana } from "@/ui/EncabezadoDeVentana";
import {
  diaEnBuenosAires,
  enPalabrasElDiaLargo,
  enPalabrasLaFecha,
  enPalabrasSoloLaHora,
} from "@/dominio/tiempo";
import { Fondo } from "@/ui/Fondo";
import { LARGO_MAXIMO } from "@/dominio/texto";
import type { Mensaje } from "@/lib/conversaciones";

export type { Mensaje };

// En 24 horas y en hora de Buenos Aires: los dos formatos salen del dominio,
// que es el único lugar donde se decide cómo se escribe una fecha.
const cuandoEnPalabras = enPalabrasLaFecha;
const diaEnPalabras = enPalabrasElDiaLargo;

/**
 * ¿Este mensaje es de otro día que el de arriba? El primero siempre lo es.
 *
 * **El día se decide en Buenos Aires, igual que como se escribe.** Comparaba
 * con `toDateString()`, que usa la zona del navegador, mientras el rótulo que
 * se dibuja está fijado a Buenos Aires: con el navegador en UTC, un mensaje de
 * las 22:30 porteñas ya era del día siguiente, así que aparecía un separador
 * donde el día no había cambiado —repitiendo la misma fecha del de arriba— y
 * faltaba donde sí. Es el agujero que `tiempo.ts` vino a cerrar.
 */
/**
 * Junta lo que había en pantalla con lo que acaba de llegar, **sin perder nada**.
 *
 * Es lo que usan los dos lados —gestión y portal— cada vez que llega una lista
 * de mensajes: del sondeo, de mandar uno, de «ver lo anterior». Reemplazar la
 * lista entera perdía cosas en tres casos:
 *
 *   - **Un sondeo que llega tarde.** Salió antes de mandar un mensaje y volvió
 *     después: traía la lista sin ese mensaje y lo borraba de la pantalla.
 *   - **La mudanza a un tramo.** Cuando el hilo vivo pasa el techo, lo viejo se
 *     guarda aparte y el hilo se achica de 400 a 300. Un candado que rechazaba
 *     «listas más cortas» —puesto para el caso de arriba— dejaba de aceptar
 *     sondeos hasta que se juntaran cien mensajes más: la conversación se
 *     congelaba en pantalla.
 *   - **Mandar con «ver lo anterior» abierto.** La respuesta trae solo el hilo
 *     vivo, y lo viejo que se había pedido desaparecía.
 *
 * Unir por identificador cubre los tres: lo que ya estaba se queda, lo nuevo
 * entra, y un mensaje no se repite. La conversación no se edita ni se borra, así
 * que nunca hay nada que sacar. Se ordena por cuándo se dijo, igual que la
 * conversación entera.
 */
export function juntarMensajes(previos: Mensaje[], llegados: Mensaje[]): Mensaje[] {
  const porId = new Map<string, Mensaje>();
  for (const m of previos) porId.set(m.id, m);
  for (const m of llegados) porId.set(m.id, m);
  return [...porId.values()].sort((a, b) => a.cuando.localeCompare(b.cuando));
}

export function cambiaElDia(anterior: Mensaje | undefined, mensaje: Mensaje): boolean {
  if (!anterior) return true;
  const a = new Date(anterior.cuando);
  const b = new Date(mensaje.cuando);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return diaEnBuenosAires(a) !== diaEnBuenosAires(b);
}

/** El mínimo para que un dedo acierte, en píxeles. Es `--spacing-toque`. */
const PISO = 44;

type Props = {
  carpeta: string;
  mensajes: Mensaje[];
  /** De qué lado del mostrador está quien mira esta pantalla. */
  yo: "cliente" | "agencia";
  /**
   * Manda el mensaje. Contesta si salió.
   *
   * **El campo se vacía recién cuando contestó que sí.** Se vaciaba en el acto,
   * sin esperar: si el envío fallaba, el texto ya no estaba en ninguna parte
   * —ni en la pantalla ni en el servidor— y del lado de la agencia ni siquiera
   * aparecía un cartel. Alguien escribía tres renglones, tocaba enviar, y
   * desaparecían.
   */
  onEnviar: (texto: string) => Promise<boolean>;
  onCerrar: () => void;
  /** Se está esperando al servidor. */
  enviando?: boolean;
  /**
   * Quién firma lo que se escribe. Va arriba del campo.
   *
   * El portal no lo usa: del lado del cliente firma el cliente y no hay nada
   * que elegir. Del lado de la agencia sí, porque son varias personas y el
   * cliente tiene que saber con quién habló.
   */
  firma?: React.ReactNode;
  /**
   * Lo de antes, cuando la conversación es larga.
   *
   * Un hilo de años no se trae entero cada vez: lo viejo queda guardado aparte
   * y se pide con un botón. **No falta nada**, está más atrás; el botón lo dice
   * con esas palabras justamente para que nadie crea que se perdió algo.
   */
  anteriores?: { hay: boolean; trayendo: boolean; onTraer: () => void };
  /**
   * Cuántos mensajes del otro lado faltaban leer **al abrir**.
   *
   * Decide dónde arranca la pantalla: en el primero de esos, con una raya
   * arriba que dice «nuevos». Abrir un hilo en el último mensaje obliga a
   * subir a buscar dónde se había quedado uno; abrirlo arriba de todo, a bajar
   * por semanas de conversación. Con cero, arranca al final, que es donde
   * está lo último dicho.
   */
  sinLeer?: number;
  /**
   * No se pudo leer la conversación.
   *
   * **«Todavía no hablaron por acá» es una mentira cuando el error es de
   * lectura.** Sin mensajes y con un fallo se veía exactamente igual que un
   * hilo vacío: alguien miraba, leía que no hay nada, y cerraba. Los dos casos
   * son `mensajes === []` y hay que distinguirlos.
   */
  error?: string | null;
  /** Lo que se estaba escribiendo, para que sobreviva a cerrar y volver. */
  borrador?: string;
  onBorrador?: (texto: string) => void;
};

export function Conversacion({
  carpeta,
  mensajes,
  yo,
  onEnviar,
  onCerrar,
  enviando = false,
  firma,
  anteriores,
  sinLeer = 0,
  error = null,
  borrador,
  onBorrador,
}: Props) {
  // **Cerrar con algo escrito pregunta antes.** Tocar fuera de la ventana
  // —o Escape— la cerraba y con ella se iba la respuesta a medio escribir, sin
  // una palabra. Es el mismo gesto que se usa para volver a mirar el trabajo
  // del que se está hablando.
  const [texto, setTexto] = useState(borrador ?? "");

  const cerrar = () => {
    if (texto.trim() && !confirm("Tenés un mensaje sin enviar. ¿Cerrás igual?")) return;
    onCerrar();
  };

  const marco = useTrampaDeFoco<HTMLDivElement>(cerrar);
  const lista = useRef<HTMLDivElement>(null);
  const primeroNuevo = useRef<HTMLLIElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  // **Dónde empieza lo nuevo.** Lo que falta leer es del otro lado; lo mío y
  // los avisos de la aplicación no cuentan. Se cuentan desde el final los
  // mensajes del otro hasta llegar a `sinLeer`, y ahí está el primero. Es la
  // misma cuenta que hace el servidor para el número del botón.
  //
  // Queda fijo al abrir: si se recalculara con cada mensaje que llega, la
  // raya de «nuevos» se movería mientras uno lee.
  //
  // `undefined` es «todavía no llegó nada»; `null`, «no hay nada sin leer». Se
  // decide en el dibujado en que aparecen los mensajes, y de ahí no se mueve.
  const [idDelPrimeroNuevo, setIdDelPrimeroNuevo] = useState<string | null | undefined>(
    undefined
  );
  if (idDelPrimeroNuevo === undefined && mensajes.length > 0) {
    const desde = indiceDelPrimerSinLeer(mensajes, yo, sinLeer);
    setIdDelPrimeroNuevo(desde === null ? null : mensajes[desde].id);
  }

  // El campo crece con lo que se escribe. Se mide poniéndolo en cero primero:
  // sin eso, `scrollHeight` devuelve el alto de antes y el campo nunca achica.
  //
  // El piso se aplica acá y no solo en el CSS: dejando el alto por debajo del
  // mínimo, el navegador lo estira con `min-height` pero sigue creyendo que
  // hay algo de sobra, y dibuja una barra de desplazamiento de un pelo con el
  // campo vacío.
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    // `scrollHeight` mide el contenido; el alto que se fija incluye el borde.
    // Sin sumarlo faltaba un pelo y el navegador dibujaba una barra de
    // desplazamiento de un píxel con el campo vacío.
    const borde = el.offsetHeight - el.clientHeight;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight + borde, PISO)}px`;
  }, [texto]);

  // **Al abrir, se mira el primero sin leer; después, cada mensaje nuevo.**
  //
  // Se abría arriba de todo, y no por decisión: los mensajes llegan después de
  // que la pantalla existe, y ese primer salto de cero a veinte se confundía
  // con «trajeron lo de antes», que es el caso en que no hay que moverse. Así
  // que no se movía nunca, y había que bajar a mano por todo el hilo.
  //
  // Ahora se distinguen los tres casos por lo que hay al final, no por cuánto
  // hay: la primera vez que llega algo se va al primero sin leer —o al final,
  // si no hay nada sin leer—; si cambió el último mensaje, llegó uno nuevo y
  // se lo mira; si el último es el mismo, lo que llegó es lo de antes y la
  // pantalla se queda donde estaba, que es donde está lo que se vino a leer.
  const ultimoVisto = useRef<string | null>(null);
  useEffect(() => {
    const ultimo = mensajes[mensajes.length - 1]?.id ?? null;
    if (ultimo === ultimoVisto.current) return;
    const primeraVez = ultimoVisto.current === null;
    ultimoVisto.current = ultimo;
    if (ultimo === null) return;

    if (primeraVez && idDelPrimeroNuevo) {
      primeroNuevo.current?.scrollIntoView({ block: "start" });
    } else if (lista.current) {
      // Hasta el fondo del contenedor, y no hasta el último mensaje: así el
      // aire de abajo también se ve, y el último no queda pegado al borde.
      lista.current.scrollTop = lista.current.scrollHeight;
    }
  }, [mensajes, idDelPrimeroNuevo]);

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio) return;
    // Lo escrito se queda hasta que el servidor confirme. Si falla, sigue ahí
    // para volver a intentar sin escribirlo de nuevo.
    if (await onEnviar(limpio)) {
      setTexto("");
      onBorrador?.("");
    }
  }

  return (
    <Fondo
      onCerrar={cerrar}
      className="z-50 flex items-end justify-center sm:items-center sm:p-6"
    >
      <div
        ref={marco}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Conversación con ${carpeta}`}
        className="flex h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-tarjeta bg-lienzo sm:rounded-tarjeta"
      >
        {/* Arriba va con quién se habla, y nada más. Decía «Conversación» en
            grande y el nombre chiquito abajo: la palabra no informa nada —ya
            se ve que es una conversación— y el nombre es lo que hay que leer. */}
        <EncabezadoDeVentana titulo={carpeta} onCerrar={cerrar} />

        <div ref={lista} className="min-h-0 flex-1 overflow-y-auto bg-papel px-4 pb-6 pt-4">
          {/* Arriba de todo, que es donde termina el que sube leyendo. */}
          {anteriores?.hay && (
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                onClick={anteriores.onTraer}
                disabled={anteriores.trayendo}
                className="min-h-toque rounded-full border border-linea bg-lienzo px-4 text-menudo
                           font-semibold text-tinta-suave transition-colors
                           hover:bg-hueco disabled:opacity-40"
              >
                {anteriores.trayendo ? "Buscando…" : "Ver lo anterior"}
              </button>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mb-3 border-l-4 border-alerta bg-alerta-tenue px-3 py-2 text-menudo font-semibold text-alerta"
            >
              {error}
            </p>
          )}

          {mensajes.length === 0 ? (
            null
          ) : (
            <ul className="flex flex-col">
              {mensajes.map((mensaje, i) => {
                const esElPrimeroNuevo = mensaje.id === idDelPrimeroNuevo;
                return (
                  <Burbuja
                    key={mensaje.id}
                    mensaje={mensaje}
                    yo={yo}
                    primeroNuevo={esElPrimeroNuevo}
                    // La raya de «nuevos» corta la racha: lo que viene después
                    // de ella vuelve a decir de quién es.
                    sigue={!esElPrimeroNuevo && sigueALaAnterior(mensajes[i - 1], mensaje)}
                    diaNuevo={
                      cambiaElDia(mensajes[i - 1], mensaje) ? diaEnPalabras(mensaje.cuando) : null
                    }
                    ref={esElPrimeroNuevo ? primeroNuevo : undefined}
                  />
                );
              })}
            </ul>
          )}
        </div>

        {/*
          El pie era un tercio de la ventana: tres renglones de textarea, una
          línea de texto y un botón, todo fijo aunque no se estuviera
          escribiendo. Lo que importa son los mensajes.

          Ahora arranca en un renglón y crece con lo que se escribe, hasta un
          tope: quien manda dos palabras ve dos palabras, y quien escribe un
          párrafo lo ve entero sin desplazar.
        */}
        <footer className="border-t-2 border-tinta px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
          {firma}
          <div className="flex items-end gap-2">
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                onBorrador?.(e.target.value);
              }}
              // **Enter manda.** Es lo que hace cualquier chat, y lo que la
              // mano ya sabe. Shift+Enter deja bajar un renglón para quien
              // escribe un párrafo.
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                e.preventDefault();
                if (!enviando) enviar();
              }}
              maxLength={LARGO_MAXIMO}
              rows={1}
              // Se abre un chat para escribir: el cursor arranca acá. El
              // `autoFocus` solo no alcanza —la trampa de foco corre después—,
              // así que además se marca cuál es el campo que manda.
              autoFocus
              data-enfocar
              className="max-h-40 min-h-toque w-full resize-none rounded-campo border border-linea bg-lienzo
                         px-3 py-2.5 text-normal transition-colors placeholder:text-apagado
                         focus:border-acento focus:outline-none focus:ring-4 focus:ring-acento-tenue"
            />
            <Boton
              onClick={enviar}
              disabled={enviando || texto.trim().length === 0}
              aria-label="Enviar"
            >
              <IconoEnviar />
              <span className="sr-only sm:not-sr-only">Enviar</span>
            </Boton>
          </div>
        </footer>
      </div>
    </Fondo>
  );
}

/**
 * Dónde empieza lo que falta leer, o `null` si no falta nada.
 *
 * Lo sin leer es del otro lado: lo mío y los avisos de la aplicación no
 * cuentan, igual que en el número del botón. Se cuenta desde el final hacia
 * atrás hasta juntar `sinLeer` mensajes del otro; el último que se contó es el
 * primero sin leer. Si hay menos que eso —se movieron a lo de antes—, es el
 * primero que hay.
 */
export function indiceDelPrimerSinLeer(
  mensajes: Mensaje[],
  yo: "cliente" | "agencia",
  sinLeer: number
): number | null {
  if (sinLeer <= 0 || mensajes.length === 0) return null;
  const otro = yo === "cliente" ? "agencia" : "cliente";

  let faltan = sinLeer;
  for (let i = mensajes.length - 1; i >= 0; i--) {
    if (mensajes[i].de !== otro) continue;
    faltan -= 1;
    if (faltan === 0) return i;
  }
  return 0;
}

/**
 * ¿Este mensaje sigue al de arriba, de la misma persona?
 *
 * **Varios mensajes seguidos llevan un solo rótulo.** Con nombre y hora sobre
 * cada burbuja, alguien que escribe una idea en cuatro renglones deja cuatro
 * veces «CLIENTE · 18 SEPT, 12:33» y el hilo se lee como una planilla. El
 * rótulo se pone en el primero, y de nuevo recién cuando contesta el otro:
 * una respuesta en el medio corta la racha.
 *
 * Dos cosas más la cortan: un aviso de la aplicación —no es nadie hablando— y
 * que cambie el día, porque ahí la fecha del rótulo vuelve a decir algo que
 * no se ve de otra forma.
 */
export function sigueALaAnterior(anterior: Mensaje | undefined, mensaje: Mensaje): boolean {
  if (!anterior) return false;
  if (anterior.de === "sistema" || mensaje.de === "sistema") return false;
  if (anterior.de !== mensaje.de || anterior.quien !== mensaje.quien) return false;
  const a = new Date(anterior.cuando);
  const b = new Date(mensaje.cuando);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  // En Buenos Aires, que es la zona en la que se escriben los separadores: con
  // la del navegador, la racha se cortaba en un lugar y la raya del día en
  // otro, y el nombre se repetía de más.
  return diaEnBuenosAires(a) === diaEnBuenosAires(b);
}

function Burbuja({
  mensaje,
  yo,
  primeroNuevo = false,
  sigue = false,
  diaNuevo = null,
  ref,
}: {
  mensaje: Mensaje;
  yo: "cliente" | "agencia";
  /** Es el primero que no se había leído: lleva la raya de «nuevos» arriba. */
  primeroNuevo?: boolean;
  /** Sigue al de arriba, de la misma persona y de corrido: va sin rótulo y pegado. */
  sigue?: boolean;
  /** Empieza otro día: el día, en palabras, para la raya de arriba. */
  diaNuevo?: string | null;
  ref?: React.Ref<HTMLLIElement>;
}) {
  // **La fecha va en su propia raya, no en cada rótulo.** El rótulo de una
  // burbuja dice solo quién habla; la hora está al apoyar el mouse en cada
  // mensaje, y el día se ve una vez, cuando cambia.
  const fecha = diaNuevo && (
    <p className="mb-3 mt-2 text-center text-menudo font-semibold text-apagado first-letter:uppercase">
      {diaNuevo}
    </p>
  );
  // La raya que separa lo leído de lo nuevo. Es a donde se llega al abrir.
  const raya = primeroNuevo && (
    <div
      aria-label="Desde acá, sin leer"
      className="mb-3 flex w-full items-center gap-3 text-menudo font-bold text-acento"
    >
      <span className="h-px flex-1 bg-acento/40" />
      Nuevos
      <span className="h-px flex-1 bg-acento/40" />
    </div>
  );

  // Un aviso de la aplicación no es alguien hablando: va centrado, en gris y
  // sin burbuja, para que se lea como lo que es.
  if (mensaje.de === "sistema") {
    return (
      <li ref={ref} className="flex flex-col pt-3">
        {fecha}
        {raya}
        <p className="self-center rounded-full bg-hueco px-4 py-1.5 text-center text-menudo text-tinta-suave">
          {mensaje.texto}
          <span className="ml-2 text-micro text-apagado">
            {cuandoEnPalabras(mensaje.cuando)}
          </span>
        </p>
      </li>
    );
  }

  const mio = mensaje.de === yo;

  return (
    // Pegado al de arriba cuando sigue la racha; con aire cuando empieza otra.
    <li
      ref={ref}
      className={`flex flex-col ${mio ? "items-end" : "items-start"} ${sigue ? "pt-1" : "pt-3"}`}
    >
      {fecha && <div className="w-full">{fecha}</div>}
      {raya}
      <div className="max-w-[85%]">
        {/* **La hora se lee, no se descubre.** Existía solo en un `title`, o
            sea apoyando el mouse encima de cada burbuja: en el teléfono no
            aparece nunca, y con lector de pantalla tampoco. En una
            conversación la hora es la mitad de lo que se lee —si contestaron
            hace cinco minutos o ayer a la noche— así que va con el nombre, en
            el primero de cada racha, que es donde el rótulo ya está. */}
        {!sigue && (
          <p
            className={`flex items-baseline gap-2 px-1 text-menudo font-bold text-tinta-suave ${
              mio ? "flex-row-reverse text-right" : ""
            }`}
          >
            {mensaje.quien}
            <span className="cifras text-micro font-semibold text-apagado">
              {enPalabrasSoloLaHora(mensaje.cuando)}
            </span>
          </p>
        )}
        <p
          // La hora está en cada mensaje, al apoyar el mouse. El rótulo dice
          // solo quién; el día, la raya de arriba cuando cambia.
          title={cuandoEnPalabras(mensaje.cuando)}
          className={`mt-0.5 whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-normal ${
            mio
              ? `bg-acento text-white ${sigue ? "" : "rounded-tr-md"}`
              : `border border-linea bg-lienzo text-tinta ${sigue ? "" : "rounded-tl-md"}`
          }`}
        >
          {mensaje.texto}
        </p>
      </div>
    </li>
  );
}
