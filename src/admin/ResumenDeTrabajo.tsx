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
import { abrirCarpeta } from "@/app/(admin)/gestion/acciones";
import { Estado } from "@/ui/Estado";
import { sigueEnJuego } from "@/dominio/pieza";
import { IconoCerrar } from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import type { NodoArchivo } from "@/admin/datos/arbol";
import type { CarpetaEnElTablero } from "@/admin/datos/tablero";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

const comoFecha = (dia: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  return fecha.format(new Date(a, m - 1, d));
};

export function ResumenDeTrabajo({
  carpeta: c,
  onCerrar,
}: {
  carpeta: CarpetaEnElTablero;
  onCerrar: () => void;
}) {
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);
  const [piezas, setPiezas] = useState<NodoArchivo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    abrirCarpeta(c.carpetaId, {
      dias: c.diasQueCorren,
      responsable: null,
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
  }, [c.carpetaId, c.diasQueCorren]);

  // Lo que ya no está en juego, aparte. El estado es de cada pieza: un trabajo
  // no está «aprobado», lo están algunas de sus piezas.
  const terminadas = (piezas ?? []).filter((p) => !sigueEnJuego(p.estado));
  const enJuego = (piezas ?? []).filter((p) => sigueEnJuego(p.estado));

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
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden bg-lienzo"
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
            <Dato que="En juego" es={String(c.enJuego)} />
            {c.terminadas > 0 && <Dato que="Terminadas" es={String(c.terminadas)} />}
            {c.sinEntregar > 0 && <Dato que="Sin entregar" es={String(c.sinEntregar)} alerta />}
            {c.sinRevisar > 0 && <Dato que="Sin revisar" es={String(c.sinRevisar)} />}
            {c.vence && (
              <Dato
                que={c.vencida ? "Venció" : "Vence"}
                es={fecha.format(c.vence)}
                alerta={c.vencida}
              />
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/gestion/cliente/${c.clienteId}/carpeta/${c.carpetaId}`}
              className="min-h-toque inline-flex items-center border-2 border-tinta px-4
                         text-normal font-bold tracking-tight text-tinta transition-colors hover:bg-hueco"
            >
              Abrir la carpeta
            </Link>
            {c.sinLeer > 0 && (
              <Link
                href="/gestion/chats"
                className="min-h-toque inline-flex items-center bg-acento px-4 text-normal
                           font-bold tracking-tight text-white transition-colors hover:bg-acento-hover"
              >
                {c.sinLeer} sin leer
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
              {enJuego.length > 0 && <Lista piezas={enJuego} />}

              {/*
                **Lo terminado va abajo y bajo su propio título.** Mezclado
                arriba, una pieza aprobada se lee como una más de las que hay
                que mirar, que es justo lo contrario de lo que es. Y no se
                esconde: sigue estando, con su estado, porque acá nada
                desaparece.
              */}
              {terminadas.length > 0 && (
                <>
                  {enJuego.length > 0 && (
                    <h3 className="mt-5 text-micro font-extrabold uppercase tracking-widest text-apagado">
                      Ya está · en «Entregas finales»
                    </h3>
                  )}
                  <Lista piezas={terminadas} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Lista({ piezas }: { piezas: NodoArchivo[] }) {
  return (
    <ul className="mt-2 border-t border-linea">
      {piezas.map((p) => (
        <li
          key={p.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-linea py-3"
        >
          <span className="min-w-0 flex-1 font-bold tracking-tight">{p.nombre}</span>
          {p.vueltas > 1 && (
            <span className="shrink-0 text-micro text-apagado">{p.vueltas} vueltas</span>
          )}
          {p.publicaEl && (
            <span className="cifras shrink-0 text-micro text-apagado">
              sale el {comoFecha(p.publicaEl)}
            </span>
          )}
          <Estado estado={p.estado} />
        </li>
      ))}
    </ul>
  );
}

function Dato({ que, es, alerta }: { que: string; es: string; alerta?: boolean }) {
  return (
    <span className="flex flex-col">
      <span className="text-micro font-extrabold uppercase tracking-widest text-apagado">
        {que}
      </span>
      <span
        className={`text-normal font-bold tracking-tight ${alerta ? "text-alerta" : ""}`}
      >
        {es}
      </span>
    </span>
  );
}
