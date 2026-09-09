"use client";

// La revisión, como la trabaja el cliente.
//
// Cuatro ideas mandan sobre el diseño de esta pantalla:
//
//   1. **Las acciones que valen viven arriba.** Descargar lo aprobado y enviar
//      la revisión son las dos cosas que el cliente vino a hacer: están a mano
//      desde el primer segundo, no al final de un scroll.
//
//   2. **Cada pieza se revisa en una ventana.** Se abre desde el calendario o
//      desde la lista, se resuelve, se cierra y sigue la que viene — sin
//      perder el lugar donde se estaba.
//
//   3. **Guardar no es enviar.** Guardar deja el trabajo esperando; enviar es
//      el único momento en que la agencia recibe algo.
//
//   4. **La pieza se muestra entera.** Es una obra de diseño: recortarle un
//      borde puede cambiar lo que se está juzgando.
//
// Las reglas de qué se puede hacer en cada estado salen de `aplicar()`, la
// misma función que va a correr en el servidor.

import { useEffect, useState } from "react";
import { aplicar, type Evento, type Pieza } from "@/dominio/pieza";
import { Ampliada } from "@/ui/Ampliada";
import { Boton, BotonEnlace } from "@/ui/Boton";
import { Calendario, type PiezaEnCalendario } from "@/ui/Calendario";
import { IconoCerrar, IconoDescargar, IconoEditar, IconoEnviar } from "@/ui/Icono";
import { pasoActual, Seguimiento } from "@/ui/Seguimiento";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import { fechaCorta, plazoEnPalabras } from "@/lib/fechas";
import { urlDeMiniatura } from "@/lib/miniaturas";
import type { EntregaEjemplo } from "@/portal/datos/ejemplo";
import { RevisarPieza, type PiezaAbierta } from "@/portal/RevisarPieza";

type EnPantalla = PiezaAbierta;

/**
 * Dónde queda el borrador de esta entrega en el navegador.
 *
 * Lleva el identificador de la entrega adentro. Con una sola clave para todo,
 * dos entregas del mismo cliente se pisarían el borrador entre ellas.
 */
const claveDelBorrador = (entregaId: string) => `mesa-de-trabajo:borrador:${entregaId}`;

export function RevisionDeEntrega({ entrega }: { entrega: EntregaEjemplo }) {
  const [piezas, setPiezas] = useState<EnPantalla[]>(() =>
    entrega.piezas.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      driveFileId: p.driveFileId,
      modificado: p.modificado,
      estado: p.estado,
      ronda: p.ronda,
      rondasIncluidas: entrega.rondasIncluidas,
      rondasExtra: entrega.rondasExtra,
      versiones: p.versiones,
      publicaEl: p.publicaEl,
      pedido: "",
      enviada: false,
      editando: false,
    }))
  );
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState<{ src: string; alt: string } | null>(null);
  const [confirmando, setConfirmando] = useState<null | { soloEsta?: string }>(null);
  const [descargas, setDescargas] = useState(false);
  /**
   * Mes, semana o lista.
   *
   * El interruptor solo existe si la agencia marcó la entrega como calendario
   * al armarla; si no, hay lista y nada más. La elección es del cliente: la
   * agencia decide si tiene sentido mirarlo como mes, no cómo prefiere mirarlo
   * cada persona.
   */
  const [vista, setVista] = useState<"mes" | "semana" | "lista">("mes");
  const [comentando, setComentando] = useState(false);
  const [comentarioGeneral, setComentarioGeneral] = useState("");
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const BORRADOR = claveDelBorrador(entrega.id);

  // Mientras no exista la base de datos, el trabajo a medio hacer queda en el
  // navegador. Cuando exista, esto se reemplaza por una llamada al servidor y
  // la pantalla no cambia.
  useEffect(() => {
    try {
      const crudo = localStorage.getItem(BORRADOR);
      if (!crudo) return;
      const guardado = JSON.parse(crudo) as Record<
        string,
        { estado: string; pedido: string; enviada?: boolean }
      >;
      // El servidor no puede saber qué guardó este navegador, así que el
      // borrador solo se puede recuperar una vez montada la pantalla.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPiezas((antes) =>
        antes.map((p) =>
          guardado[p.id]
            ? {
                ...p,
                estado: guardado[p.id].estado as Pieza["estado"],
                pedido: guardado[p.id].pedido,
                enviada: guardado[p.id].enviada ?? false,
                editando: false,
              }
            : p
        )
      );
    } catch {
      // Un navegador que no deja guardar no es motivo para romper la pantalla.
    }
    // Si cambia la entrega, hay que traer su borrador y no el de la anterior.
  }, [BORRADOR]);

  function guardarEnElNavegador(siguientes: EnPantalla[]) {
    try {
      localStorage.setItem(
        BORRADOR,
        JSON.stringify(
          Object.fromEntries(
            siguientes.map((p) => [
              p.id,
              { estado: p.estado, pedido: p.pedido, enviada: p.enviada },
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

  function mover(id: string, evento: Evento, extra?: Partial<EnPantalla>) {
    const pieza = piezas.find((p) => p.id === id);
    if (!pieza) return;

    const resultado = aplicar(pieza, evento);
    if (!resultado.ok) {
      setRechazo(resultado.motivo);
      return;
    }

    setRechazo(null);
    aplicarYGuardar(
      piezas.map((p) => (p.id === id ? { ...p, ...resultado.pieza, ...extra } : p))
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

  const hayCalendario = entrega.vista === "calendario" && conFecha.length > 0;
  const nombreDelMes = hayCalendario
    ? new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
        conFecha[0].publicaEl!
      )
    : "";

  const abiertaIndice = piezas.findIndex((p) => p.id === abierta);
  const piezaAbierta = abiertaIndice >= 0 ? piezas[abiertaIndice] : null;

  return (
    <>
      {/* ===================== Lo que se vino a hacer ==================== */}
      <div className="mt-6 bg-tinta text-lienzo">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:p-6">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-grande font-extrabold tracking-tighter">{resueltas}</span>
              <span className="text-guia font-semibold text-lienzo/45">de {piezas.length}</span>
            </div>
            <p className="mt-1 text-micro font-extrabold uppercase tracking-widest text-lienzo/55">
              resueltas · {plazoEnPalabras(entrega.vence)}
            </p>
            <div className="mt-3 h-1.5 max-w-xs bg-lienzo/15">
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setComentando(true)}
              className="inline-flex min-h-toque items-center justify-center gap-2 border-2 border-lienzo/35 px-5
                         text-normal font-bold tracking-tight text-lienzo transition-colors hover:bg-lienzo/10"
            >
              <IconoEditar />
              Comentario general
            </button>

            <button
              type="button"
              onClick={() => setDescargas(true)}
              disabled={aprobadas.length === 0}
              className="inline-flex min-h-toque items-center justify-center gap-2 border-2 border-lienzo/35 px-5
                         text-normal font-bold tracking-tight text-lienzo transition-colors hover:bg-lienzo/10
                         disabled:opacity-35 disabled:pointer-events-none"
            >
              <IconoDescargar />
              Descargar archivos
              {aprobadas.length > 0 && (
                <span className="bg-lienzo/20 px-1.5 text-micro font-extrabold">
                  {aprobadas.length}
                </span>
              )}
            </button>

            <Boton
              variante="principal"
              onClick={() => setConfirmando({})}
              disabled={paraEnviar.length === 0}
            >
              <IconoEnviar />
              Enviar revisión completa
            </Boton>
          </div>
        </div>
      </div>

      {aviso && (
        <p className="mt-4 border-l-4 border-acento bg-acento-tenue px-5 py-4 text-normal font-semibold text-acento">
          {aviso}
        </p>
      )}
      {rechazo && (
        <p className="mt-4 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-normal font-semibold text-espera">
          {rechazo}
        </p>
      )}

      {/* ==================== Mes · Semana · Lista ======================= */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {hayCalendario ? (
          <div
            role="tablist"
            aria-label="Cómo mirar la entrega"
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
          <h2 className="text-titulo font-extrabold tracking-tight">Las piezas</h2>
        )}

        {hayCalendario && vista !== "lista" && (
          <p className="text-titulo font-extrabold capitalize tracking-tight">
            {nombreDelMes}
          </p>
        )}
      </div>

      {/* ========================== El contenido ========================= */}
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
              <li key={pieza.id}>
                <button
                  type="button"
                  onClick={() => setAbierta(pieza.id)}
                  className="flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-hueco/60"
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
                    {pieza.pedido && (
                      <span className="mt-1 block truncate text-menudo text-apagado">
                        {pieza.pedido}
                      </span>
                    )}
                  </span>

                  <span aria-hidden="true" className="shrink-0 text-apagado">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ===================== Solo mientras es prueba =================== */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-hueco/60 px-4 py-3">
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
          onEvento={(evento, extra) => mover(piezaAbierta.id, evento, extra)}
          onEscribir={(texto) =>
            setPiezas((antes) =>
              antes.map((p) => (p.id === piezaAbierta.id ? { ...p, pedido: texto } : p))
            )
          }
          onGuardar={() => {
            aplicarYGuardar(
              piezas.map((p) => (p.id === piezaAbierta.id ? { ...p, editando: false } : p))
            );
            setAbierta(null);
          }}
          onEnviarEsta={() => setConfirmando({ soloEsta: piezaAbierta.id })}
          onAmpliar={(src, alt) => setAmpliada({ src, alt })}
        />
      )}

      {ampliada && (
        <Ampliada src={ampliada.src} alt={ampliada.alt} onCerrar={() => setAmpliada(null)} />
      )}

      {descargas && (
        <Descargas piezas={aprobadas} onCerrar={() => setDescargas(false)} />
      )}

      {comentando && (
        <ComentarioGeneral
          texto={comentarioGeneral}
          onEscribir={setComentarioGeneral}
          onCerrar={() => setComentando(false)}
          onEnviar={() => {
            setComentando(false);
            setAviso("Le mandamos tu comentario al equipo.");
            setComentarioGeneral("");
          }}
        />
      )}

      {confirmando && (
        <Confirmacion
          proyecto={entrega.proyecto}
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
    </>
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
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-lienzo shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start gap-3 border-b border-linea-tenue px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-guia font-semibold tracking-tight">{titulo}</h2>
            {bajada && <p className="mt-0.5 text-menudo text-apagado">{bajada}</p>}
          </div>
          <Boton variante="fantasma" tamano="chico" onClick={onCerrar} aria-label="Cerrar">
            <IconoCerrar />
          </Boton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {pie && (
          <footer className="border-t border-linea-tenue px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
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
      <ul className="flex flex-col divide-y divide-linea-tenue">
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
 * Un comentario sobre toda la entrega, no sobre una pieza.
 *
 * Existe porque no todo lo que el cliente quiere decir cabe adentro de una
 * pieza: «el tono de toda la campaña quedó muy frío», «¿podemos correr todo una
 * semana?». Sin este lugar, eso termina en un audio de WhatsApp y se pierde.
 *
 * Se manda solo, sin esperar a la revisión: no es una decisión sobre un
 * trabajo, es algo que conviene que la agencia lea cuanto antes.
 */
function ComentarioGeneral({
  texto,
  onEscribir,
  onCerrar,
  onEnviar,
}: {
  texto: string;
  onEscribir: (t: string) => void;
  onCerrar: () => void;
  onEnviar: () => void;
}) {
  return (
    <Ventana
      titulo="Comentario general"
      bajada="Sobre toda la entrega, no sobre una pieza en particular."
      onCerrar={onCerrar}
      pie={
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Boton ancho onClick={onEnviar} disabled={texto.trim().length === 0}>
            <IconoEnviar />
            Enviar comentario
          </Boton>
          <Boton variante="contorno" ancho onClick={onCerrar}>
            Volver
          </Boton>
        </div>
      }
    >
      <textarea
        value={texto}
        onChange={(e) => onEscribir(e.target.value)}
        rows={8}
        autoFocus
        placeholder="Lo que quieras decirle al equipo sobre el conjunto: el tono, las fechas, algo que se repite en varias piezas…"
        className="w-full resize-y rounded-xl border border-linea bg-lienzo p-4 text-normal
                   shadow-inner transition-colors placeholder:text-apagado
                   focus:border-acento focus:outline-none focus:ring-4 focus:ring-acento-tenue"
      />
      <p className="mt-3 text-menudo text-apagado">
        Este comentario se manda solo, sin esperar a que termines la revisión.
      </p>
    </Ventana>
  );
}

/**
 * El resumen antes de enviar.
 *
 * Enviar es el único acto de esta pantalla que la agencia ve, y no se deshace.
 * Merece que el cliente lea qué está mandando: qué aprobó, qué pidió cambiar
 * y —sobre todo— si quedó alguna sin mirar.
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
  piezas: Array<{ id: string; nombre: string; estado: Pieza["estado"]; pedido: string }>;
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
            <h3 className="text-micro uppercase tracking-[0.18em] text-listo">
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
            <h3 className="text-micro uppercase tracking-[0.18em] text-acento">
              Con cambios · {conCambios.length}
            </h3>
            <ul className="mt-3 flex flex-col gap-4">
              {conCambios.map((p) => (
                <li key={p.id}>
                  <p className="text-normal font-semibold">{p.nombre}</p>
                  <p className="mt-1 text-menudo text-tinta-suave">
                    {p.pedido.trim() || (
                      <span className="text-espera">Sin escribir qué cambiar</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sinRevisar.length > 0 && (
          <section className="rounded-xl bg-espera-tenue px-5 py-4">
            <h3 className="text-micro uppercase tracking-[0.18em] text-espera">
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
