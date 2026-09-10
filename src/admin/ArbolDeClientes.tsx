"use client";

// Los clientes, como un árbol que se abre.
//
// La forma imita la de Drive porque **es** la de Drive: cliente, sus carpetas,
// los archivos de cada una. Quien la usa ya tiene ese mapa en la cabeza.
//
// Dos decisiones sobre cómo se abre:
//
//   1. **Cada nivel se pide al abrirlo.** Leer de Drive todos los archivos de
//      todos los clientes para dibujar una lista cerrada sería pagar por
//      adelantado algo que casi nunca se mira.
//
//   2. **La configuración está aparte de la navegación.** Abrir una fila
//      muestra qué hay adentro; el botón de configuración muestra qué se puede
//      cambiar. Mezclarlos hacía que buscar un archivo obligara a pasar por
//      encima de los botones que apagan cosas.

import { useState } from "react";
import Link from "next/link";
import { abrirCarpeta, abrirCliente } from "@/app/(admin)/gestion/acciones";
import type { NodoArchivo, NodoCarpeta } from "@/admin/datos/arbol";
import type { ClienteEnGestion } from "@/admin/datos/carpetas";
import type { Persona } from "@/lib/equipo";
import { ConfiguracionDeCliente } from "@/admin/ConfiguracionDeCliente";
import { ConfiguracionDeCarpeta } from "@/admin/ConfiguracionDeCarpeta";
import { Estado } from "@/ui/Estado";
import { IconoDrive, IconoFlecha } from "@/ui/Icono";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const comoFecha = (dia: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  return fecha.format(new Date(a, m - 1, d));
};

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
      className="grid h-8 w-8 shrink-0 place-items-center text-apagado transition-colors hover:bg-hueco hover:text-tinta"
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
  if (!href) return null;
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
}: {
  abierta: boolean;
  onTocar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTocar}
      aria-expanded={abierta}
      className={`min-h-toque shrink-0 border-2 border-tinta px-3 text-menudo font-bold
                  tracking-tight transition-colors ${
                    abierta ? "bg-tinta text-lienzo" : "text-tinta hover:bg-hueco"
                  }`}
    >
      Configuración
    </button>
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
  const sinTag = cliente.tag.trim() === "";

  async function alternar() {
    if (abierto) {
      setAbierto(false);
      return;
    }
    setAbierto(true);
    if (carpetas) return;

    setCargando(true);
    try {
      const r = await abrirCliente(cliente.id);
      if (r.ok) setCarpetas(r.carpetas);
      else setError(r.motivo);
    } catch {
      setError("No pude leer las carpetas.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <li className={`border-b border-linea ${apagado ? "bg-hueco/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 px-2 py-3">
        <Abridor
          abierto={abierto}
          onAbrir={alternar}
          cargando={cargando}
          etiqueta={`Ver las carpetas de ${cliente.nombre}`}
        />

        <div className="min-w-0 flex-1">
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
            {!apagado && sinTag && (
              <span className="bg-espera-borde px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-tinta">
                Falta la clave
              </span>
            )}
            {cliente.mensajes > 0 && (
              <span className="bg-acento-tenue px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-acento">
                {cliente.mensajes}
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
        </div>

        <EnDrive href={cliente.enlaceDrive} que="la carpeta del cliente" />
        <BotonDeConfig abierta={config} onTocar={() => setConfig(!config)} />
      </div>

      {config && (
        <div className="border-t border-linea-tenue bg-lienzo px-4 py-4 pl-12">
          <ConfiguracionDeCliente cliente={cliente} />
        </div>
      )}

      {abierto && (
        <div className="border-t border-linea-tenue pl-6">
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
}: {
  carpeta: NodoCarpeta;
  clienteId: string;
  equipo: Persona[];
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
      const r = await abrirCarpeta(carpeta.id);
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
      <div className={`flex flex-wrap items-center gap-2 px-2 py-2.5 ${oculta ? "bg-hueco/40" : ""}`}>
        <Abridor
          abierto={abierta}
          onAbrir={alternar}
          cargando={cargando}
          etiqueta={`Ver los archivos de ${carpeta.nombre}`}
        />

        <div className="min-w-0 flex-1">
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

          {!carpeta.reservada && (
            <p className="mt-0.5 text-menudo text-apagado">
              {carpeta.piezas} {carpeta.piezas === 1 ? "pieza" : "piezas"} ·{" "}
              {carpeta.sinRevisar} sin revisar
              {carpeta.vence && ` · vence el ${comoFecha(carpeta.vence)}`}
              {carpeta.asignadaA ? ` · ${carpeta.asignadaA}` : " · sin asignar"}
            </p>
          )}
          {carpeta.reservada && (
            <p className="mt-0.5 text-menudo text-apagado">Acá se mueve lo aprobado.</p>
          )}
        </div>

        <EnDrive href={carpeta.enlaceDrive} que="la carpeta" />
        {!carpeta.reservada && (
          <BotonDeConfig abierta={config} onTocar={() => setConfig(!config)} />
        )}
      </div>

      {config && !carpeta.reservada && (
        <div className="border-t border-linea-tenue bg-lienzo px-4 py-4 pl-12">
          <ConfiguracionDeCarpeta
            carpeta={carpeta}
            clienteId={clienteId}
            equipo={equipo}
          />
        </div>
      )}

      {abierta && (
        <div className="border-t border-linea-tenue pl-6">
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
                <li
                  key={archivo.id}
                  className="flex flex-wrap items-center gap-2 border-t border-linea-tenue px-2 py-2"
                >
                  <span className="w-8 shrink-0" />
                  <div className="min-w-0 flex-1">
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
                    {(archivo.publicaEl || archivo.vence) && (
                      <p className="mt-0.5 text-micro text-apagado">
                        {archivo.publicaEl && `sale el ${comoFecha(archivo.publicaEl)}`}
                        {archivo.publicaEl && archivo.vence && " · "}
                        {archivo.vence && `vence el ${comoFecha(archivo.vence)}`}
                      </p>
                    )}
                  </div>
                  <EnDrive href={archivo.enlaceDrive} que="el archivo" />
                </li>
              ))}
            </ul>
          )}

          {carpeta.vista === "calendario" && !carpeta.reservada && (
            <div className="border-t border-linea-tenue px-2 py-2">
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
