"use client";

// El calendario de una carpeta, del lado de la agencia.
//
// Tres decisiones mandan sobre esta pantalla:
//
//   1. **No se edita por accidente.** Se mira, y recién al apretar «Editar» se
//      puede arrastrar. Un calendario siempre editable es un calendario que se
//      desarma con un clic mal dado, y acá cada pieza es una fecha de
//      publicación que alguien prometió.
//
//   2. **Se guarda de a una tanda.** Se acomodan varias piezas y recién ahí se
//      guarda; cancelar deja todo como estaba. Guardar en cada movimiento
//      dejaría a medio hacer cualquier reacomodo, y a mitad de camino el
//      calendario dice algo que nadie quiso decir.
//
//   3. **Se arrastra, pero también se puede sin arrastrar.** Arrastrar es lo
//      natural con el mouse y no existe con el teclado. Cada pieza puesta tiene
//      su botón para sacarla, y las que no tienen día se pueden asignar
//      eligiéndolas y tocando el día.
//
// Lo que se guarda acá es lo mismo que después ve el cliente en su portal: es
// el mismo dato leído por las dos pantallas, no dos copias.

import { useMemo, useState } from "react";
import { guardarCalendario } from "@/app/(admin)/gestion/acciones";
import type { PiezaParaFechar } from "@/admin/datos/carpetas";
import { Boton } from "@/ui/Boton";
import { IconoCerrar, IconoEditar, IconoEnviar, IconoFlecha } from "@/ui/Icono";
import { urlDeMiniatura } from "@/lib/miniaturas";

/** `AAAA-MM-DD` de un año, mes (0-11) y día. */
function dia(anio: number, mes: number, numero: number): string {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(numero).padStart(2, "0")}`;
}

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const nombreDelMes = (anio: number, mes: number) =>
  new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
    new Date(anio, mes, 1)
  );

/**
 * Los días de la grilla del mes, empezando en lunes.
 *
 * Devuelve `null` para los huecos de antes del primero y después del último:
 * así la grilla se dibuja sin que las celdas vacías finjan ser días.
 */
function grillaDelMes(anio: number, mes: number): Array<number | null> {
  const primero = new Date(anio, mes, 1);
  // `getDay()` cuenta desde el domingo; acá la semana arranca el lunes.
  const corrimiento = (primero.getDay() + 6) % 7;
  const cuantos = new Date(anio, mes + 1, 0).getDate();

  const celdas: Array<number | null> = Array(corrimiento).fill(null);
  for (let d = 1; d <= cuantos; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
}

type Props = {
  carpetaId: string;
  piezas: PiezaParaFechar[];
};

export function ArmarCalendario({ carpetaId, piezas }: Props) {
  // Lo guardado, y lo que se está tocando. Separados a propósito: cancelar es
  // volver a lo primero sin haberle preguntado nada al servidor.
  const [guardado, setGuardado] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(piezas.map((p) => [p.id, p.dia]))
  );
  const [borrador, setBorrador] = useState<Record<string, string | null> | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const editando = borrador !== null;
  const fechas = borrador ?? guardado;

  // El mes que se está mirando. Arranca en el de la primera pieza con fecha, o
  // en el actual si no hay ninguna: es lo que alguien espera ver al entrar.
  const [cursor, setCursor] = useState(() => {
    const conFecha = piezas.find((p) => p.dia);
    if (conFecha?.dia) {
      const [a, m] = conFecha.dia.split("-").map(Number);
      return { anio: a, mes: m - 1 };
    }
    const hoy = new Date();
    return { anio: hoy.getFullYear(), mes: hoy.getMonth() };
  });

  const porDia = useMemo(() => {
    const mapa = new Map<string, PiezaParaFechar[]>();
    for (const pieza of piezas) {
      const d = fechas[pieza.id];
      if (!d) continue;
      const lista = mapa.get(d) ?? [];
      lista.push(pieza);
      mapa.set(d, lista);
    }
    return mapa;
  }, [piezas, fechas]);

  const sinFecha = piezas.filter((p) => !fechas[p.id]);
  const celdas = grillaDelMes(cursor.anio, cursor.mes);

  const hayCambios =
    borrador !== null && piezas.some((p) => (borrador[p.id] ?? null) !== (guardado[p.id] ?? null));

  function moverMes(paso: -1 | 1) {
    setCursor(({ anio, mes }) => {
      const siguiente = mes + paso;
      if (siguiente < 0) return { anio: anio - 1, mes: 11 };
      if (siguiente > 11) return { anio: anio + 1, mes: 0 };
      return { anio, mes: siguiente };
    });
  }

  function ponerEn(piezaId: string, cuando: string | null) {
    if (!editando) return;
    setBorrador({ ...(borrador ?? {}), [piezaId]: cuando });
    setElegida(null);
  }

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    setAviso(null);
    try {
      const cambios = piezas
        .filter((p) => (borrador[p.id] ?? null) !== (guardado[p.id] ?? null))
        .map((p) => ({ archivo: p.id, dia: borrador[p.id] ?? null }));

      const r = await guardarCalendario(carpetaId, cambios);
      if (r.ok) {
        setGuardado(borrador);
        setBorrador(null);
        setAviso("Listo. El cliente ya lo ve así.");
      } else {
        setAviso(r.motivo);
      }
    } catch {
      setAviso("No pude guardar. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-6">
      {/* ===================== La barra de control ====================== */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-y-2 border-tinta py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => moverMes(-1)}
            aria-label="Mes anterior"
            className="grid h-10 w-10 place-items-center border-2 border-tinta text-tinta transition-colors hover:bg-hueco"
          >
            <IconoFlecha className="rotate-180" />
          </button>
          <p className="min-w-52 text-center text-titulo font-extrabold capitalize tracking-tight">
            {nombreDelMes(cursor.anio, cursor.mes)}
          </p>
          <button
            type="button"
            onClick={() => moverMes(1)}
            aria-label="Mes siguiente"
            className="grid h-10 w-10 place-items-center border-2 border-tinta text-tinta transition-colors hover:bg-hueco"
          >
            <IconoFlecha />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {!editando ? (
            <Boton variante="principal" onClick={() => setBorrador({ ...guardado })}>
              <IconoEditar />
              Editar fechas
            </Boton>
          ) : (
            <>
              <Boton
                variante="sutil"
                onClick={() => {
                  setBorrador(null);
                  setElegida(null);
                  setAviso(null);
                }}
              >
                Cancelar
              </Boton>
              <Boton
                variante="principal"
                onClick={guardar}
                disabled={guardando || !hayCambios}
              >
                <IconoEnviar />
                {guardando ? "Guardando…" : "Guardar"}
              </Boton>
            </>
          )}
        </div>
      </div>

      {aviso && (
        <p
          aria-live="polite"
          className="mt-4 border-l-4 border-acento bg-acento-tenue px-4 py-3 text-normal font-semibold text-acento"
        >
          {aviso}
        </p>
      )}

      {editando && (
        <p className="mt-4 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-menudo text-espera">
          Arrastrá las piezas hasta el día que salen. Sin mouse: tocá una pieza de abajo
          para elegirla y después tocá el día. Nada se guarda hasta que aprietes Guardar.
        </p>
      )}

      {/* ========================= El calendario ======================== */}
      <div className="mt-5 grid grid-cols-7 border-l border-t border-linea">
        {DIAS.map((d) => (
          <div
            key={d}
            className="border-b border-r border-linea bg-hueco px-2 py-2 text-center text-micro font-extrabold uppercase tracking-widest text-tinta-suave"
          >
            {d}
          </div>
        ))}

        {celdas.map((numero, i) => {
          if (numero === null) {
            return (
              <div key={`hueco-${i}`} className="min-h-28 border-b border-r border-linea bg-hueco/30" />
            );
          }

          const esteDia = dia(cursor.anio, cursor.mes, numero);
          const delDia = porDia.get(esteDia) ?? [];

          return (
            <div
              key={esteDia}
              onDragOver={(e) => {
                if (editando && arrastrando) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (arrastrando) ponerEn(arrastrando, esteDia);
                setArrastrando(null);
              }}
              onClick={() => elegida && ponerEn(elegida, esteDia)}
              className={`min-h-28 border-b border-r border-linea p-1.5 transition-colors ${
                editando && (elegida || arrastrando)
                  ? "cursor-pointer bg-acento-tenue/40 hover:bg-acento-tenue"
                  : ""
              }`}
            >
              <p className="cifras px-1 text-menudo font-extrabold text-apagado">{numero}</p>

              <ul className="mt-1 flex flex-col gap-1">
                {delDia.map((pieza) => (
                  <li key={pieza.id}>
                    <div
                      draggable={editando}
                      onDragStart={() => setArrastrando(pieza.id)}
                      onDragEnd={() => setArrastrando(null)}
                      className={`flex items-center gap-1.5 bg-tinta px-1.5 py-1 text-lienzo ${
                        editando ? "cursor-grab active:cursor-grabbing" : ""
                      } ${arrastrando === pieza.id ? "opacity-40" : ""}`}
                    >
                      <span className="relative h-7 w-7 shrink-0 overflow-hidden bg-lienzo/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={urlDeMiniatura(pieza.id, 110, pieza.modificado)}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-micro font-bold">
                        {pieza.nombre}
                      </span>
                      {editando && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            ponerEn(pieza.id, null);
                          }}
                          aria-label={`Sacar ${pieza.nombre} del calendario`}
                          className="grid h-5 w-5 shrink-0 place-items-center text-lienzo/60 transition-colors hover:text-lienzo"
                        >
                          <IconoCerrar />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ==================== Las que no tienen día ===================== */}
      <section className="mt-8">
        <h2 className="text-titulo font-extrabold tracking-tight">
          Sin fecha
          <span className="ml-2 text-normal font-semibold text-apagado">
            {sinFecha.length}
          </span>
        </h2>
        <p className="mt-1 text-menudo text-apagado">
          Estas no le aparecen al cliente en el calendario hasta que tengan día.
        </p>

        {sinFecha.length === 0 ? (
          <p className="mt-4 bg-acento-tenue px-4 py-3 text-normal font-semibold text-acento">
            Todas las piezas tienen su día.
          </p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {sinFecha.map((pieza) => {
              const activa = elegida === pieza.id;
              return (
                <li key={pieza.id}>
                  <button
                    type="button"
                    draggable={editando}
                    onDragStart={() => setArrastrando(pieza.id)}
                    onDragEnd={() => setArrastrando(null)}
                    onClick={() => editando && setElegida(activa ? null : pieza.id)}
                    disabled={!editando}
                    aria-pressed={activa}
                    className={`flex items-center gap-2 border-2 px-2 py-1.5 text-menudo font-bold transition-colors ${
                      activa
                        ? "border-acento bg-acento text-white"
                        : "border-tinta bg-lienzo text-tinta"
                    } ${editando ? "cursor-grab active:cursor-grabbing" : "opacity-60"}`}
                  >
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden bg-hueco">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={urlDeMiniatura(pieza.id, 110, pieza.modificado)}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </span>
                    <span className="max-w-40 truncate">{pieza.nombre}</span>
                    {pieza.vueltas > 1 && (
                      <span className="text-micro font-extrabold opacity-60">
                        v{pieza.vueltas}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
