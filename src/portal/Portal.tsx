"use client";

// El portal del cliente.
//
// La pantalla se parte en dos y la división es a propósito:
//
//   **A la izquierda, a lo alto, todo lo que no es el trabajo.** Quién es el
//   cliente, en qué carpeta está parado, a cuáles más puede entrar, cómo viene
//   la revisión, los botones y el link a Drive. Queda quieto mientras se baja.
//
//   **A la derecha, solo el trabajo.** Las piezas, como lista o como mes. Nada
//   más. Es lo que el cliente vino a mirar y no compite con nada.
//
// En el teléfono no hay ancho para dos columnas, así que la barra se acuesta
// arriba y el trabajo queda abajo.
//
// El estado vive acá y no más abajo porque la barra y la lista miran lo mismo:
// cuántas quedan, qué se puede enviar. Dos copias del mismo número es la forma
// segura de que un día no coincidan.

import { useEffect, useState } from "react";
import { aplicar, type Evento, type Pieza } from "@/dominio/pieza";
import { Ampliada, type Lamina } from "@/ui/Ampliada";
import { Boton, BotonEnlace } from "@/ui/Boton";
import { Calendario, type PiezaEnCalendario } from "@/ui/Calendario";
import {
  IconoCerrar,
  IconoDescargar,
  IconoDrive,
  IconoEditar,
  IconoEnviar,
} from "@/ui/Icono";
import { Conversacion, type Mensaje } from "@/portal/Conversacion";
import { pasoActual, Seguimiento } from "@/ui/Seguimiento";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import { fechaCorta } from "@/lib/fechas";
import { urlDeMiniatura } from "@/lib/miniaturas";
import type { CarpetaDeTrabajo, PortalDeCliente } from "@/portal/datos/cliente";
import { RevisarPieza, type Cambio, type PiezaAbierta } from "@/portal/RevisarPieza";

type EnPantalla = PiezaAbierta;

/**
 * Dónde queda el borrador de una carpeta en el navegador.
 *
 * Lleva el identificador de la carpeta adentro. Con una sola clave para todo,
 * dos carpetas del mismo cliente se pisarían el borrador entre ellas.
 */
const claveDelBorrador = (carpetaId: string) => `mesa-de-trabajo:borrador:${carpetaId}`;

/** Dónde queda la conversación de esta carpeta, hasta que exista la base. */
const claveDeLaCharla = (carpetaId: string) => `mesa-de-trabajo:charla:${carpetaId}`;

/** Un identificador para un cambio recién escrito. */
function nuevoId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Navegadores viejos, o la página servida sin https en una red local.
    return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function Portal({ datos }: { datos: PortalDeCliente }) {
  const [carpetaId, setCarpetaId] = useState(datos.carpetas[0]?.id ?? null);
  const carpeta = datos.carpetas.find((c) => c.id === carpetaId) ?? null;

  if (!carpeta) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md">
          <h1 className="text-titulo font-extrabold tracking-tight">
            Todavía no hay nada para revisar
          </h1>
          <p className="mt-3 text-normal text-tinta-suave">
            Cuando la agencia suba archivos a una carpeta, aparecen acá.
          </p>
        </div>
      </div>
    );
  }

  // La `key` es lo que hace que cambiar de carpeta empiece de cero: React
  // desmonta la revisión anterior en vez de arrastrar sus piezas a la nueva.
  return (
    <Revision
      key={carpeta.id}
      datos={datos}
      carpeta={carpeta}
      onElegirCarpeta={setCarpetaId}
    />
  );
}

function Revision({
  datos,
  carpeta,
  onElegirCarpeta,
}: {
  datos: PortalDeCliente;
  carpeta: CarpetaDeTrabajo;
  onElegirCarpeta: (id: string) => void;
}) {
  const [piezas, setPiezas] = useState<EnPantalla[]>(() =>
    carpeta.piezas.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      driveFileId: p.driveFileId,
      modificado: p.modificado,
      enlaceDrive: p.enlaceDrive,
      estado: p.estado,
      ronda: p.ronda,
      rondasIncluidas: datos.rondasIncluidas,
      rondasExtra: datos.rondasExtra,
      versiones: p.versiones,
      publicaEl: p.publicaEl,
      cambios: [],
      enviada: false,
    }))
  );
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<Lamina[] | null>(null);
  const [confirmando, setConfirmando] = useState<null | { soloEsta?: string }>(null);
  const [descargas, setDescargas] = useState(false);
  const [vista, setVista] = useState<"mes" | "semana" | "lista">("mes");
  const [conversando, setConversando] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const BORRADOR = claveDelBorrador(carpeta.id);

  // Mientras no exista la base de datos, el trabajo a medio hacer queda en el
  // navegador. Cuando exista, esto se reemplaza por una llamada al servidor y
  // la pantalla no cambia.
  useEffect(() => {
    try {
      const crudo = localStorage.getItem(BORRADOR);
      if (!crudo) return;
      const guardado = JSON.parse(crudo) as Record<
        string,
        { estado: string; cambios?: Cambio[]; enviada?: boolean }
      >;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPiezas((antes) =>
        antes.map((p) =>
          guardado[p.id]
            ? {
                ...p,
                estado: guardado[p.id].estado as Pieza["estado"],
                // Lo que viene del navegador no es de fiar: puede haberlo
                // dejado una versión anterior de la aplicación, o alguien
                // editándolo a mano. Se acepta solo lo que tiene la forma.
                cambios: (guardado[p.id].cambios ?? []).filter(
                  (c): c is Cambio =>
                    typeof c?.id === "string" && typeof c?.texto === "string"
                ),
                enviada: guardado[p.id].enviada ?? false,
              }
            : p
        )
      );
    } catch {
      // Un navegador que no deja guardar no es motivo para romper la pantalla.
    }
  }, [BORRADOR]);

  // La conversación, hasta que exista dónde guardarla de verdad. Cuando esté
  // Supabase, esto pasa a ser una consulta y la pantalla no cambia.
  useEffect(() => {
    try {
      const crudo = localStorage.getItem(claveDeLaCharla(carpeta.id));
      if (!crudo) return;
      const guardados = JSON.parse(crudo) as unknown;
      if (!Array.isArray(guardados)) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMensajes(
        guardados.filter(
          (m): m is Mensaje =>
            typeof m?.id === "string" &&
            typeof m?.texto === "string" &&
            typeof m?.cuando === "string" &&
            (m.de === "cliente" || m.de === "agencia" || m.de === "sistema")
        )
      );
    } catch {}
  }, [carpeta.id]);

  /**
   * Manda un mensaje al equipo.
   *
   * **No hay respuesta automática, ni la va a haber.** La aplicación anota lo
   * que se dijo; contestar es de una persona. Si algún día esto genera una
   * respuesta, se rompió la regla más vieja del proyecto.
   */
  function enviarMensaje(texto: string) {
    const siguiente: Mensaje[] = [
      ...mensajes,
      {
        id: nuevoId(),
        de: "cliente",
        quien: "Vos",
        texto,
        cuando: new Date().toISOString(),
      },
    ];
    setMensajes(siguiente);
    try {
      localStorage.setItem(claveDeLaCharla(carpeta.id), JSON.stringify(siguiente));
    } catch {}
  }

  function guardarEnElNavegador(siguientes: EnPantalla[]) {
    try {
      localStorage.setItem(
        BORRADOR,
        JSON.stringify(
          Object.fromEntries(
            siguientes.map((p) => [
              p.id,
              { estado: p.estado, cambios: p.cambios, enviada: p.enviada },
            ])
          )
        )
      );
    } catch {}
  }

  /**
   * Todo lo que cambia el estado se calcula **antes** de llamar a `setPiezas`,
   * nunca adentro del actualizador: React puede ejecutarlo más de una vez.
   */
  function aplicarYGuardar(siguientes: EnPantalla[]) {
    setPiezas(siguientes);
    guardarEnElNavegador(siguientes);
  }

  function mover(id: string, evento: Evento) {
    const pieza = piezas.find((p) => p.id === id);
    if (!pieza) return;

    const resultado = aplicar(pieza, evento);
    if (!resultado.ok) {
      setRechazo(resultado.motivo);
      return;
    }

    setRechazo(null);
    const limpiar = evento.tipo === "descartar_cambios";
    aplicarYGuardar(
      piezas.map((p) =>
        p.id === id ? { ...p, ...resultado.pieza, ...(limpiar ? { cambios: [] } : {}) } : p
      )
    );
  }

  /**
   * Reescribe la lista de cambios de una pieza y acomoda el estado.
   *
   * Anotar el primer cambio es pedir cambios, y borrar el último es
   * arrepentirse: son las dos únicas veces que tocar la lista mueve la pieza.
   */
  function cambiosDe(id: string, siguientes: Cambio[]) {
    const pieza = piezas.find((p) => p.id === id);
    if (!pieza || pieza.enviada) return;

    let estado = pieza.estado;
    let ronda = pieza.ronda;

    const quiereMarcar = siguientes.length > 0 && pieza.estado !== "cambios_marcados";
    const quiereSoltar = siguientes.length === 0 && pieza.estado === "cambios_marcados";

    if (quiereMarcar || quiereSoltar) {
      const r = aplicar(pieza, {
        tipo: quiereMarcar ? "pedir_cambios" : "descartar_cambios",
      });
      if (!r.ok) {
        setRechazo(r.motivo);
        return;
      }
      estado = r.pieza.estado;
      ronda = r.pieza.ronda;
    }

    setRechazo(null);
    aplicarYGuardar(
      piezas.map((p) => (p.id === id ? { ...p, estado, ronda, cambios: siguientes } : p))
    );
  }

  function enviar(soloEsta?: string) {
    aplicarYGuardar(
      piezas.map((pieza) => {
        if (soloEsta && pieza.id !== soloEsta) return pieza;
        if (pieza.enviada) return pieza;
        const r = aplicar(pieza, { tipo: "cerrar_revision" });
        return r.ok ? { ...pieza, ...r.pieza, enviada: true } : pieza;
      })
    );
    setConfirmando(null);
    setAbierta(null);
    setAviso(soloEsta ? "Enviamos esa pieza al equipo." : "Enviamos la revisión al equipo.");
  }

  const sinDecidir = piezas.filter(
    (p) => !p.enviada && (p.estado === "entregada" || p.estado === "en_revision")
  );
  const paraEnviar = piezas.filter(
    (p) => !p.enviada && (p.estado === "final" || p.estado === "cambios_marcados")
  );
  const aprobadas = piezas.filter((p) => p.estado === "final");
  const conFecha = piezas.filter((p) => p.publicaEl);

  const resueltas = piezas.length - sinDecidir.length;
  const avance = piezas.length === 0 ? 0 : Math.round((resueltas / piezas.length) * 100);

  const enCalendario = (p: EnPantalla): PiezaEnCalendario => ({
    id: p.id,
    nombre: p.nombre,
    publicaEl: p.publicaEl!,
    miniatura: urlDeMiniatura(p.driveFileId, 220, p.modificado),
    paso: pasoActual(p.ronda, p.rondasIncluidas, p.estado === "final"),
    aprobada: p.estado === "final",
  });

  // El calendario existe solo si la agencia marcó esta carpeta como calendario.
  // Si no la marcó, hay lista y nada más.
  const hayCalendario = carpeta.vista === "calendario" && conFecha.length > 0;
  const nombreDelMes = hayCalendario
    ? new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
        conFecha[0].publicaEl!
      )
    : "";

  const abiertaIndice = piezas.findIndex((p) => p.id === abierta);
  const piezaAbierta = abiertaIndice >= 0 ? piezas[abiertaIndice] : null;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">

      {/* ==================== Todo lo que no es el trabajo ================= */}
      <aside
        className="flex w-full flex-col gap-6 bg-tinta p-6 text-lienzo
                   lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:shrink-0 lg:overflow-y-auto"
      >
        <div>
          <h1 className="text-grande font-extrabold leading-none tracking-tighter">
            {datos.cliente.nombre}
          </h1>
          <p className="mt-2 text-micro font-extrabold uppercase tracking-widest text-lienzo/45">
            Mesa de trabajo
          </p>
        </div>

        {/* Las carpetas que la agencia dejó a la vista. */}
        {datos.carpetas.length > 1 && (
          <nav aria-label="Carpetas">
            <p className="text-micro font-extrabold uppercase tracking-widest text-lienzo/45">
              Carpetas
            </p>
            {/*
              En el teléfono van en fila y se corren de costado: en columna, la
              barra se comía la pantalla entera antes de llegar al trabajo. En
              pantalla grande sobra alto y la columna se lee mejor.
            */}
            <ul className="mt-2 flex gap-2 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
              {datos.carpetas.map((c) => {
                const actual = c.id === carpeta.id;
                return (
                  <li key={c.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => onElegirCarpeta(c.id)}
                      aria-current={actual ? "page" : undefined}
                      className={`flex min-h-toque w-full items-center justify-between gap-3 px-3 text-left
                                  text-normal font-bold tracking-tight transition-colors ${
                                    actual
                                      ? "bg-lienzo text-tinta"
                                      : "text-lienzo/75 hover:bg-lienzo/10 hover:text-lienzo"
                                  }`}
                    >
                      <span className="min-w-0 truncate">{c.nombre}</span>
                      <span
                        className={`shrink-0 text-micro font-extrabold ${
                          actual ? "text-tinta/50" : "text-lienzo/40"
                        }`}
                      >
                        {c.piezas.length}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {/* Los botones van al fondo: son el final del recorrido, no el
            principio. `mt-auto` los empuja hasta abajo de la columna. */}
        <div className="mt-auto flex flex-col gap-2">
          <Boton
            variante="principal"
            ancho
            onClick={() => setConfirmando({})}
            disabled={paraEnviar.length === 0}
          >
            <IconoEnviar />
            Enviar revisión
          </Boton>

          <button
            type="button"
            onClick={() => setConversando(true)}
            className="inline-flex min-h-toque items-center justify-center gap-2 border-2 border-lienzo/35 px-4
                       text-normal font-bold tracking-tight text-lienzo transition-colors hover:bg-lienzo/10"
          >
            <IconoEditar />
            Hablar con el equipo
            {mensajes.length > 0 && (
              <span className="bg-lienzo/20 px-1.5 text-micro font-extrabold">
                {mensajes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setDescargas(true)}
            disabled={aprobadas.length === 0}
            className="inline-flex min-h-toque items-center justify-center gap-2 border-2 border-lienzo/35 px-4
                       text-normal font-bold tracking-tight text-lienzo transition-colors hover:bg-lienzo/10
                       disabled:pointer-events-none disabled:opacity-35"
          >
            <IconoDescargar />
            Descargar archivos
            {aprobadas.length > 0 && (
              <span className="bg-lienzo/20 px-1.5 text-micro font-extrabold">
                {aprobadas.length}
              </span>
            )}
          </button>
        </div>

        {/* El link es de la carpeta que se está mirando, no del cliente
            entero: lleva a lo mismo que hay en pantalla. Abre en Drive y
            solo funciona para quien ya tenga acceso desde su cuenta. */}
        {carpeta.enlaceDrive && (
          <a
            href={carpeta.enlaceDrive}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-toque items-center gap-2 text-menudo font-semibold
                       text-lienzo/60 underline underline-offset-4 transition-colors hover:text-lienzo"
          >
            Abrir «{carpeta.nombre}» en Drive
          </a>
        )}
      </aside>

      {/* ============================ El trabajo ========================== */}
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8">
        {aviso && (
          <p className="mb-5 border-l-4 border-acento bg-acento-tenue px-5 py-4 text-normal font-semibold text-acento">
            {aviso}
          </p>
        )}
        {rechazo && (
          <p className="mb-5 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-normal font-semibold text-espera">
            {rechazo}
          </p>
        )}

        {/* El título es el nombre de la carpeta, y el avance va pegado a él:
            «cuánto me falta» es una propiedad de esto que estoy mirando, no un
            dato suelto en otra columna. */}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <h2 className="min-w-0 text-grande font-extrabold leading-none tracking-tighter">
            {carpeta.nombre}
          </h2>

          <div className="min-w-44">
            <p className="flex items-baseline gap-2">
              <span className="cifras text-titulo font-extrabold leading-none tracking-tighter">
                {resueltas}
              </span>
              <span className="text-normal font-semibold text-apagado">
                de {piezas.length} resueltas
              </span>
            </p>
            <div className="mt-2 h-1.5 bg-hueco">
              <div
                className="h-full bg-acento transition-[width] duration-300"
                style={{ width: `${avance}%` }}
                role="progressbar"
                aria-valuenow={avance}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Piezas resueltas"
              />
            </div>
          </div>
        </div>

        {(hayCalendario || sinDecidir.length > 0) && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            {hayCalendario ? (
              <div
                role="tablist"
                aria-label="Cómo mirar la carpeta"
                className="flex border-2 border-tinta"
              >
                {(["mes", "semana", "lista"] as const).map((modo) => (
                  <button
                    key={modo}
                    role="tab"
                    aria-selected={vista === modo}
                    onClick={() => setVista(modo)}
                    className={`min-h-toque px-5 text-normal font-bold capitalize tracking-tight transition-colors ${
                      vista === modo ? "bg-tinta text-lienzo" : "text-tinta hover:bg-hueco"
                    }`}
                  >
                    {modo}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-menudo text-apagado">
                Te {sinDecidir.length === 1 ? "queda" : "quedan"} {sinDecidir.length}{" "}
                {sinDecidir.length === 1 ? "pieza" : "piezas"} sin mirar.
              </p>
            )}

            {hayCalendario && vista !== "lista" && (
              <p className="text-titulo font-extrabold capitalize tracking-tight">
                {nombreDelMes}
              </p>
            )}
          </div>
        )}

        <div className="mt-5">
          {hayCalendario && vista !== "lista" ? (
            <Calendario
              modo={vista}
              mes={conFecha[0].publicaEl!}
              piezas={conFecha.map(enCalendario)}
              onAbrir={setAbierta}
            />
          ) : (
            <ul className="divide-y divide-linea border-y border-linea">
              {piezas.map((pieza) => (
                <li key={pieza.id} className="flex items-center gap-2">
                  {/* El link va afuera del botón y no adentro: un enlace
                      adentro de un botón es HTML inválido, y el navegador
                      resuelve el conflicto como quiere. */}
                  <button
                    type="button"
                    onClick={() => setAbierta(pieza.id)}
                    className="flex min-w-0 flex-1 items-center gap-4 py-4 text-left transition-colors hover:bg-hueco/60"
                  >
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden bg-tinta">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={urlDeMiniatura(pieza.driveFileId, 220, pieza.modificado)}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-guia font-bold leading-snug">
                        {pieza.nombre}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Seguimiento
                          ronda={pieza.ronda}
                          rondasIncluidas={pieza.rondasIncluidas}
                          rondasExtra={pieza.rondasExtra}
                          aprobada={pieza.estado === "final"}
                          compacto
                        />
                        {pieza.versiones.length > 1 && (
                          <span className="text-micro font-semibold uppercase tracking-wider text-apagado">
                            {pieza.versiones.length} vueltas
                          </span>
                        )}
                        {pieza.publicaEl && (
                          <span className="text-micro font-semibold uppercase tracking-wider text-apagado">
                            sale el {fechaCorta(pieza.publicaEl)}
                          </span>
                        )}
                        {pieza.enviada && (
                          <span className="text-micro font-semibold uppercase tracking-wider text-apagado">
                            · enviada
                          </span>
                        )}
                      </span>
                      {pieza.cambios.length > 0 && (
                        <span className="mt-1 block truncate text-menudo text-apagado">
                          {pieza.cambios.length}{" "}
                          {pieza.cambios.length === 1
                            ? "cambio anotado"
                            : "cambios anotados"}
                          : {pieza.cambios[0].texto}
                        </span>
                      )}
                    </span>
                  </button>

                  {pieza.enlaceDrive && (
                    <a
                      href={pieza.enlaceDrive}
                      target="_blank"
                      rel="noreferrer noopener"
                      title={`Abrir ${pieza.nombre} en Drive`}
                      className="grid h-10 w-10 shrink-0 place-items-center text-apagado
                                 transition-colors hover:bg-hueco hover:text-tinta"
                    >
                      <IconoDrive />
                      <span className="sr-only">Abrir en Drive</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* =================== Solo mientras es prueba ================== */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 bg-hueco/60 px-4 py-3">
          <p className="text-menudo text-apagado">
            Estás viendo una prueba. Lo que hacés queda guardado en este navegador.
          </p>
          <Boton
            variante="contorno"
            tamano="chico"
            onClick={() => {
              try {
                localStorage.removeItem(BORRADOR);
              } catch {}
              location.reload();
            }}
          >
            Volver a empezar
          </Boton>
        </div>
      </main>

      {/* ============================ Ventanas =========================== */}
      {piezaAbierta && (
        <RevisarPieza
          pieza={piezaAbierta}
          posicion={{ actual: abiertaIndice + 1, total: piezas.length }}
          onIr={(paso) => {
            const siguiente = (abiertaIndice + paso + piezas.length) % piezas.length;
            setAbierta(piezas[siguiente].id);
          }}
          onCerrar={() => setAbierta(null)}
          onEvento={(evento) => mover(piezaAbierta.id, evento)}
          onAgregarCambio={(texto) =>
            cambiosDe(piezaAbierta.id, [...piezaAbierta.cambios, { id: nuevoId(), texto }])
          }
          onEditarCambio={(id, texto) =>
            cambiosDe(
              piezaAbierta.id,
              piezaAbierta.cambios.map((c) => (c.id === id ? { ...c, texto } : c))
            )
          }
          onBorrarCambio={(id) =>
            cambiosDe(
              piezaAbierta.id,
              piezaAbierta.cambios.filter((c) => c.id !== id)
            )
          }
          onEnviarEsta={() => setConfirmando({ soloEsta: piezaAbierta.id })}
          onAmpliar={setAmpliada}
        />
      )}

      {ampliada && <Ampliada laminas={ampliada} onCerrar={() => setAmpliada(null)} />}

      {descargas && <Descargas piezas={aprobadas} onCerrar={() => setDescargas(false)} />}

      {conversando && (
        <Conversacion
          carpeta={carpeta.nombre}
          mensajes={mensajes}
          onEnviar={enviarMensaje}
          onCerrar={() => setConversando(false)}
        />
      )}

      {confirmando && (
        <Confirmacion
          proyecto={carpeta.nombre}
          piezas={
            confirmando.soloEsta
              ? paraEnviar.filter((p) => p.id === confirmando.soloEsta)
              : paraEnviar
          }
          sinRevisar={confirmando.soloEsta ? [] : sinDecidir}
          soloUna={Boolean(confirmando.soloEsta)}
          onVolver={() => setConfirmando(null)}
          onEnviar={() => enviar(confirmando.soloEsta)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** El armazón de las ventanas: fondo, panel, encabezado con cierre. */
function Ventana({
  titulo,
  bajada,
  onCerrar,
  children,
  pie,
}: {
  titulo: string;
  bajada?: string;
  onCerrar: () => void;
  children: React.ReactNode;
  pie?: React.ReactNode;
}) {
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/50 sm:items-center sm:p-6"
      onClick={onCerrar}
    >
      <div
        ref={marco}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden bg-lienzo"
      >
        <header className="flex items-start gap-3 bg-acento px-6 py-4 text-white">
          <div className="min-w-0 flex-1">
            <h2 className="text-titulo font-extrabold tracking-tight">{titulo}</h2>
            {bajada && <p className="mt-0.5 text-menudo text-white/70">{bajada}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center bg-white text-acento transition-colors hover:bg-white/90"
          >
            <IconoCerrar />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {pie && (
          <footer className="border-t-2 border-tinta px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
            {pie}
          </footer>
        )}
      </div>
    </div>
  );
}

/** Los archivos aprobados, listos para llevarse. */
function Descargas({
  piezas,
  onCerrar,
}: {
  piezas: Array<{ id: string; nombre: string; driveFileId: string }>;
  onCerrar: () => void;
}) {
  return (
    <Ventana
      titulo="Descargar archivos"
      bajada="Los originales de todo lo que aprobaste."
      onCerrar={onCerrar}
    >
      <ul className="flex flex-col divide-y divide-linea">
        {piezas.map((pieza) => (
          <li key={pieza.id} className="flex items-center justify-between gap-4 py-3">
            <span className="min-w-0 flex-1 truncate font-semibold">{pieza.nombre}</span>
            <BotonEnlace
              href={`/api/archivo/${pieza.driveFileId}`}
              download
              variante="contorno"
              tamano="chico"
            >
              <IconoDescargar />
              Descargar
            </BotonEnlace>
          </li>
        ))}
      </ul>
    </Ventana>
  );
}

/**
 * El resumen antes de enviar.
 *
 * Enviar es el único acto de esta pantalla que la agencia ve, y no se deshace.
 * Merece que el cliente lea qué está mandando: qué aprobó, qué pidió cambiar
 * —punto por punto— y, sobre todo, si quedó alguna sin mirar.
 */
function Confirmacion({
  proyecto,
  piezas,
  sinRevisar,
  soloUna,
  onVolver,
  onEnviar,
}: {
  proyecto: string;
  piezas: Array<{
    id: string;
    nombre: string;
    estado: Pieza["estado"];
    cambios: Cambio[];
  }>;
  sinRevisar: Array<{ id: string; nombre: string }>;
  soloUna: boolean;
  onVolver: () => void;
  onEnviar: () => void;
}) {
  const aprobadas = piezas.filter((p) => p.estado === "final");
  const conCambios = piezas.filter((p) => p.estado === "cambios_marcados");

  return (
    <Ventana
      titulo={soloUna ? "Enviar esta pieza" : "Antes de enviar"}
      bajada={proyecto}
      onCerrar={onVolver}
      pie={
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Boton ancho onClick={onEnviar}>
            <IconoEnviar />
            Sí, enviar
          </Boton>
          <Boton variante="contorno" ancho onClick={onVolver}>
            Volver
          </Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        {aprobadas.length > 0 && (
          <section>
            <h3 className="text-micro font-extrabold uppercase tracking-widest text-listo">
              Aprobadas · {aprobadas.length}
            </h3>
            <ul className="mt-3 flex flex-col gap-1.5">
              {aprobadas.map((p) => (
                <li key={p.id} className="text-normal">
                  {p.nombre}
                </li>
              ))}
            </ul>
          </section>
        )}

        {conCambios.length > 0 && (
          <section>
            <h3 className="text-micro font-extrabold uppercase tracking-widest text-acento">
              Con cambios · {conCambios.length}
            </h3>
            <ul className="mt-3 flex flex-col gap-5">
              {conCambios.map((p) => (
                <li key={p.id}>
                  <p className="text-normal font-bold">{p.nombre}</p>
                  {p.cambios.length === 0 ? (
                    <p className="mt-1 text-menudo text-espera">Sin escribir qué cambiar</p>
                  ) : (
                    <ol className="mt-1.5 flex flex-col gap-1.5">
                      {p.cambios.map((c, i) => (
                        <li key={c.id} className="flex gap-2 text-menudo text-tinta-suave">
                          <span className="shrink-0 font-extrabold text-apagado">
                            {i + 1}.
                          </span>
                          <span className="min-w-0 whitespace-pre-wrap">{c.texto}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {sinRevisar.length > 0 && (
          <section className="bg-espera-tenue px-5 py-4">
            <h3 className="text-micro font-extrabold uppercase tracking-widest text-espera">
              Sin revisar · {sinRevisar.length}
            </h3>
            <ul className="mt-3 flex flex-col gap-1.5">
              {sinRevisar.map((p) => (
                <li key={p.id} className="text-menudo text-tinta-suave">
                  {p.nombre}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-menudo text-espera">
              Estas quedan esperándote. Podés volver más tarde y resolverlas.
            </p>
          </section>
        )}

        <p className="text-menudo text-apagado">
          {soloUna
            ? "El equipo recibe solo esta pieza y empieza a trabajarla. El resto sigue esperándote."
            : "El equipo recibe la devolución y empieza a trabajar sobre los cambios."}
        </p>
      </div>
    </Ventana>
  );
}
