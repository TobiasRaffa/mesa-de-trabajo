"use client";

// Los clientes, como un árbol que se abre.
//
// La forma imita la de Drive porque **es** la de Drive: cliente, sus carpetas,
// los archivos de cada una. Quien la usa ya tiene ese mapa en la cabeza.
//
// Tres decisiones sobre cómo se dibuja:
//
//   1. **Cada nivel se pide al abrirlo.** Leer de Drive todos los archivos de
//      todos los clientes para dibujar una lista cerrada sería pagar por
//      adelantado algo que casi nunca se mira.
//
//   2. **La configuración está aparte de la navegación.** La flecha muestra
//      qué hay adentro; el engranaje, qué se puede cambiar. Mezclarlos hacía
//      que buscar un archivo obligara a pasar por encima de los botones que
//      apagan cosas.
//
//   3. **Los botones de la derecha están siempre a la misma altura.** La
//      sangría del árbol va **adentro** de la fila, como un espacio en blanco
//      al principio, y no como relleno de la lista. Con relleno, cada nivel
//      angostaba la fila y los botones de la derecha se corrían hacia adentro:
//      la columna de Drive quedaba en escalera. Cuando una fila no tiene algo
//      —un archivo no se configura—, va un hueco del mismo ancho.
//
// Las pantallas de administración no llevan textos que expliquen qué hace cada
// cosa. Se probaron y tapaban lo importante: en una lista, lo que hay que leer
// son los nombres y los estados, no un párrafo al lado de cada control.

import { CALENDARIO_ACTIVO } from "@/dominio/agencia";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { abrirCarpeta, abrirCliente } from "@/app/(admin)/gestion/acciones";
import type { Contenido, NodoArchivo, NodoCarpeta } from "@/admin/datos/arbol";
import type { ClienteEnGestion } from "@/admin/datos/carpetas";
import type { Persona } from "@/lib/equipo";
import { ConfiguracionDeCliente } from "@/admin/ConfiguracionDeCliente";
import { ConfiguracionDeCarpeta } from "@/admin/ConfiguracionDeCarpeta";
import { ConfiguracionDeArchivo } from "@/admin/ConfiguracionDeArchivo";
import { Entregar } from "@/admin/Entregar";
import { RarezasDeNombres } from "@/admin/RarezasDeNombres";
import { VueltaSinAsignar } from "@/admin/VueltaSinAsignar";
import { ResumenDeTrabajo, type TrabajoParaMirar } from "@/admin/ResumenDeTrabajo";
import { Visibilidad } from "@/admin/Visibilidad";
import { Estado } from "@/ui/Estado";
import { laTenemosNosotros, sigueEnJuego } from "@/dominio/pieza";
import { coincide } from "@/dominio/texto";
import { haceCuanto } from "@/lib/fechas";
import { cuandoSePublica, enPalabrasElDia } from "@/dominio/tiempo";
import { IconoConfig, IconoDrive, IconoFlecha } from "@/ui/Icono";
import { MensajesSinLeer } from "@/admin/MensajesSinLeer";

/** Cuánto se corre cada nivel del árbol, en píxeles. */
const SANGRIA = 22;

/**
 * Los clientes que deja ver el buscador.
 *
 * **Uno abierto pasa aunque su nombre no coincida**, igual que una carpeta. Se
 * filtraban solo por nombre: buscar «banners» con Café Otoño abierto escondía
 * al cliente, y con él la carpeta que se estaba buscando.
 */
export function clientesALaVista<C extends { id: string; nombre: string }>(
  clientes: C[],
  busqueda: string,
  abiertas: Set<string>
): C[] {
  return clientes.filter((c) => coincide(c.nombre, busqueda) || abiertas.has(c.id));
}

/**
 * Con qué se filtra lo de adentro de un cliente.
 *
 * **Si el cliente coincidió por su nombre, con nada.** Lo buscado era él: se
 * escribía «cafe», se abría Café Otoño y sus carpetas se filtraban por «cafe»,
 * así que adentro decía «Nada acá se llama así».
 */
export function busquedaAdentroDe(nombre: string, busqueda: string): string {
  return coincide(nombre, busqueda) ? "" : busqueda;
}

/**
 * Cuál configuración está abierta, en todo el árbol.
 *
 * Una sola a la vez. Con varias abiertas la lista se estira, hay que desplazar
 * para volver a ver de qué cliente era cada panel, y es fácil guardar un
 * cambio creyendo que se estaba en otro.
 */
const Abierta = createContext<{
  cual: string | null;
  alternarConfig: (id: string) => void;
  /**
   * Abre la ventana grande de **una pieza**.
   *
   * Por archivo y no por carpeta: una carpeta con dos archivos no deja decir
   * cuál se quiere mirar. La carpeta llega igual —la ventana la necesita para
   * lo que es del trabajo entero— pero lo que se muestra es esa pieza.
   *
   * Va por el contexto y no como prop porque el árbol se dibuja recursivo:
   * pasarla de mano en mano obligaría a atravesar dos componentes que no la
   * usan, y la ventana es una sola para toda la pantalla.
   */
  mirar: (
    /** La carpeta que **contiene** el archivo: de ahí salen sus piezas. */
    contenedora: NodoCarpeta,
    /** La carpeta de trabajo, la de primer nivel: es la que da el rótulo. */
    trabajo: NodoCarpeta,
    clienteId: string,
    piezaId: string
  ) => void;
  /** Lo que se escribió en el buscador. Vacío es «todo». */
  busqueda: string;
  /**
   * Qué carpetas están abiertas, en todo el árbol.
   *
   * **El buscador la necesita.** Filtraba cada nivel por su propio nombre, así
   * que escribir el nombre de un archivo escondía la carpeta que lo contiene y
   * con ella el archivo buscado: la pantalla quedaba diciendo «Nada acá se
   * llama así» con el archivo adentro. Una carpeta abierta ya trajo su
   * contenido, así que se deja pasar y el filtro sigue actuando adentro.
   */
  abiertas: Set<string>;
  marcarAbierta: (id: string, abierta: boolean) => void;
}>({
  cual: null,
  alternarConfig: () => {},
  mirar: () => {},
  busqueda: "",
  abiertas: new Set(),
  marcarAbierta: () => {},
});

/**
 * En qué trabajo estamos parados, mientras se dibuja el árbol hacia adentro.
 *
 * Lo pone cada carpeta de trabajo alrededor de lo que tiene adentro, y así
 * cualquier archivo —esté a un nivel o a cuatro— sabe de qué trabajo es y de
 * qué cliente, sin que haya que pasárselo de mano en mano por componentes que
 * no lo usan.
 */
const EnTrabajo = createContext<{
  /**
   * La carpeta que contiene lo que se está dibujando.
   *
   * **Es distinta de la de trabajo en cuanto hay una subcarpeta, y confundirlas
   * abría la pieza equivocada.** Acá se guardaba solo la de primer nivel: al
   * tocar el nombre de un archivo que estaba dentro de «Banners / Setiembre»,
   * la ventana pedía las piezas de «Banners» —que no lista lo de adentro de sus
   * subcarpetas— y la pieza tocada no aparecía en esa lista. La ventana caía en
   * la primera que hubiera y **la mostraba como si fuera la que se tocó**, con
   * su botón de Configurar incluido; si «Banners» no tenía archivos sueltos,
   * decía «Esta carpeta no tiene piezas». Sin un solo cartel de error.
   */
  contenedora: NodoCarpeta;
  /** La de primer nivel: el trabajo del que esto forma parte. Da el rótulo. */
  trabajo: NodoCarpeta;
  clienteId: string;
} | null>(null);

/** El hueco de un botón que no está, para que la columna no se mueva. */
const Hueco = () => <span aria-hidden="true" className="h-9 w-9 shrink-0" />;

/** El triángulo que abre y cierra. Gira, para que se vea qué está abierto. */
function Abridor({
  abierto,
  onAbrir,
  etiqueta,
  cargando,
}: {
  abierto: boolean;
  onAbrir: () => void;
  etiqueta: string;
  cargando?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-expanded={abierto}
      aria-label={etiqueta}
      className="grid h-9 w-9 shrink-0 place-items-center text-apagado transition-colors hover:bg-hueco hover:text-tinta"
    >
      {cargando ? (
        <span className="text-micro font-extrabold">…</span>
      ) : (
        <IconoFlecha className={abierto ? "rotate-90" : ""} />
      )}
    </button>
  );
}

/** El botón de Drive: abre la carpeta o el archivo allá. */
function EnDrive({ href, que }: { href?: string; que: string }) {
  if (!href) return <Hueco />;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={`Abrir ${que} en Drive`}
      className="grid h-9 w-9 shrink-0 place-items-center text-apagado transition-colors hover:bg-hueco hover:text-tinta"
    >
      <IconoDrive />
      <span className="sr-only">Abrir {que} en Drive</span>
    </a>
  );
}

function BotonDeConfig({
  abierta,
  onTocar,
  que,
  de,
}: {
  abierta: boolean;
  onTocar: () => void;
  que: string;
  /** De qué es esta configuración. Sirve para saber qué toque es «adentro». */
  de: string;
}) {
  return (
    <button
      type="button"
      onClick={onTocar}
      aria-expanded={abierta}
      data-ajustes={de}
      title={`Configuración de ${que}`}
      className={`rounded-full grid h-9 w-9 shrink-0 place-items-center transition-colors ${
        abierta ? "bg-tinta text-lienzo" : "text-apagado hover:bg-hueco hover:text-tinta"
      }`}
    >
      <IconoConfig />
      <span className="sr-only">Configuración de {que}</span>
    </button>
  );
}

/**
 * Una fila del árbol, con todo en su columna.
 *
 * Recibe la sangría como número y la dibuja adentro. Así todas las filas miden
 * lo mismo de ancho y los botones de la derecha caen siempre en el mismo lugar.
 */
function Fila({
  nivel,
  abridor,
  children,
  drive,
  config,
  atenuada,
}: {
  nivel: number;
  abridor: React.ReactNode;
  children: React.ReactNode;
  drive: React.ReactNode;
  config: React.ReactNode;
  atenuada?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-2.5 ${atenuada ? "bg-hueco/40" : ""}`}
    >
      <span aria-hidden="true" style={{ width: nivel * SANGRIA }} className="shrink-0" />
      {abridor}
      <div className="min-w-0 flex-1">{children}</div>
      {drive}
      {config}
    </div>
  );
}

/** El panel que se abre debajo de una fila, alineado con su contenido. */
function Panel({
  nivel,
  de,
  children,
}: {
  nivel: number;
  de: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-ajustes={de}
      className="border-t border-linea-tenue bg-lienzo py-4 pr-4"
      style={{ paddingLeft: nivel * SANGRIA + 44 }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ArbolDeClientes({
  clientes,
  equipo,
  abiertoDeEntrada,
}: {
  clientes: ClienteEnGestion[];
  equipo: Persona[];
  /**
   * Abrir los clientes sin que haya que tocar nada.
   *
   * Lo usa la ficha de un cliente, que es una pantalla dedicada a uno solo:
   * llegar ahí y encontrarse con que **todavía** hay que abrirlo, debajo de su
   * nombre repetido, es un toque para pedir lo que se vino a ver.
   */
  abiertoDeEntrada?: boolean;
}) {
  const [cual, setCual] = useState<string | null>(null);

  /**
   * Tocar en otro lado cierra la configuración abierta.
   *
   * Sin esto quedaban abiertas para siempre: la única forma de cerrar una era
   * volver a tocar su engranaje o abrir otra. Se acumulaban tres paneles en
   * pantalla, el árbol se estiraba, y era fácil guardar un cambio creyendo que
   * se estaba configurando otra cosa.
   *
   * «Adentro» son dos cosas y hacen falta las dos: el panel —para poder
   * escribir y apretar Guardar sin que se cierre debajo del dedo— y el propio
   * engranaje, que ya alterna por su cuenta y si no se cerraría dos veces y
   * volvería a abrirse.
   *
   * Se escucha `pointerdown` y no `click`: un `click` llega después de que el
   * navegador movió el foco, y en un formulario eso alcanza para que un botón
   * pierda el suyo antes de enviarse.
   */
  useEffect(() => {
    if (cual === null) return;

    const alTocar = (e: PointerEvent) => {
      const destino = e.target as Element | null;
      const adentro = destino?.closest?.("[data-ajustes]");
      if (adentro instanceof HTMLElement && adentro.dataset.ajustes === cual) return;
      setCual(null);
    };

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCual(null);
    };

    document.addEventListener("pointerdown", alTocar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("pointerdown", alTocar);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [cual]);

  // Cuál trabajo se está mirando en grande. Una sola para toda la pantalla:
  // la ventana la tapa entera.
  const [mirando, setMirando] = useState<{
    trabajo: TrabajoParaMirar;
    pieza: string;
  } | null>(null);

  /**
   * El buscador. Filtra clientes por nombre, y adentro de los que estén
   * abiertos, carpetas y archivos. No abre nada solo: lo que no se cargó de
   * Drive no se puede buscar sin cargarlo, y cargar veinte clientes para
   * buscar una palabra es lo que el árbol perezoso evita.
   */
  const [busqueda, setBusqueda] = useState("");

  /**
   * Los clientes y carpetas abiertos: el buscador los deja pasar aunque no
   * coincidan.
   */
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const aLaVista = clientesALaVista(clientes, busqueda, abiertas);
  const marcarAbierta = useCallback((id: string, abierta: boolean) => {
    setAbiertas((antes) => {
      const ahora = new Set(antes);
      if (abierta) ahora.add(id);
      else ahora.delete(id);
      return ahora;
    });
  }, []);

  const contexto = useMemo(
    () => ({
      busqueda,
      abiertas,
      marcarAbierta,
      cual,
      // Tocar la que ya está abierta la cierra; tocar otra cambia de una a la
      // otra, sin dejar las dos abiertas.
      alternarConfig: (id: string) => setCual((antes) => (antes === id ? null : id)),
      mirar: (
        contenedora: NodoCarpeta,
        trabajo: NodoCarpeta,
        clienteId: string,
        piezaId: string
      ) =>
        setMirando({
          pieza: piezaId,
          trabajo: {
            clienteId,
            // El nombre sale de la lista que ya tenemos: la fila no lo lleva
            // encima y pasárselo de mano en mano era atravesar dos componentes
            // que no lo usan.
            cliente: clientes.find((x) => x.id === clienteId)?.nombre ?? "",
            // **La carpeta que contiene la pieza, no la de primer nivel.** Es
            // de acá de donde la ventana saca la lista de piezas, y el plazo y
            // el responsable que de verdad corren para lo que hay adentro.
            carpetaId: contenedora.id,
            // El camino, como lo escribe el portal: «Banners / Setiembre». Sin
            // esto el rótulo decía «Banners» sobre las piezas de «Setiembre».
            carpeta:
              trabajo.id === contenedora.id
                ? trabajo.nombre
                : `${trabajo.nombre} / ${contenedora.nombre}`,
            diasQueCorren: contenedora.diasQueCorren,
            responsableQueCorre: contenedora.responsableQueCorre,
          },
        }),
    }),
    [cual, clientes, busqueda, abiertas, marcarAbierta]
  );

  return (
    <Abierta.Provider value={contexto}>
      {clientes.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar"
            aria-label="Buscar en el árbol"
            className="min-h-toque w-full max-w-sm border-2 border-tinta bg-lienzo px-3 text-normal
                       placeholder:text-apagado focus:border-acento focus:outline-none"
          />
          {busqueda && (
            <span className="text-menudo text-apagado">
              {aLaVista.length} de {clientes.length}
            </span>
          )}
        </div>
      )}
      <ul className="border-t border-linea">
        {aLaVista.map((cliente) => (
          <FilaCliente
            key={cliente.id}
            cliente={cliente}
            equipo={equipo}
            abiertoDeEntrada={abiertoDeEntrada}
          />
        ))}
        {aLaVista.length === 0 && (
          <li className="px-4 py-3 text-menudo text-apagado">Ningún cliente se llama así.</li>
        )}
      </ul>

      {mirando && (
        <ResumenDeTrabajo
          carpeta={mirando.trabajo}
          equipo={equipo}
          soloPieza={mirando.pieza}
          onCerrar={() => setMirando(null)}
        />
      )}
    </Abierta.Provider>
  );
}

function FilaCliente({
  cliente,
  equipo,
  abiertoDeEntrada,
}: {
  cliente: ClienteEnGestion;
  equipo: Persona[];
  /** En la ficha de un cliente el árbol viene abierto: es lo único que hay. */
  abiertoDeEntrada?: boolean;
}) {
  const [abierto, setAbierto] = useState(Boolean(abiertoDeEntrada));
  const arbol = useContext(Abierta);
  const { cual, alternarConfig, marcarAbierta } = arbol;

  // Lo de adentro se busca con lo que corresponda a este cliente: nada, si
  // lo buscado era él.
  const adentro = busquedaAdentroDe(cliente.nombre, arbol.busqueda);
  const contextoAdentro = useMemo(() => ({ ...arbol, busqueda: adentro }), [arbol, adentro]);
  const config = cual === cliente.id;
  const [contenido, setContenido] = useState<Contenido | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apagado = !cliente.habilitado;
  const sinClave = !cliente.tieneClave;

  // Si ya se trajo algo alguna vez. Va en una marca y no en `contenido`
  // porque lo lee `refrescar`, y `refrescar` no puede cambiar de identidad.
  const hayContenido = useRef(false);

  const traer = useCallback(async () => {
    setCargando(true);
    try {
      const r = await abrirCliente(cliente.id);
      if (r.ok) {
        setContenido(r.contenido);
        hayContenido.current = true;
        setError(null);
      } else {
        setError(r.motivo);
      }
    } catch {
      setError("No pude leer la carpeta.");
    } finally {
      setCargando(false);
    }
  }, [cliente.id]);

  /**
   * Guardar cambia lo que dice la fila —«oculta», «calendario», quién la
   * lleva—. Si no se vuelve a pedir, el cartel sigue mostrando lo viejo y
   * parece que el cambio no se guardó.
   *
   * **No puede mirar `contenido`, y esa es toda la historia de un bucle.** La
   * configuración avisa desde un efecto que tiene esta función entre sus
   * dependencias. Mirando `contenido`, cada respuesta traía un objeto nuevo,
   * la función cambiaba de identidad, el efecto volvía a correr y volvía a
   * llamarla: guardar cualquier cosa dejaba a la aplicación pidiéndole a Drive
   * en bucle mientras el panel estuviera abierto. La marca de arriba no cambia
   * de identidad nunca, así que esta función tampoco.
   */
  const refrescar = useCallback(() => {
    if (hayContenido.current) traer();
  }, [traer]);

  // Viene abierto: hay que traerle el contenido igual, que si no queda una
  // flecha girada sobre un hueco.
  useEffect(() => {
    if (abiertoDeEntrada && !hayContenido.current) traer();
  }, [abiertoDeEntrada, traer]);

  // **Se vuelve a leer al abrir.** Se traía una sola vez y quedaba guardado
  // para siempre: alguien subía un archivo a Drive desde otra pestaña, volvía,
  // cerraba y abría —que es lo que cualquiera hace para actualizar— y seguía
  // viendo la lista vieja, sin más salida que recargar la pantalla entera.
  // Se avisa al árbol, como hace cada carpeta, para que el buscador no lo
  // esconda mientras se busca algo de adentro.
  async function alternar() {
    if (abierto) {
      setAbierto(false);
      marcarAbierta(cliente.id, false);
      return;
    }
    setAbierto(true);
    marcarAbierta(cliente.id, true);
    await traer();
  }

  return (
    <li className="border-b border-linea">
      <Fila
        nivel={0}
        atenuada={apagado}
        abridor={
          <Abridor
            abierto={abierto}
            onAbrir={alternar}
            cargando={cargando}
            etiqueta={`Ver las carpetas de ${cliente.nombre}`}
          />
        }
        drive={<EnDrive href={cliente.enlaceDrive} que="la carpeta del cliente" />}
        config={
          <BotonDeConfig
            abierta={config}
            onTocar={() => alternarConfig(cliente.id)}
            que={cliente.nombre}
            de={cliente.id}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* **El nombre lleva a su ficha.** La ficha existía —los números de
              la cuenta, los mensajes listos, el chat, el portal como lo ve el
              cliente— y no había un solo link que llevara a ella: se llegaba
              escribiendo la dirección a mano. La flecha de la izquierda sigue
              abriendo el árbol acá mismo, que es lo otro que se quiere. */}
          <h3 className={`text-guia font-bold tracking-tight ${apagado ? "text-apagado" : ""}`}>
            <Link
              href={`/gestion/cliente/${cliente.id}`}
              className="underline decoration-linea underline-offset-4 transition-colors
                         hover:text-acento hover:decoration-acento"
            >
              {cliente.nombre}
            </Link>
          </h3>
          {apagado && (
            <span className="bg-tinta px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-lienzo">
              Sin acceso
            </span>
          )}
          {!apagado && sinClave && (
            <span className="bg-espera-borde px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-tinta">
              Falta la clave
            </span>
          )}
          <MensajesSinLeer cuantos={cliente.sinLeer} clienteId={cliente.id} />
        </div>
        <p className="mt-0.5 text-menudo text-apagado">
          {/* **«2 de 2 carpetas visibles» no dice nada**: los dos números
              coinciden casi siempre, y cuando coinciden la frase pide leer dos
              cifras para enterarse de que no pasa nada. Solo se escribe la
              resta cuando hay algo escondido, que es cuando importa. */}
          {apagado
            ? "Oculto"
            : cliente.carpetasVisibles === cliente.carpetas
              ? `${cliente.carpetas} ${cliente.carpetas === 1 ? "carpeta" : "carpetas"}`
              : `${cliente.carpetasVisibles} de ${cliente.carpetas} ${
                  cliente.carpetas === 1 ? "carpeta visible" : "carpetas visibles"
                }`}
          {/* Si vio el link. Después de entregar, «no lo abrió» y «lo abrió y
              no decidió» piden mensajes distintos. */}
          {!apagado &&
            (cliente.ultimaVisita
              ? ` · entró al portal ${haceCuanto(cliente.ultimaVisita)}`
              : " · nunca entró al portal")}
        </p>
      </Fila>

      {config && (
        <Panel nivel={0} de={cliente.id}>
          <ConfiguracionDeCliente
            cliente={cliente}
            equipo={equipo}
            alGuardar={refrescar}
          />
        </Panel>
      )}

      {abierto && (
        <div className="border-t border-linea-tenue">
          {error && (
            <p className="px-4 py-3 text-menudo font-semibold text-alerta">{error}</p>
          )}
          {contenido && (
            <Abierta.Provider value={contextoAdentro}>
              <Adentro
                contenido={contenido}
                nivel={1}
                clienteId={cliente.id}
                carpetaId={cliente.id}
                equipo={equipo}
                alGuardar={traer}
                vacio="Este cliente no tiene nada adentro todavía."
              />
            </Abierta.Provider>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Lo que hay dentro de algo: primero las carpetas, después los archivos.
 *
 * Es el mismo bloque para el cliente y para cualquier subcarpeta, a cualquier
 * profundidad. Tener un componente para «las carpetas del cliente» y otro para
 * «los archivos de una carpeta» es lo que dejó el árbol clavado en dos niveles
 * mientras en Drive había más.
 *
 * Las carpetas van arriba porque son caminos y los archivos son destinos:
 * mezclados, hay que leer cada renglón para saber en qué se puede entrar.
 */
function Adentro({
  contenido,
  nivel,
  clienteId,
  carpetaId,
  equipo,
  alGuardar,
  vacio,
}: {
  contenido: Contenido;
  nivel: number;
  /**
   * De qué **cliente** es todo esto.
   *
   * **Separado de la carpeta que lo contiene, y por eso.** Era una sola
   * propiedad que servía para las dos cosas, y en el primer nivel coinciden
   * —la carpeta que contiene es la del cliente—, así que el error no se veía.
   * Del segundo nivel para abajo se le pasaba `carpeta.id`: el enlace «armar el
   * calendario» quedaba armado con un identificador de carpeta donde va el del
   * cliente, y llevaba a «No encontré ese cliente».
   */
  clienteId: string;
  /** La carpeta que contiene esto: es la que necesita configurar una pieza. */
  carpetaId: string;
  equipo: Persona[];
  alGuardar: () => void;
  vacio: string;
}) {
  const { busqueda, abiertas } = useContext(Abierta);
  // Con algo escrito en el buscador, solo lo que se llama así. Una carpeta
  // cerrada que no coincide se esconde entera: lo de adentro no se cargó
  // todavía. **Una abierta se deja pasar**: ya trajo su contenido, y esconderla
  // escondía también el archivo que se estaba buscando.
  const carpetas = contenido.carpetas.filter(
    (c) => coincide(c.nombre, busqueda) || abiertas.has(c.id)
  );
  const archivos = contenido.archivos.filter((a) => coincide(a.nombreCompleto, busqueda));
  const pendientes = contenido.pendientes.filter((p) => coincide(p.nombre, busqueda));

  if (
    contenido.carpetas.length === 0 &&
    contenido.archivos.length === 0 &&
    contenido.pendientes.length === 0
  ) {
    return <p className="px-4 py-3 text-menudo text-apagado">{vacio}</p>;
  }
  if (carpetas.length === 0 && archivos.length === 0 && pendientes.length === 0) {
    return <p className="px-4 py-3 text-menudo text-apagado">Nada acá se llama así.</p>;
  }

  return (
    <ul>
      {carpetas.map((carpeta) => (
        <FilaCarpeta
          key={carpeta.id}
          carpeta={carpeta}
          nivel={nivel}
          clienteId={clienteId}
          equipo={equipo}
          alGuardar={alGuardar}
        />
      ))}
      {archivos.map((archivo) => (
        <FilaArchivo
          key={archivo.id}
          archivo={archivo}
          nivel={nivel}
          carpetaId={carpetaId}
          equipo={equipo}
          alGuardar={alGuardar}
        />
      ))}
      {/* Las vueltas que nadie asignó, al final: no son parte de ningún
          trabajo hasta que alguien diga de cuál. */}
      {pendientes.map((pendiente) => (
        <li key={pendiente.id} className="border-t border-linea-tenue">
          <Fila
            nivel={nivel}
            abridor={<Hueco />}
            drive={<EnDrive href={pendiente.enlaceDrive} que="el archivo" />}
            config={null}
          >
            <VueltaSinAsignar
              carpetaId={carpetaId}
              pendiente={pendiente}
              trabajos={contenido.archivos.map((a) => ({ id: a.id, nombre: a.nombre }))}
              alAsignar={alGuardar}
            />
          </Fila>
        </li>
      ))}
    </ul>
  );
}

function FilaCarpeta({
  carpeta,
  nivel,
  clienteId,
  equipo,
  alGuardar,
}: {
  carpeta: NodoCarpeta;
  nivel: number;
  clienteId: string;
  equipo: Persona[];
  alGuardar: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const { cual, alternarConfig, marcarAbierta } = useContext(Abierta);
  const enTrabajo = useContext(EnTrabajo);
  const config = cual === carpeta.id;
  const [contenido, setContenido] = useState<Contenido | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // «Facturas» no se le muestra al cliente nunca y no tiene interruptor, así
  // que decir «oculta» ahí sería ruido. «Entregas finales» sí: se puede
  // apagar como cualquier otra cosa, y si está apagada hay que verlo.
  const oculta = !carpeta.visible && !carpeta.deFacturas;

  const traer = useCallback(async () => {
    setCargando(true);
    try {
      // Se le pasa lo que corre en esta carpeta: es lo que sus hijos heredan.
      // Así la herencia baja escalón por escalón, sin importar cuántos haya.
      const r = await abrirCarpeta(carpeta.id, {
        dias: carpeta.diasQueCorren,
        responsable: carpeta.responsableQueCorre,
      });
      if (r.ok) {
        setContenido(r.contenido);
        setError(null);
      } else {
        setError(r.motivo);
      }
    } catch {
      setError("No pude leer la carpeta.");
    } finally {
      setCargando(false);
    }
  }, [carpeta.id, carpeta.diasQueCorren, carpeta.responsableQueCorre]);

  // **Se vuelve a leer al abrir**, y se avisa al árbol para que el buscador
  // no la esconda. Se traía una sola vez: cerrar y abrir —que es lo que
  // cualquiera hace para actualizar— devolvía la misma lista vieja.
  async function alternar() {
    if (abierta) {
      setAbierta(false);
      marcarAbierta(carpeta.id, false);
      return;
    }
    setAbierta(true);
    marcarAbierta(carpeta.id, true);
    await traer();
  }

  return (
    <li className="border-t border-linea-tenue">
      <Fila
        nivel={nivel}
        atenuada={oculta}
        abridor={
          <Abridor
            abierto={abierta}
            onAbrir={alternar}
            cargando={cargando}
            etiqueta={`Ver lo que hay en ${carpeta.nombre}`}
          />
        }
        drive={<EnDrive href={carpeta.enlaceDrive} que="la carpeta" />}
        config={
          <BotonDeConfig
            abierta={config}
            onTocar={() => alternarConfig(carpeta.id)}
            que={carpeta.nombre}
            de={carpeta.id}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* **El nombre también abre.** Había que acertarle a la flecha de 36
              píxeles: el nombre es el objetivo grande y obvio de la fila, y no
              hacía nada. La flecha sigue estando para quien ya la usa. */}
          <button
            type="button"
            onClick={alternar}
            aria-expanded={abierta}
            className={`text-left font-bold tracking-tight underline decoration-transparent
                        underline-offset-4 transition-colors hover:decoration-linea ${
                          oculta ? "text-apagado" : ""
                        }`}
          >
            {carpeta.nombre}
          </button>
          {carpeta.reservada && (
            <span className="bg-hueco px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-apagado">
              Reservada
            </span>
          )}
          {oculta && (
            <span className="bg-tinta px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-lienzo">
              Oculta
            </span>
          )}
          {CALENDARIO_ACTIVO && carpeta.vista === "calendario" && !oculta && !carpeta.reservada && (
            <span className="bg-acento-tenue px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-acento">
              Calendario
            </span>
          )}

        </div>

        <p className="mt-0.5 text-menudo text-apagado">
          {carpeta.reservada ? (
            // **Son dos carpetas distintas y decían lo mismo.** «Facturas»
            // aparecía descrita como la de entregas finales: la carpeta que el
            // cliente no ve nunca, explicada como el lugar donde se sube lo
            // terminado para que la vea.
            null
          ) : (
            <>
              {carpeta.subcarpetas > 0 && (
                <>
                  {carpeta.subcarpetas}{" "}
                  {carpeta.subcarpetas === 1 ? "carpeta" : "carpetas"} ·{" "}
                </>
              )}
              {/* En juego, no el total: una pieza aprobada ya no espera a
                  nadie, y contarla acá hacía que una carpeta con una sola cosa
                  pendiente dijera «2 piezas». Cuando no queda nada en juego se
                  dice así y no «0 piezas en juego», que es la misma frase
                  puesta al revés y se lee peor. */}
              {carpeta.enJuego === 0 ? (
                carpeta.piezas === 0 ? (
                  "sin piezas"
                ) : (
                  <>
                    todo aprobado · {carpeta.piezas}{" "}
                    {carpeta.piezas === 1 ? "pieza" : "piezas"}
                  </>
                )
              ) : (
                <>
                  {carpeta.enJuego} {carpeta.enJuego === 1 ? "pieza" : "piezas"} en juego
                  {carpeta.sinEntregar > 0 && (
                    <span className="font-bold text-acento">
                      {" · "}
                      {carpeta.sinEntregar} sin entregar
                    </span>
                  )}
                  {/* **«Esperando al cliente», que es lo que quiere decir.**
                      Decía «N sin revisar», que del lado de la agencia se lee
                      al revés: parece trabajo propio pendiente cuando es
                      exactamente lo contrario. Es la frase que ya usa el
                      tablero para el mismo conjunto de piezas. */}
                  {" · "}
                  {carpeta.sinRevisar} esperando al cliente
                  {carpeta.terminadas > 0 &&
                    ` · ${carpeta.terminadas} aprobada${
                      carpeta.terminadas === 1 ? "" : "s"
                    }`}
                  {/* **El plazo, solo donde describe algo que está pasando.**
                      Se escribía siempre: una carpeta vacía y una con todo
                      aprobado decían «7 días de revisión» sobre nada. */}
                  {" · "}
                  {carpeta.diasQueCorren}{" "}
                  {carpeta.diasQueCorren === 1 ? "día" : "días"} de revisión
                </>
              )}
              {/* Quién la lleva, y nada cuando no la lleva nadie: «sin
                  asignar» repetido en cada fila es una ausencia dibujada
                  veinte veces. */}
              {carpeta.responsableA && ` · ${carpeta.responsableA}`}
            </>
          )}
          {/* **A la pantalla de la carpeta desde acá.** El enlace vivía al
              fondo de lo que hay adentro: para llegar había que abrir la
              sección, el cliente, la carpeta, y bajar hasta el último renglón
              —cuatro toques y un desplazamiento— para algo que no depende de
              lo que haya adentro. Y ahí están las dos cosas que solo se
              pueden hacer ahí: ponerle fechas y ver qué pasó con cada pieza. */}
          {!carpeta.reservada && !oculta && (
            <>
              {" · "}
              <Link
                href={`/gestion/cliente/${clienteId}/carpeta/${carpeta.id}?desde=clientes`}
                className="font-bold text-acento underline underline-offset-4"
              >
                Ver la carpeta
              </Link>
            </>
          )}
        </p>
      </Fila>

      {config && (
        <Panel nivel={nivel} de={carpeta.id}>
          {carpeta.reservada ? (
            <ConfiguracionDeReservada carpeta={carpeta} alGuardar={alGuardar} />
          ) : (
            <ConfiguracionDeCarpeta
              carpeta={carpeta}
              equipo={equipo}
              alGuardar={alGuardar}
            />
          )}
        </Panel>
      )}

      {abierta && (
        <div className="border-t border-linea-tenue">
          {/* Arriba de todo: lo que hay que hacer con esta carpeta va antes
              que lo que hay adentro. */}
          {/* El bloque lo dibuja «Entregar», no esto: al entregar lo último,
              `sinEntregar` baja a cero y esta condición se lo llevaba puesto
              con el mensaje para el cliente adentro. */}
          {!carpeta.reservada && (
            <Entregar
              carpetaId={carpeta.id}
              carpeta={carpeta.nombre}
              cuantas={carpeta.sinEntregar}
              dias={carpeta.diasQueCorren}
              sangria={nivel * SANGRIA + 44}
              // **Los dos.** El propio vuelve a leer los archivos de esta
              // carpeta —si no, los renglones de abajo siguen diciendo «falta
              // entregar» sobre lo que se acaba de entregar— y el del padre
              // actualiza el encabezado, que cuenta las que faltan.
              alEntregar={() => {
                traer();
                alGuardar();
              }}
            />
          )}

          {error && (
            <p className="px-4 py-2 text-menudo font-semibold text-alerta">{error}</p>
          )}
          {contenido && (
            // **La contenedora cambia en cada nivel; el trabajo no.** Una
            // subcarpeta sigue siendo parte del mismo trabajo —eso da el
            // rótulo— pero las piezas que hay que listar son las suyas.
            <EnTrabajo.Provider
              value={{
                contenedora: carpeta,
                trabajo: nivel === 1 ? carpeta : (enTrabajo?.trabajo ?? carpeta),
                clienteId,
              }}
            >
              <Adentro
                contenido={contenido}
                nivel={nivel + 1}
                clienteId={clienteId}
                carpetaId={carpeta.id}
                equipo={equipo}
                alGuardar={traer}
                vacio="Esta carpeta está vacía."
              />
            </EnTrabajo.Provider>
          )}

        </div>
      )}
    </li>
  );
}

/**
 * La configuración de una carpeta reservada.
 *
 * No se configura como un trabajo —no lo es— pero **«Entregas finales» sí se
 * muestra o se esconde**, como cualquier otra cosa del cliente. Faltaba, y era
 * un agujero raro: la carpeta donde termina todo lo aprobado era lo único del
 * portal que la agencia no podía apagar.
 *
 * «Facturas» no lleva interruptor porque no tiene opción: es de la agencia y
 * al cliente no se le muestra nunca. Un botón que no puede cambiar nada es
 * peor que no tenerlo.
 */
function ConfiguracionDeReservada({
  carpeta,
  alGuardar,
}: {
  carpeta: NodoCarpeta;
  alGuardar: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {!carpeta.deFacturas && (
        <Visibilidad
          ids={[carpeta.id]}
          visible={carpeta.visible}
          que="carpeta"
          alGuardar={alGuardar}
        />
      )}

      {/* **Lo que le falta al panel, no lo que ya está en la fila.** Era un
          «Abrirla en Drive» que repetía exactamente el botón de Drive de la
          fila de al lado: se tocaba el engranaje esperando algo que
          configurar y salía el mismo botón de nuevo. Lo que hacía falta era
          la frase que explica por qué acá no hay nada que configurar. */}
    </div>
  );
}

function FilaArchivo({
  archivo,
  nivel,
  carpetaId,
  equipo,
  alGuardar,
}: {
  archivo: NodoArchivo;
  nivel: number;
  carpetaId: string;
  equipo: Persona[];
  alGuardar: () => void;
}) {
  const { cual, alternarConfig, mirar } = useContext(Abierta);
  const enTrabajo = useContext(EnTrabajo);
  const config = cual === archivo.id;

  return (
    <li className="border-t border-linea-tenue">
      <Fila
        nivel={nivel}
        atenuada={!archivo.visible}
        abridor={<Hueco />}
        drive={<EnDrive href={archivo.enlaceDrive} que="el archivo" />}
        config={
          <BotonDeConfig
            abierta={config}
            onTocar={() => alternarConfig(archivo.id)}
            que={archivo.nombre}
            de={archivo.id}
          />
        }
      >
        {/*
          **El nombre solo, en su renglón.** Compartía la línea con el estado,
          la vuelta y «oculto», y con eso el nombre —que es lo que se viene a
          buscar— quedaba como una etiqueta más entre cuatro. Ahora arriba va
          el nombre y nada más, y todo lo que lo describe baja al renglón de
          abajo, que es donde ya estaban los días y quién lo lleva.

          **Y el nombre de verdad, el de Drive.** Decía «stickers» donde el
          archivo se llama «V2_stickers.pdf»: quien lo lee acá y después lo
          busca en Drive tiene que adivinar cuál es.

          El nombre abre la pieza. Es lo que más se quiere del árbol y no
          estaba: la flecha muestra qué hay adentro y el engranaje qué se puede
          cambiar, pero para *ver* el trabajo había que irse al tablero.
          Subrayado desde el principio, porque sin eso se lee como texto y
          nadie lo toca.
        */}
        {enTrabajo ? (
          <button
            type="button"
            onClick={() =>
              mirar(
                enTrabajo.contenedora,
                enTrabajo.trabajo,
                enTrabajo.clienteId,
                archivo.id
              )
            }
            title={`Ver ${archivo.nombreCompleto}`}
            className={`block max-w-full truncate text-left text-normal font-bold
                        tracking-tight underline decoration-linea underline-offset-4
                        transition-colors hover:text-acento hover:decoration-acento
                        focus-visible:outline-2 focus-visible:outline-acento ${
                          archivo.visible ? "" : "text-apagado"
                        }`}
          >
            {archivo.nombreCompleto}
          </button>
        ) : (
          <span
            className={`block max-w-full truncate text-normal font-bold tracking-tight ${
              archivo.visible ? "" : "text-apagado"
            }`}
          >
            {archivo.nombreCompleto}
          </span>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Estado estado={archivo.estado} mirada="agencia" />
          {!archivo.visible && (
            <span className="bg-tinta px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-lienzo">
              Oculto
            </span>
          )}
          {archivo.mudada && (
            <span className="text-micro font-extrabold uppercase tracking-wider text-apagado">
              en finales
            </span>
          )}
          {/* **Las dos alertas dicen qué hacer, en la fila.** Lo explicaban en
              un `title`, o sea solo si alguien dejaba el mouse quieto encima:
              en el teléfono no aparece nunca, y en la computadora hay que
              adivinar que está. Aparecen poquísimas veces —son anomalías— así
              que el renglón de más no cuesta nada cuando no están, y cuando
              están es justo lo que hace falta leer. */}
          {archivo.comparteNombre && (
            <span className="bg-alerta-tenue px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-alerta">
              nombre repetido
            </span>
          )}
          {archivo.vueltaAtrasada && (
            <span className="bg-alerta-tenue px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-alerta">
              vuelta atrasada
            </span>
          )}
          {archivo.entregadoPerdido && (
            <span className="bg-alerta-tenue px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-alerta">
              falta lo entregado
            </span>
          )}
          {archivo.vueltaRepetida && (
            <span className="bg-alerta-tenue px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-alerta">
              vuelta repetida
            </span>
          )}
          {archivo.saltoDeVuelta && (
            <span className="bg-alerta-tenue px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-alerta">
              número raro
            </span>
          )}
          {/* **Lo que corre, y nada más.** El renglón decía las dos cuentas a
              la vez —«7 días · vence el 20 sept»— y son la misma: el plazo es
              con lo que se calcula el vencimiento. Mientras la pieza está de
              nuestro lado lo que importa es qué plazo le va a tocar al cliente;
              cuando ya es de él, la fecha. Y «sin asignar» se dibujaba en cada
              fila que no tuviera responsable: lo que hay que ver es quién la
              lleva, no la ausencia repetida veinte veces. */}
          <span className="text-micro text-apagado">
            {/* **La vuelta que dice el archivo, no cuántos archivos hay.** Con
                «V1», «V2», «V4» y «V6» en Drive son cuatro archivos y la vuelta
                seis: el renglón decía «v4» al lado de «V6_stickers.jpeg». */}
            {archivo.version > 1 && `v${archivo.version} · `}
            {/* **Y el reloj solo mientras haya un reloj.** Una pieza aprobada o
                caída no vence: decía «vence el 11 oct» debajo de la pastilla
                «Aprobada», que es una fecha que ya no va a pasar nada. */}
            {sigueEnJuego(archivo.estado) &&
              (laTenemosNosotros(archivo.estado) || !archivo.vence
                ? `${archivo.diasQueCorren} ${archivo.diasQueCorren === 1 ? "día" : "días"} de revisión · `
                : `vence el ${enPalabrasElDia(archivo.vence)} · `)}
            {archivo.publicaEl && `${cuandoSePublica(archivo.publicaEl)} · `}
            {archivo.responsableA}
          </span>
        </div>

        {/* La explicación de la alerta, cuando la hay. */}
        {archivo.comparteNombre && (
          <p className="mt-1 text-micro text-alerta">
            Hay otro trabajo que se llama «{archivo.nombre}».
          </p>
        )}
        {archivo.vueltaAtrasada && (
          <p className="mt-1 text-micro text-alerta">
            Se subió «{archivo.vueltaAtrasada.subida}» pero se muestra «{archivo.vueltaAtrasada.actual}».
          </p>
        )}
        <RarezasDeNombres archivo={archivo} clase="mt-1 text-micro text-alerta" />
      </Fila>

      {config && (
        <Panel nivel={nivel} de={archivo.id}>
          <ConfiguracionDeArchivo
            archivo={archivo}
            carpetaId={carpetaId}
            equipo={equipo}
            alGuardar={alGuardar}
          />
        </Panel>
      )}
    </li>
  );
}
