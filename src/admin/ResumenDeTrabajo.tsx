"use client";

// El resumen de un trabajo, en una ventana.
//
// Existe porque el tablero tiene que poder mirarse sin abandonarlo. Antes, para
// saber qué había adentro de una carpeta había que irse a la ficha del cliente,
// abrir el árbol y volver: cuatro pantallas para contestar «¿qué es lo que
// falta acá?». Eso hace que el tablero deje de ser el lugar donde se mira cómo
// viene todo y pase a ser un índice.
//
// **Las piezas se piden al abrir y no antes.** El tablero ya cuesta una vuelta
// a Drive por carpeta; traer además todas las piezas de todas las carpetas para
// una ventana que se abre de a una sería pagar por adelantado algo que casi
// nunca se mira.

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  abrirCarpeta,
  guardarCarpeta,
  historiaDeCarpeta,
} from "@/app/(admin)/gestion/acciones";
import { DetalleDePieza } from "@/admin/DetalleDePieza";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import { Entregar } from "@/admin/Entregar";
import { Estado } from "@/ui/Estado";
import { Miniatura } from "@/ui/Miniatura";
import { urlDeMiniatura } from "@/lib/miniaturas";
import { hayAlgoParaEntregar, sigueEnJuego } from "@/dominio/pieza";
import { IconoCerrar } from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import type { NodoArchivo } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

const comoFecha = (dia: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  return fecha.format(new Date(a, m - 1, d));
};

/**
 * Lo que esta ventana necesita saber de un trabajo.
 *
 * **Es su propio tipo y no el del tablero.** La abren dos pantallas que
 * guardan cosas distintas —el tablero y el árbol de clientes—, y obligar a una
 * a fabricar la forma de la otra terminaba en campos inventados. Acá se pide
 * lo que de verdad se usa, y lo que no siempre se sabe va opcional: la ventana
 * lo saca de las piezas apenas llegan.
 */
export type TrabajoParaMirar = {
  clienteId: string;
  cliente: string;
  carpetaId: string;
  carpeta: string;
  /** Lo que se hereda hacia las piezas. */
  diasQueCorren: number;
  responsableQueCorre: string | null;
  asignadaA: string | null;
  visible: boolean;
  /** Si el cliente la ve como lista o como calendario. */
  vista: "lista" | "calendario";
  /** Lo que el tablero ya sabe, para dibujar sin esperar a Drive. */
  enJuego?: number;
  terminadas?: number;
  sinEntregar?: number;
  sinRevisar?: number;
  vence?: Date | null;
  vencida?: boolean;
  porVencer?: boolean;
  sinLeer?: number;
};

export function ResumenDeTrabajo({
  carpeta: c,
  equipo,
  soloPieza,
  onCerrar,
}: {
  carpeta: TrabajoParaMirar;
  equipo: Persona[];
  /**
   * Una sola pieza, cuando se abre desde su archivo.
   *
   * **Desde el árbol se abre por archivo y no por carpeta**: una carpeta con
   * dos archivos no deja decir cuál se quiere mirar. Desde el tablero se abre
   * la carpeta entera, que es lo que ahí se está mirando, y entonces se ven
   * todas sus piezas una abajo de la otra. La ventana es la misma.
   */
  soloPieza?: string;
  onCerrar: () => void;
}) {
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);
  const [piezas, setPiezas] = useState<NodoArchivo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Se vuelve a pedir la carpeta cuando algo de acá adentro la cambió —una
  // entrega—, para que la lista no siga mostrando lo de hace un minuto.
  const [vuelta, setVuelta] = useState(0);

  // Si al entregar se cambió el plazo, manda ese: la foto del tablero se sacó
  // antes y diría el viejo al lado del mensaje que prometió el nuevo.
  const [diasPuestos, setDiasPuestos] = useState<number | null>(null);
  const diasQueCorren = diasPuestos ?? c.diasQueCorren;

  // Lo que pasó en cada pieza: los cambios que pidió el cliente, lo que
  // escribieron encima del archivo en Drive, y cuándo. Se pide aparte porque
  // cuesta una vuelta por pieza y solo hace falta con la ventana abierta.
  const [historia, setHistoria] = useState<PiezaConHistoria[] | null>(null);

  useEffect(() => {
    let vivo = true;
    historiaDeCarpeta(c.carpetaId)
      .then((r) => vivo && r.ok && setHistoria(r.piezas))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [c.carpetaId, vuelta]);

  useEffect(() => {
    let vivo = true;
    abrirCarpeta(c.carpetaId, {
      dias: c.diasQueCorren,
      responsable: c.responsableQueCorre,
    })
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setPiezas(r.contenido.archivos);
        else setError(r.motivo);
      })
      .catch(() => vivo && setError("No pude leer la carpeta."));
    return () => {
      vivo = false;
    };
  }, [c.carpetaId, c.diasQueCorren, c.responsableQueCorre, vuelta]);

  // Lo que ya no está en juego, aparte. El estado es de cada pieza: un trabajo
  // no está «aprobado», lo están algunas de sus piezas.
  // Cuando se abrió desde un archivo, la ventana es de esa pieza y nada más.
  const aLaVista = (piezas ?? []).filter((p) => !soloPieza || p.id === soloPieza);

  const terminadas = aLaVista.filter((p) => !sigueEnJuego(p.estado));
  const enJuego = aLaVista.filter((p) => sigueEnJuego(p.estado));

  // **Los números salen de las piezas apenas llegan, y del tablero mientras
  // tanto.** El tablero es una foto sacada al abrir la pantalla: si desde acá
  // se entrega algo, esa foto queda vieja en el acto y diría «1 sin entregar»
  // al lado de un botón que ya no tiene nada que entregar.
  const cargadas = piezas !== null;
  // La misma regla que el tablero, no «está de nuestro lado»: una pieza que
  // el cliente devolvió con cambios no tiene nada nuevo para entregar hasta
  // que aparezca la vuelta siguiente. Acá se calculaba distinto, y la ventana
  // ofrecía entregar lo que la columna de al lado decía que no.
  const sinEntregar = cargadas
    ? enJuego.filter((p) => hayAlgoParaEntregar(p.estado, p.ronda, p.vueltas)).length
    : (c.sinEntregar ?? 0);
  const sinRevisar = cargadas
    ? enJuego.filter((p) => p.estado === "entregada" || p.estado === "en_revision").length
    : (c.sinRevisar ?? 0);
  const cuantasEnJuego = cargadas ? enJuego.length : (c.enJuego ?? 0);
  const cuantasTerminadas = cargadas ? terminadas.length : (c.terminadas ?? 0);
  const sinLeer = c.sinLeer ?? 0;

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
        aria-label={`${c.cliente}: ${c.carpeta}`}
        onClick={(e) => e.stopPropagation()}
        // Grande: acá adentro está todo lo del trabajo —las piezas con su
        // imagen, lo que pidió el cliente, los comentarios de Drive, la
        // historia y la configuración—. En una ventana angosta eso es una
        // columna de renglones partidos.
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden bg-lienzo"
      >
        <header className="flex items-start gap-3 bg-tinta px-5 py-4 text-lienzo">
          <div className="min-w-0 flex-1">
            <p className="text-micro font-extrabold uppercase tracking-widest text-lienzo/45">
              {c.cliente}
            </p>
            <h2 className="text-titulo font-extrabold leading-tight tracking-tight">
              {c.carpeta}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center bg-lienzo text-tinta transition-colors hover:bg-lienzo/90"
          >
            <IconoCerrar />
          </button>
        </header>

        {/*
          **Una sola línea con lo del trabajo entero.** Tenía un bloque con
          «quién lo lleva», «vence» y «plazo», y esos tres volvían a aparecer
          al lado de cada pieza: lo mismo escrito dos veces en la misma
          pantalla, a diez centímetros. Lo que es de la carpeta se dice acá —y
          es poco—; lo de cada pieza va con su pieza.
        */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b-2 border-tinta px-5 py-3">
          <p className="text-menudo text-apagado">
            {cuantasEnJuego} en juego
            {sinEntregar > 0 && (
              <span className="font-bold text-acento"> · {sinEntregar} sin entregar</span>
            )}
            {sinRevisar > 0 && ` · ${sinRevisar} sin revisar`}
            {cuantasTerminadas > 0 && ` · ${cuantasTerminadas} aprobadas`}
            {` · ${diasQueCorren} ${diasQueCorren === 1 ? "día" : "días"} para revisar`}
          </p>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Calendario
              carpetaId={c.carpetaId}
              carpeta={c.carpeta}
              vista={c.vista}
              alGuardar={() => setVuelta((n) => n + 1)}
            />
            <Entregar
              carpetaId={c.carpetaId}
              carpeta={c.carpeta}
              cuantas={sinEntregar}
              dias={diasQueCorren}
              alEntregar={(dias) => {
                if (dias !== undefined) setDiasPuestos(dias);
                setVuelta((n) => n + 1);
              }}
            />
            <Link
              href={`/gestion/cliente/${c.clienteId}/carpeta/${c.carpetaId}`}
              className="min-h-toque inline-flex items-center border-2 border-tinta px-3
                         text-menudo font-bold tracking-tight text-tinta transition-colors hover:bg-hueco"
            >
              Abrir la carpeta
            </Link>
            {sinLeer > 0 && (
              <Link
                href="/gestion/chats"
                className="min-h-toque inline-flex items-center bg-acento px-3 text-menudo
                           font-bold tracking-tight text-white transition-colors hover:bg-acento-hover"
              >
                {sinLeer} sin leer
              </Link>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="text-normal font-semibold text-alerta">{error}</p>}

          {!error && piezas === null && (
            <p className="text-normal text-apagado">Leyendo la carpeta…</p>
          )}

          {piezas?.length === 0 && (
            <p className="text-normal text-apagado">Esta carpeta no tiene piezas.</p>
          )}

          {piezas && piezas.length > 0 && (
            <>
              {enJuego.length > 0 && (
                <Lista
                  piezas={enJuego}
                  historia={historia}
                  equipo={equipo}
                  onCambio={() => setVuelta((n) => n + 1)}
                />
              )}

              {/*
                **Lo aprobado va abajo y bajo su propio título.** Mezclado
                arriba, una pieza aprobada se lee como una más de las que hay
                que mirar, que es justo lo contrario de lo que es. Y no se
                esconde: sigue estando, con su estado, porque acá nada
                desaparece.
              */}
              {terminadas.length > 0 && (
                <>
                  {enJuego.length > 0 && (
                    <h3 className="mt-5 text-micro font-extrabold uppercase tracking-widest text-apagado">
                      Ya aprobadas
                    </h3>
                  )}
                  <Lista
                    piezas={terminadas}
                    historia={historia}
                    equipo={equipo}
                    onCambio={() => setVuelta((n) => n + 1)}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Lista({
  piezas,
  historia,
  equipo,
  onCambio,
}: {
  piezas: NodoArchivo[];
  historia: PiezaConHistoria[] | null;
  equipo: Persona[];
  onCambio: () => void;
}) {
  return (
    <ul className="mt-2 border-t border-linea">
      {piezas.map((p) => (
        <Pieza
          key={p.id}
          pieza={p}
          detalle={historia?.find((h) => h.id === p.id)}
          equipo={equipo}
          onCambio={onCambio}
        />
      ))}
    </ul>
  );
}

/**
 * Una pieza, con lo que hace falta para no tener que abrir la carpeta.
 *
 * **La miniatura importa más de lo que parece.** Una lista de nombres obliga a
 * acordarse de qué era «9312»; con la imagen al lado se reconoce sin leer, que
 * es la diferencia entre mirar el tablero y tener que ir a buscar.
 *
 * Debajo del nombre va lo que cambia decisiones: quién lo lleva, cuándo vence,
 * cuándo sale publicado. Arriba, lo que lo identifica: la vuelta en la que va y
 * si el cliente lo ve.
 */
function Pieza({
  pieza: p,
  detalle,
  equipo,
  onCambio,
}: {
  pieza: NodoArchivo;
  detalle?: PiezaConHistoria;
  equipo: Persona[];
  onCambio: () => void;
}) {
  // La última vuelta es la que se está mirando, y es la que tiene imagen.
  const archivo = p.archivos[p.archivos.length - 1];
  const anterior = p.archivos[p.archivos.length - 2];

  // **Comparar es la pregunta de la agencia, no solo la del cliente.** Antes
  // de entregar una vuelta nueva, lo que se quiere ver es qué cambió respecto
  // de la anterior; el cliente ya podía y nosotros no.
  const [comparando, setComparando] = useState(false);

  return (
    // **La misma forma que la ventana del cliente**: la pieza grande de un
    // lado y todo lo que se sabe de ella del otro. Era una lista de renglones
    // con una miniatura de estampilla, y de un trabajo lo primero que se mira
    // es el trabajo.
    <li className="border-b border-linea py-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-2">
          <div className={`grid gap-1 ${comparando && anterior ? "grid-cols-2" : ""}`}>
            {comparando && anterior && (
              <Vuelta
                archivo={anterior}
                nombre={p.nombre}
                rotulo={`v${p.vueltas - 1}`}
              />
            )}
            <Vuelta
              archivo={archivo}
              nombre={p.nombre}
              modificado={p.modificado}
              rotulo={comparando && anterior ? `v${p.vueltas}` : undefined}
            />
          </div>

          {anterior && (
            <button
              type="button"
              onClick={() => setComparando(!comparando)}
              aria-pressed={comparando}
              className={`min-h-toque border-2 border-tinta px-3 text-menudo font-bold
                          tracking-tight transition-colors ${
                            comparando
                              ? "bg-tinta text-lienzo"
                              : "text-tinta hover:bg-hueco"
                          }`}
            >
              {comparando ? "Ver solo la última" : `Comparar con la v${p.vueltas - 1}`}
            </button>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 text-guia font-extrabold tracking-tight">
              {p.nombre}
            </span>
            {p.vueltas > 1 && (
              <span className="text-micro font-extrabold uppercase tracking-wider text-apagado">
                v{p.vueltas}
              </span>
            )}
            {!p.visible && (
              <span className="bg-tinta px-1.5 py-0.5 text-micro font-extrabold uppercase tracking-wider text-lienzo">
                Oculta
              </span>
            )}
            <Estado estado={p.estado} />
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-micro text-apagado">
            <span>{p.responsableA ?? "sin asignar"}</span>
            {p.vence && <span className="cifras">· vence {comoFecha(p.vence)}</span>}
            {p.publicaEl && (
              <span className="cifras">· sale el {comoFecha(p.publicaEl)}</span>
            )}
          </p>

          {/* Todo lo que pasó con esta pieza: lo que pidió el cliente, lo que
              escribieron en Drive, y qué se puede hacer. */}
          {detalle && (
            <DetalleDePieza
              pieza={detalle}
              archivo={p}
              carpetaId={p.id.split("::")[0]}
              equipo={equipo}
              onCambio={onCambio}
            />
          )}
        </div>
      </div>
    </li>
  );
}


/**
 * Cómo ve el cliente esta carpeta: una lista o un calendario.
 *
 * **Es de la carpeta y no de la pieza**, por eso vive arriba y no al lado de
 * cada imagen. Estaba solo en el engranaje del árbol, a tres pantallas de acá.
 */
function Calendario({
  carpetaId,
  carpeta,
  vista,
  alGuardar,
}: {
  carpetaId: string;
  carpeta: string;
  vista: "lista" | "calendario";
  alGuardar: () => void;
}) {
  const [estado, guardar, yendo] = useActionState(guardarCarpeta, null);

  useEffect(() => {
    if (estado?.ok) alGuardar();
  }, [estado, alGuardar]);

  const calendario = vista === "calendario";

  return (
    <form action={guardar} className="flex items-center gap-2">
      <input type="hidden" name="carpetaId" value={carpetaId} />
      <input type="hidden" name="nombre" value={carpeta} />
      <input type="hidden" name="vista" value={calendario ? "lista" : "calendario"} />
      <button
        type="submit"
        disabled={yendo}
        aria-pressed={calendario}
        title={
          calendario
            ? "El cliente lo ve como calendario. Tocá para volverlo una lista."
            : "El cliente lo ve como una lista. Tocá para mostrarlo como calendario."
        }
        className={`min-h-toque inline-flex items-center border-2 border-tinta px-3
                    text-menudo font-bold tracking-tight transition-colors
                    disabled:opacity-40 ${
                      calendario ? "bg-tinta text-lienzo" : "text-tinta hover:bg-hueco"
                    }`}
      >
        Calendario
      </button>
    </form>
  );
}

/**
 * Una vuelta de la pieza: la imagen, y tocándola se abre el archivo.
 *
 * Lleva su número cuando hay dos al lado: sin eso, comparar es mirar dos
 * imágenes parecidas sin saber cuál es cuál.
 */
function Vuelta({
  archivo,
  nombre,
  modificado,
  rotulo,
}: {
  archivo: string;
  nombre: string;
  modificado?: string;
  rotulo?: string;
}) {
  return (
    <a
      href={`/api/archivo/${archivo}?ver=1`}
      target="_blank"
      rel="noreferrer noopener"
      title={`Abrir ${nombre}`}
      className="relative block h-56 w-full overflow-hidden border border-linea bg-hueco
                 transition-colors hover:border-tinta"
    >
      <Miniatura
        src={urlDeMiniatura(archivo, 800, modificado)}
        alt={nombre}
        nombre={nombre}
        className="absolute inset-0 h-full w-full object-contain p-1"
      />
      {rotulo && (
        <span className="absolute left-0 top-0 bg-tinta px-1.5 py-0.5 text-micro font-extrabold uppercase tracking-wider text-lienzo">
          {rotulo}
        </span>
      )}
    </a>
  );
}
