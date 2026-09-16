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

import { useEffect, useState } from "react";
import Link from "next/link";
import { abrirCarpeta, historiaDeCarpeta } from "@/app/(admin)/gestion/acciones";
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
import { Visibilidad } from "@/admin/Visibilidad";
import { Responsable } from "@/admin/Responsable";
import { DiasDeRevision } from "@/admin/DiasDeRevision";
import { Plegable } from "@/admin/Plegable";

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
  onCerrar,
}: {
  carpeta: TrabajoParaMirar;
  equipo: Persona[];
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
  const terminadas = (piezas ?? []).filter((p) => !sigueEnJuego(p.estado));
  const enJuego = (piezas ?? []).filter((p) => sigueEnJuego(p.estado));

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

        {/* Lo que ya sabe el tablero se muestra enseguida, sin esperar a Drive:
            es la mitad de la respuesta y llega gratis. */}
        <div className="border-b-2 border-tinta px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Dato que="Quién lo lleva" es={c.asignadaA ?? "sin asignar"} />
            {/* En juego y terminadas van separadas porque son dos cosas
                distintas: una pide algo, la otra ya no. */}
            <Dato que="En juego" es={String(cuantasEnJuego)} />
            {cuantasTerminadas > 0 && (
              <Dato que="Aprobadas" es={String(cuantasTerminadas)} />
            )}
            {sinEntregar > 0 && (
              <Dato que="Sin entregar" es={String(sinEntregar)} tono="alerta" />
            )}
            {sinRevisar > 0 && <Dato que="Sin revisar" es={String(sinRevisar)} />}
            {c.vence && (
              <Dato
                que={c.vencida ? "Venció" : "Vence"}
                es={fecha.format(c.vence)}
                tono={c.vencida ? "alerta" : c.porVencer ? "espera" : undefined}
              />
            )}
            <Dato
              que="Plazo"
              es={`${diasQueCorren} ${diasQueCorren === 1 ? "día" : "días"}`}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/*
              **Entregar se hace desde acá.** El tablero es la pantalla donde se
              mira cómo viene todo, y lo que más seguido hay que hacer después
              de mirar es entregar. Mandar a buscar el mismo botón al árbol del
              cliente es pedir tres pantallas para un clic.
            */}
            {/* Sin condición afuera: «Entregar» decide solo si se muestra. Con
                una condición acá, entregar lo último lo desmonta —y se lleva
                puesto el mensaje para el cliente, justo cuando hace falta—. Ya
                había pasado en el árbol. */}
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
              className="min-h-toque inline-flex items-center border-2 border-tinta px-4
                         text-normal font-bold tracking-tight text-tinta transition-colors hover:bg-hueco"
            >
              Abrir la carpeta
            </Link>
            {sinLeer > 0 && (
              <Link
                href="/gestion/chats"
                className="min-h-toque inline-flex items-center bg-acento px-4 text-normal
                           font-bold tracking-tight text-white transition-colors hover:bg-acento-hover"
              >
                {sinLeer} sin leer
              </Link>
            )}
          </div>

          {/*
            **La configuración, acá adentro.** Lo que más se cambia de un
            trabajo mirándolo es quién lo lleva, cuántos días tiene el cliente
            y si lo ve: las tres cosas estaban en otra pantalla, y para tocar
            una había que cerrar esto, buscar el cliente, abrir el árbol y
            encontrar la carpeta.

            Plegado, porque se mira mucho más de lo que se cambia.
          */}
          <div className="mt-3 border-t border-linea pt-3">
            <Plegable titulo={<span className="text-normal">Configurar</span>}>
              <div className="mt-3 flex flex-wrap items-start gap-x-8 gap-y-4">
                <Visibilidad
                  ids={[c.carpetaId]}
                  visible={c.visible}
                  que="carpeta"
                  alGuardar={() => setVuelta((n) => n + 1)}
                />
                <section>
                  <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
                    Quién lo lleva
                  </h4>
                  <div className="mt-2">
                    <Responsable
                      nivel="carpeta"
                      id={c.carpetaId}
                      quien={c.responsableQueCorre}
                      propio={false}
                      equipo={equipo}
                      alGuardar={() => setVuelta((n) => n + 1)}
                    />
                  </div>
                </section>
                <section>
                  <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
                    Tiempo de revisión
                  </h4>
                  <div className="mt-2">
                    <DiasDeRevision
                      nivel="carpeta"
                      id={c.carpetaId}
                      dias={diasQueCorren}
                      propio={false}
                      alGuardar={() => setVuelta((n) => n + 1)}
                    />
                  </div>
                </section>
              </div>
            </Plegable>
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
              {enJuego.length > 0 && <Lista piezas={enJuego} historia={historia} onCambio={() => setVuelta((n) => n + 1)} />}

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
                  <Lista piezas={terminadas} historia={historia} onCambio={() => setVuelta((n) => n + 1)} />
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
  onCambio,
}: {
  piezas: NodoArchivo[];
  historia: PiezaConHistoria[] | null;
  onCambio: () => void;
}) {
  return (
    <ul className="mt-2 border-t border-linea">
      {piezas.map((p) => (
        <Pieza
          key={p.id}
          pieza={p}
          detalle={historia?.find((h) => h.id === p.id)}
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
  onCambio,
}: {
  pieza: NodoArchivo;
  detalle?: PiezaConHistoria;
  onCambio: () => void;
}) {
  // La última vuelta es la que se está mirando, y es la que tiene imagen.
  const archivo = p.archivos[p.archivos.length - 1];

  return (
    // En columna: arriba el renglón de siempre, abajo el detalle a lo ancho.
    // En una sola fila, el detalle —que ocupa todo— aplastaba la miniatura y el
    // nombre hasta partirlos en una palabra por línea.
    <li className="flex flex-col gap-2 border-b border-linea py-3">
      <div className="flex items-start gap-3">
      <span className="relative h-11 w-11 shrink-0 overflow-hidden bg-hueco">
        <Miniatura
          src={urlDeMiniatura(archivo, 220, p.modificado)}
          alt=""
          nombre={p.nombre}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 font-bold tracking-tight">{p.nombre}</span>
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
        </div>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-micro text-apagado">
          <span>{p.responsableA ?? "sin asignar"}</span>
          {p.vence && <span className="cifras">· vence {comoFecha(p.vence)}</span>}
          {p.publicaEl && <span className="cifras">· sale el {comoFecha(p.publicaEl)}</span>}
        </p>
      </div>

        <Estado estado={p.estado} />
      </div>

      {/* Todo lo que pasó con esta pieza, abajo y a lo ancho: lo que pidió el
          cliente, lo que escribieron en Drive, y qué se puede hacer. Es lo que
          antes obligaba a irse a la pantalla de la carpeta. */}
      {detalle && (
        <DetalleDePieza
          pieza={detalle}
          carpetaId={p.id.split("::")[0]}
          onCambio={onCambio}
        />
      )}
    </li>
  );
}

function Dato({
  que,
  es,
  tono,
}: {
  que: string;
  es: string;
  /** Rojo cuando ya pasó, naranja cuando está por pasar. */
  tono?: "alerta" | "espera";
}) {
  return (
    <span className="flex flex-col">
      <span className="text-micro font-extrabold uppercase tracking-widest text-apagado">
        {que}
      </span>
      <span
        className={`text-normal font-bold tracking-tight ${
          tono === "alerta" ? "text-alerta" : tono === "espera" ? "text-espera" : ""
        }`}
      >
        {es}
      </span>
    </span>
  );
}
