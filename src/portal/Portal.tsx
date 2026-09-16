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

import { useCallback, useEffect, useState } from "react";
import type { Evento, Pieza } from "@/dominio/pieza";
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
import { Conversacion } from "@/ui/Conversacion";
import type { Mensaje } from "@/lib/conversaciones";
import type { Cambio, EstadoDePieza } from "@/lib/piezas";
import {
  enviarRevision,
  escribirComoCliente,
  guardarCambiosDePieza,
  moverPieza,
} from "@/portal/acciones";
import { pasoActual, Seguimiento } from "@/ui/Seguimiento";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import { fechaCorta } from "@/lib/fechas";
import { urlDeMiniatura } from "@/lib/miniaturas";
import { Miniatura } from "@/ui/Miniatura";
import type { CarpetaDeTrabajo, PortalDeCliente } from "@/portal/datos/cliente";
import { RevisarPieza, type PiezaAbierta } from "@/portal/RevisarPieza";

type EnPantalla = PiezaAbierta;

/** Dónde recuerda este navegador hasta cuándo leyó el chat. */
const claveDeLeido = (clienteId: string) => `mesa-de-trabajo:leido:${clienteId}`;

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
          {/*
            **Lo que hace aparecer una pieza es la entrega, no la subida.**
            El texto decía «cuando la agencia suba archivos» y quedó de cuando
            subir a Drive alcanzaba para que el cliente lo viera. Desde que hay
            un botón «Entregar», eso es mentira en el peor momento: alguien del
            otro lado lee que no subimos nada cuando en realidad está todo
            subido y falta que alguien lo entregue.
          */}
          <p className="mt-3 text-normal text-tinta-suave">
            Cuando la agencia te entregue algo, aparece acá.
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
  // El estado viene del servidor y vuelve al servidor. El navegador ya no es
  // la memoria de nada: revisar desde el teléfono y seguir en la computadora
  // tiene que encontrar lo mismo, y la agencia tiene que poder enterarse.
  const desdeElServidor = useCallback(
    () =>
      carpeta.piezas.map((p) => ({
        ...p,
        rondasIncluidas: datos.rondasIncluidas,
        rondasExtra: p.rondasExtra,
      })),
    [carpeta.piezas, datos.rondasIncluidas]
  );

  const [piezas, setPiezas] = useState<EnPantalla[]>(desdeElServidor);

  /**
   * Cuando el servidor manda datos nuevos, la pantalla se vuelve a sembrar.
   *
   * Sin esto, `useState` guardaba una foto del primer dibujo y no la soltaba
   * más: la agencia cambiaba una fecha en el calendario, el servidor la
   * mandaba bien, y la pantalla seguía mostrando la vieja. **El servidor manda
   * sobre lo suyo**, y lo que el cliente hace vuelve por las acciones.
   *
   * La firma es de contenido y no de identidad: React arma un arreglo nuevo en
   * cada dibujo, así que comparar por referencia se dispararía siempre.
   */
  const firma = JSON.stringify(
    carpeta.piezas.map((p) => [
      p.id,
      p.estado,
      p.ronda,
      p.enviada,
      p.publicaEl?.getTime() ?? 0,
      p.cambios.length,
    ])
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPiezas(desdeElServidor());
    // `desdeElServidor` cambia en cada dibujo; la firma es lo que de verdad
    // dice si el servidor mandó otra cosa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<Lamina[] | null>(null);
  const [confirmando, setConfirmando] = useState<null | { soloEsta?: string }>(null);
  const [descargas, setDescargas] = useState(false);
  const [vista, setVista] = useState<"mes" | "semana" | "lista">("mes");
  const [conversando, setConversando] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  /**
   * Hasta cuándo leyó este cliente.
   *
   * Del lado del portal no hay sesión de persona, así que la marca vive en el
   * navegador: es el único lugar que sabe quién está mirando. Del lado de la
   * agencia sí está en el servidor, porque ahí el equipo comparte la bandeja.
   */
  const [leidoHasta, setLeidoHasta] = useState<string>("");
  const [enviandoMensaje, setEnviandoMensaje] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Qué pieza está esperando al servidor. Bloquea el doble clic. */
  const [ocupada, setOcupada] = useState<string | null>(null);

  /**
   * La conversación vive en el servidor, no en este navegador.
   *
   * Tiene que ser así porque tiene dos lados: el cliente escribe acá y la
   * agencia contesta desde la app de gestión. Se pregunta al abrir la pantalla
   * y cada tanto mientras el chat está abierto, que es cuando importa
   * enterarse rápido de lo que dijo el otro.
   */
  useEffect(() => {
    let vivo = true;

    async function traer() {
      try {
        const r = await fetch(`/api/conversacion/${datos.cliente.id}`, {
          cache: "no-store",
        });
        if (!r.ok) return;
        const { mensajes: llegaron } = (await r.json()) as { mensajes: Mensaje[] };
        // Si la pantalla ya se desmontó, guardar sería escribir en el aire.
        if (vivo) setMensajes(llegaron);
      } catch {
        // Sin conexión no se rompe nada: se sigue viendo lo último que llegó.
      }
    }

    traer();
    // Preguntar cada seis segundos solo mientras el chat está abierto. Con el
    // chat cerrado, el número del botón se actualiza al abrirlo y alcanza.
    if (!conversando) return;
    const cada = setInterval(traer, 6000);
    return () => {
      vivo = false;
      clearInterval(cada);
    };
  }, [datos.cliente.id, conversando]);

  // Hasta cuándo leyó este navegador. Se recupera una vez, al montar.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeidoHasta(localStorage.getItem(claveDeLeido(datos.cliente.id)) ?? "");
    } catch {}
  }, [datos.cliente.id]);

  /** Abrir el chat es leerlo. */
  function abrirElChat() {
    setConversando(true);
    const ahora = new Date().toISOString();
    setLeidoHasta(ahora);
    try {
      localStorage.setItem(claveDeLeido(datos.cliente.id), ahora);
    } catch {}
  }

  /**
   * Lo que el equipo dijo y este cliente todavía no leyó.
   *
   * Los avisos de la aplicación no cuentan: no son alguien hablando.
   */
  const sinLeer = mensajes.filter(
    (m) => m.de === "agencia" && m.cuando > leidoHasta
  ).length;

  /**
   * Manda un mensaje al equipo.
   *
   * **No hay respuesta automática, ni la va a haber.** La aplicación anota lo
   * que se dijo; contestar es de una persona.
   */
  async function enviarMensaje(texto: string) {
    setEnviandoMensaje(true);
    try {
      const r = await escribirComoCliente(carpeta.id, texto);
      if (r.ok) setMensajes(r.mensajes);
      else setRechazo(r.motivo);
    } catch {
      setRechazo("No pudimos mandar el mensaje. Probá de nuevo.");
    } finally {
      setEnviandoMensaje(false);
    }
  }

  /** Reemplaza una pieza con lo que devolvió el servidor. */
  function refrescar(id: string, estado: EstadoDePieza) {
    setPiezas((antes) => antes.map((p) => (p.id === id ? { ...p, ...estado } : p)));
  }

  /**
   * Aplica un evento del dominio, pero del lado del servidor.
   *
   * Las reglas siguen siendo las mismas —`aplicar()` corre allá—, y lo que
   * vuelve es la pieza ya guardada. Sin optimismo a propósito: la pantalla
   * muestra lo que de verdad quedó, no lo que esperábamos que quedara.
   */
  async function mover(id: string, evento: Evento) {
    setOcupada(id);
    try {
      const r = await moverPieza(carpeta.id, id, evento);
      if (r.ok) {
        setRechazo(null);
        refrescar(id, r.pieza);
      } else {
        setRechazo(r.motivo);
      }
    } catch {
      setRechazo("No pudimos guardar eso. Probá de nuevo.");
    } finally {
      setOcupada(null);
    }
  }

  async function cambiosDe(id: string, siguientes: Cambio[]) {
    setOcupada(id);
    try {
      const r = await guardarCambiosDePieza(carpeta.id, id, siguientes);
      if (r.ok) {
        setRechazo(null);
        refrescar(id, r.pieza);
      } else {
        setRechazo(r.motivo);
      }
    } catch {
      setRechazo("No pudimos guardar los cambios. Probá de nuevo.");
    } finally {
      setOcupada(null);
    }
  }

  async function enviar(soloEsta?: string) {
    setConfirmando(null);
    setOcupada(soloEsta ?? "todas");
    try {
      const r = await enviarRevision(carpeta.id, soloEsta);
      if (r.ok) {
        setPiezas((antes) =>
          antes.map((p) => (r.piezas[p.id] ? { ...p, ...r.piezas[p.id] } : p))
        );
        setAbierta(null);
        setRechazo(null);
        setAviso(
          soloEsta ? "Enviamos esa pieza al equipo." : "Enviamos la revisión al equipo."
        );
      } else {
        setRechazo(r.motivo);
      }
    } catch {
      setRechazo("No pudimos enviar la revisión. Probá de nuevo.");
    } finally {
      setOcupada(null);
    }
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
          {/* Debajo del nombre, la puerta a la carpeta entera del cliente en
              Drive. Ocupa el lugar donde antes había un rótulo que no servía
              para nada. */}
          {datos.cliente.enlaceDrive && (
            <a
              href={datos.cliente.enlaceDrive}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex min-h-toque items-center gap-2 border-2 border-lienzo/35 px-4
                         text-menudo font-bold tracking-tight text-lienzo transition-colors hover:bg-lienzo/10"
            >
              <IconoDrive />
              Ver en Drive
            </a>
          )}
        </div>

        {/*
          Las carpetas que la agencia dejó a la vista.

          **Se muestran aunque haya una sola.** Estaban escondidas hasta que
          hubiera dos, con la idea de no dibujar un menú de un solo renglón. El
          resultado era peor: el cliente entraba y no veía en qué carpeta
          estaba parado ni cuántas piezas había adentro —el título grande es el
          nombre del cliente, no el del trabajo—, y cuando apareciera la segunda
          carpeta le cambiaba la pantalla de lugar.
        */}
        {datos.carpetas.length > 0 && (
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
            disabled={paraEnviar.length === 0 || ocupada !== null}
          >
            <IconoEnviar />
            Enviar revisión
          </Boton>

          <button
            type="button"
            onClick={abrirElChat}
            className="inline-flex min-h-toque items-center justify-center gap-2 border-2 border-lienzo/35 px-4
                       text-normal font-bold tracking-tight text-lienzo transition-colors hover:bg-lienzo/10"
          >
            <IconoEditar />
            Hablar con el equipo
            {/* Lo que falta leer, no cuántos hay. Un número que dice «14» para
                siempre no dice nada; el que importa baja a cero al abrir. */}
            {sinLeer > 0 && (
              <span className="bg-acento px-1.5 text-micro font-extrabold text-white">
                {sinLeer}
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
          </button>
        </div>

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

        {(hayCalendario || carpeta.enlaceDrive) && (
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
              carpeta.enlaceDrive && (
                <a
                  href={carpeta.enlaceDrive}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-toque items-center gap-2 border-2 border-tinta px-4
                             text-menudo font-bold tracking-tight text-tinta transition-colors hover:bg-hueco"
                >
                  <IconoDrive />
                  Ver en Drive
                </a>
              )
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
                      <Miniatura
                        src={urlDeMiniatura(pieza.driveFileId, 220, pieza.modificado)}
                        alt=""
                        nombre={pieza.nombre}
                        rotulo={pieza.esPdf ? "PDF" : undefined}
                        tono="oscuro"
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
                      <span className="sr-only">Ver en Drive</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
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
          rechazo={rechazo}
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
          carpeta={datos.cliente.nombre}
          mensajes={mensajes}
          yo="cliente"
          enviando={enviandoMensaje}
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
