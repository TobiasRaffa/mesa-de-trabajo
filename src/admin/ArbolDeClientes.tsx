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

import { useCallback, useState } from "react";
import Link from "next/link";
import { abrirCarpeta, abrirCliente } from "@/app/(admin)/gestion/acciones";
import type { NodoArchivo, NodoCarpeta } from "@/admin/datos/arbol";
import type { ClienteEnGestion } from "@/admin/datos/carpetas";
import type { Persona } from "@/lib/equipo";
import { ConfiguracionDeCliente } from "@/admin/ConfiguracionDeCliente";
import { ConfiguracionDeCarpeta } from "@/admin/ConfiguracionDeCarpeta";
import { Estado } from "@/ui/Estado";
import { IconoConfig, IconoDrive, IconoFlecha } from "@/ui/Icono";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const comoFecha = (dia: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  return fecha.format(new Date(a, m - 1, d));
};

/** Cuánto se corre cada nivel del árbol, en píxeles. */
const SANGRIA = 22;

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
}: {
  abierta: boolean;
  onTocar: () => void;
  que: string;
}) {
  return (
    <button
      type="button"
      onClick={onTocar}
      aria-expanded={abierta}
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
function Panel({ nivel, children }: { nivel: number; children: React.ReactNode }) {
  return (
    <div
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
  return (
    <ul className="border-t border-linea">
      {clientes.map((cliente) => (
        <FilaCliente key={cliente.id} cliente={cliente} equipo={equipo} />
      ))}
    </ul>
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
  const [config, setConfig] = useState(false);
  const [carpetas, setCarpetas] = useState<NodoCarpeta[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apagado = !cliente.habilitado;
  const sinClave = !cliente.tieneClave;

  const traer = useCallback(async () => {
    setCargando(true);
    try {
      const r = await abrirCliente(cliente.id);
      if (r.ok) {
        setCarpetas(r.carpetas);
        setError(null);
      } else {
        setError(r.motivo);
      }
    } catch {
      setError("No pude leer las carpetas.");
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
    if (carpetas) traer();
  }, [carpetas, traer]);

  async function alternar() {
    if (abierto) {
      setAbierto(false);
      return;
    }
    setAbierto(true);
    if (!carpetas) await traer();
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
            onTocar={() => setConfig(!config)}
            que={cliente.nombre}
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
        <Panel nivel={0}>
          <ConfiguracionDeCliente cliente={cliente} alGuardar={refrescar} />
        </Panel>
      )}

      {abierto && (
        <div className="border-t border-linea-tenue">
          {error && (
            <p className="px-4 py-3 text-menudo font-semibold text-alerta">{error}</p>
          )}
          {carpetas && carpetas.length === 0 && (
            <p className="px-4 py-3 text-menudo text-apagado">
              Este cliente no tiene ninguna carpeta adentro todavía.
            </p>
          )}
          {carpetas && carpetas.length > 0 && (
            <ul>
              {carpetas.map((carpeta) => (
                <FilaCarpeta
                  key={carpeta.id}
                  carpeta={carpeta}
                  clienteId={cliente.id}
                  equipo={equipo}
                  alGuardar={traer}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function FilaCarpeta({
  carpeta,
  clienteId,
  equipo,
  alGuardar,
}: {
  carpeta: NodoCarpeta;
  clienteId: string;
  equipo: Persona[];
  alGuardar: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [config, setConfig] = useState(false);
  const [archivos, setArchivos] = useState<NodoArchivo[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oculta = !carpeta.visible && !carpeta.reservada;

  async function alternar() {
    if (abierta) {
      setAbierta(false);
      return;
    }
    setAbierta(true);
    if (archivos) return;

    setCargando(true);
    try {
      const r = await abrirCarpeta(carpeta.id, carpeta.diasQueCorren);
      if (r.ok) setArchivos(r.archivos);
      else setError(r.motivo);
    } catch {
      setError("No pude leer los archivos.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <li className="border-t border-linea-tenue">
      <Fila
        nivel={1}
        atenuada={oculta}
        abridor={
          <Abridor
            abierto={abierta}
            onAbrir={alternar}
            cargando={cargando}
            etiqueta={`Ver los archivos de ${carpeta.nombre}`}
          />
        }
        drive={<EnDrive href={carpeta.enlaceDrive} que="la carpeta" />}
        config={
          <BotonDeConfig
            abierta={config}
            onTocar={() => setConfig(!config)}
            que={carpeta.nombre}
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
              {carpeta.piezas} {carpeta.piezas === 1 ? "pieza" : "piezas"} ·{" "}
              {carpeta.sinRevisar} sin revisar · {carpeta.diasQueCorren}{" "}
              {carpeta.diasQueCorren === 1 ? "día" : "días"} para revisar
              {carpeta.asignadaA ? ` · ${carpeta.asignadaA}` : " · sin asignar"}
            </>
          )}
        </p>
      </Fila>

      {config && (
        <Panel nivel={1}>
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
          {archivos && archivos.length === 0 && (
            <p className="px-4 py-2 text-menudo text-apagado">
              No hay archivos en esta carpeta.
            </p>
          )}
          {archivos && archivos.length > 0 && (
            <ul>
              {archivos.map((archivo) => (
                <li key={archivo.id} className="border-t border-linea-tenue">
                  <Fila
                    nivel={2}
                    abridor={<Hueco />}
                    drive={<EnDrive href={archivo.enlaceDrive} que="el archivo" />}
                    config={<Hueco />}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-normal">{archivo.nombre}</span>
                      <Estado estado={archivo.estado} />
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
                      {archivo.diasQueCorren}{" "}
                      {archivo.diasQueCorren === 1 ? "día" : "días"}
                      {archivo.vence && ` · vence el ${comoFecha(archivo.vence)}`}
                      {archivo.publicaEl && ` · sale el ${comoFecha(archivo.publicaEl)}`}
                    </p>
                  </Fila>
                </li>
              ))}
            </ul>
          )}

          {carpeta.vista === "calendario" && !carpeta.reservada && (
            <div
              className="border-t border-linea-tenue py-2"
              style={{ paddingLeft: 2 * SANGRIA + 44 }}
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
