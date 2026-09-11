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

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { abrirCarpeta, abrirCliente } from "@/app/(admin)/gestion/acciones";
import type { Contenido, NodoArchivo, NodoCarpeta } from "@/admin/datos/arbol";
import type { ClienteEnGestion } from "@/admin/datos/carpetas";
import type { Persona } from "@/lib/equipo";
import { ConfiguracionDeCliente } from "@/admin/ConfiguracionDeCliente";
import { ConfiguracionDeCarpeta } from "@/admin/ConfiguracionDeCarpeta";
import { ConfiguracionDeArchivo } from "@/admin/ConfiguracionDeArchivo";
import { Estado } from "@/ui/Estado";
import { IconoConfig, IconoDrive, IconoFlecha } from "@/ui/Icono";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const comoFecha = (dia: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  return fecha.format(new Date(a, m - 1, d));
};

/** Cuánto se corre cada nivel del árbol, en píxeles. */
const SANGRIA = 22;

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
}>({ cual: null, alternarConfig: () => {} });

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
      className={`grid h-9 w-9 shrink-0 place-items-center transition-colors ${
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
}: {
  clientes: ClienteEnGestion[];
  equipo: Persona[];
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

  const contexto = useMemo(
    () => ({
      cual,
      // Tocar la que ya está abierta la cierra; tocar otra cambia de una a la
      // otra, sin dejar las dos abiertas.
      alternarConfig: (id: string) => setCual((antes) => (antes === id ? null : id)),
    }),
    [cual]
  );

  return (
    <Abierta.Provider value={contexto}>
      <ul className="border-t border-linea">
        {clientes.map((cliente) => (
          <FilaCliente key={cliente.id} cliente={cliente} equipo={equipo} />
        ))}
      </ul>
    </Abierta.Provider>
  );
}

function FilaCliente({
  cliente,
  equipo,
}: {
  cliente: ClienteEnGestion;
  equipo: Persona[];
}) {
  const [abierto, setAbierto] = useState(false);
  const { cual, alternarConfig } = useContext(Abierta);
  const config = cual === cliente.id;
  const [contenido, setContenido] = useState<Contenido | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apagado = !cliente.habilitado;
  const sinClave = !cliente.tieneClave;

  const traer = useCallback(async () => {
    setCargando(true);
    try {
      const r = await abrirCliente(cliente.id);
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
  }, [cliente.id]);

  /**
   * Guardar cambia lo que dice la fila —«oculta», «calendario», quién la
   * lleva—. Si no se vuelve a pedir, el cartel sigue mostrando lo viejo y
   * parece que el cambio no se guardó.
   */
  const refrescar = useCallback(() => {
    if (contenido) traer();
  }, [contenido, traer]);

  async function alternar() {
    if (abierto) {
      setAbierto(false);
      return;
    }
    setAbierto(true);
    if (!contenido) await traer();
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
          <h3
            className={`text-guia font-bold tracking-tight ${apagado ? "text-apagado" : ""}`}
          >
            {cliente.nombre}
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
          {cliente.sinLeer > 0 && (
            <span className="bg-acento px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-white">
              {cliente.sinLeer} sin leer
            </span>
          )}
        </div>
        <p className="mt-0.5 text-menudo text-apagado">
          {apagado
            ? "El robot ve su carpeta, pero el portal no la muestra."
            : `${cliente.carpetasVisibles} de ${cliente.carpetas} ${
                cliente.carpetas === 1 ? "carpeta visible" : "carpetas visibles"
              }`}
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
            <Adentro
              contenido={contenido}
              nivel={1}
              clienteId={cliente.id}
              equipo={equipo}
              alGuardar={traer}
              vacio="Este cliente no tiene nada adentro todavía."
            />
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
  equipo,
  alGuardar,
  vacio,
}: {
  contenido: Contenido;
  nivel: number;
  clienteId: string;
  equipo: Persona[];
  alGuardar: () => void;
  vacio: string;
}) {
  const { carpetas, archivos } = contenido;

  if (carpetas.length === 0 && archivos.length === 0) {
    return <p className="px-4 py-3 text-menudo text-apagado">{vacio}</p>;
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
          carpetaId={clienteId}
          equipo={equipo}
          alGuardar={alGuardar}
        />
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
  const { cual, alternarConfig } = useContext(Abierta);
  const config = cual === carpeta.id;
  const [contenido, setContenido] = useState<Contenido | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oculta = !carpeta.visible && !carpeta.reservada;

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

  async function alternar() {
    if (abierta) {
      setAbierta(false);
      return;
    }
    setAbierta(true);
    if (!contenido) await traer();
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
          <span className={`font-bold tracking-tight ${oculta ? "text-apagado" : ""}`}>
            {carpeta.nombre}
          </span>
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
          {carpeta.vista === "calendario" && !oculta && !carpeta.reservada && (
            <span className="bg-acento-tenue px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-acento">
              Calendario
            </span>
          )}

        </div>

        <p className="mt-0.5 text-menudo text-apagado">
          {carpeta.reservada ? (
            "Acá se mueve lo aprobado."
          ) : (
            <>
              {carpeta.subcarpetas > 0 && (
                <>
                  {carpeta.subcarpetas}{" "}
                  {carpeta.subcarpetas === 1 ? "carpeta" : "carpetas"} ·{" "}
                </>
              )}
              {carpeta.piezas} {carpeta.piezas === 1 ? "pieza" : "piezas"} ·{" "}
              {carpeta.sinRevisar} sin revisar · {carpeta.diasQueCorren}{" "}
              {carpeta.diasQueCorren === 1 ? "día" : "días"} para revisar
              {carpeta.responsableA ? ` · ${carpeta.responsableA}` : " · sin asignar"}
            </>
          )}
        </p>
      </Fila>

      {config && (
        <Panel nivel={nivel} de={carpeta.id}>
          {carpeta.reservada ? (
            <ConfiguracionDeReservada carpeta={carpeta} />
          ) : (
            <ConfiguracionDeCarpeta
              carpeta={carpeta}
              clienteId={clienteId}
              equipo={equipo}
              alGuardar={alGuardar}
            />
          )}
        </Panel>
      )}

      {abierta && (
        <div className="border-t border-linea-tenue">
          {error && (
            <p className="px-4 py-2 text-menudo font-semibold text-alerta">{error}</p>
          )}
          {contenido && (
            <Adentro
              contenido={contenido}
              nivel={nivel + 1}
              clienteId={carpeta.id}
              equipo={equipo}
              alGuardar={traer}
              vacio="Esta carpeta está vacía."
            />
          )}

          {carpeta.vista === "calendario" && !carpeta.reservada && (
            <div
              className="border-t border-linea-tenue py-2"
              style={{ paddingLeft: (nivel + 1) * SANGRIA + 44 }}
            >
              <Link
                href={`/gestion/cliente/${clienteId}/carpeta/${carpeta.id}`}
                className="text-menudo font-bold text-acento underline underline-offset-4"
              >
                Armar el calendario de {carpeta.nombre} →
              </Link>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * La configuración de una carpeta reservada.
 *
 * No se configura nada —no es un trabajo— pero el engranaje está igual, porque
 * una columna donde algunos botones faltan se lee como rota. Adentro va lo
 * único que hay: el link a Drive y por qué no hay nada más.
 */
function ConfiguracionDeReservada({ carpeta }: { carpeta: NodoCarpeta }) {
  return (
    <div>
      <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
        Carpeta con nombre reservado
      </h4>
      {carpeta.enlaceDrive && (
        <a
          href={carpeta.enlaceDrive}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex min-h-toque items-center gap-2 border-2 border-tinta px-4
                     text-menudo font-bold tracking-tight text-tinta transition-colors hover:bg-hueco"
        >
          <IconoDrive />
          Abrirla en Drive
        </a>
      )}
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
  const { cual, alternarConfig } = useContext(Abierta);
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
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`truncate text-normal ${archivo.visible ? "" : "text-apagado"}`}
          >
            {archivo.nombre}
          </span>
          <Estado estado={archivo.estado} />
          {!archivo.visible && (
            <span className="bg-tinta px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-lienzo">
              Oculto
            </span>
          )}
          {archivo.vueltas > 1 && (
            <span className="text-micro font-extrabold uppercase tracking-wider text-apagado">
              v{archivo.vueltas}
            </span>
          )}
          {archivo.mudada && (
            <span className="text-micro font-extrabold uppercase tracking-wider text-apagado">
              en finales
            </span>
          )}
        </div>
        <p className="mt-0.5 text-micro text-apagado">
          {archivo.diasQueCorren} {archivo.diasQueCorren === 1 ? "día" : "días"}
          {archivo.vence && ` · vence el ${comoFecha(archivo.vence)}`}
          {archivo.publicaEl && ` · sale el ${comoFecha(archivo.publicaEl)}`}
          {archivo.responsableA ? ` · ${archivo.responsableA}` : " · sin asignar"}
        </p>
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
