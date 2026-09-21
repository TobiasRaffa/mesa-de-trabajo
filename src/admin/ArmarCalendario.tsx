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

import { useEffect, useMemo, useState } from "react";
import { guardarCalendario } from "@/app/(admin)/gestion/acciones";
import type { PiezaParaFechar } from "@/admin/datos/carpetas";
import { Boton } from "@/ui/Boton";
import { IconoCerrar, IconoEditar, IconoEnviar, IconoFlecha } from "@/ui/Icono";
import { urlDeMiniatura } from "@/lib/miniaturas";
import { enPalabrasElMes } from "@/dominio/tiempo";
import { Miniatura } from "@/ui/Miniatura";

/** `AAAA-MM-DD` de un año, mes (0-11) y día. */
function dia(anio: number, mes: number, numero: number): string {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(numero).padStart(2, "0")}`;
}

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * «septiembre 2026».
 *
 * **Al mediodía UTC, no a la medianoche del navegador.** Se armaba con
 * `new Date(anio, mes, 1)` —medianoche de quien mira— y se formateaba en
 * Buenos Aires: en un servidor en UTC, la medianoche del 1 de octubre es el 30
 * de septiembre a las 21 allá, así que el encabezado decía «septiembre» sobre
 * la grilla de octubre. Es el mismo truco que usa `enPalabrasElDia`.
 */
const nombreDelMes = (anio: number, mes: number) =>
  enPalabrasElMes(new Date(Date.UTC(anio, mes, 1, 12)));

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
  /**
   * Si el cliente ve esta carpeta.
   *
   * El mensaje de éxito decía «El cliente ya lo ve así» siempre, también en
   * una carpeta oculta, donde el cliente no ve nada.
   */
  visible?: boolean;
};

export function ArmarCalendario({ carpetaId, piezas, visible = true }: Props) {
  // Lo guardado, y lo que se está tocando. Separados a propósito: cancelar es
  // volver a lo primero sin haberle preguntado nada al servidor.
  const [guardado, setGuardado] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(piezas.map((p) => [p.id, p.dia]))
  );
  const [borrador, setBorrador] = useState<Record<string, string | null> | null>(null);

  // **Y se actualiza cuando el servidor trae otras piezas.** Se inicializaba
  // una sola vez: después de que alguien más guardara, o de que apareciera un
  // archivo nuevo en Drive, llegaban piezas que `guardado` no tenía, así que
  // caían en «Sin fecha» aunque tuvieran día puesto —y si se editaba, se
  // mandaba ese estado viejo—. Mientras hay un borrador no se toca nada: lo
  // que se está editando no puede moverse bajo la mano.
  const [piezasVistas, setPiezasVistas] = useState(piezas);
  if (piezas !== piezasVistas && borrador === null) {
    setPiezasVistas(piezas);
    setGuardado(Object.fromEntries(piezas.map((p) => [p.id, p.dia])));
  }
  const [elegida, setElegida] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // **El tono va con el texto.** Un error de guardado se dibujaba con el mismo
  // marco violeta que «Listo»: se apretaba Guardar, aparecía un cartel, y
  // había que leerlo entero para descubrir que no se había guardado nada.
  const [aviso, setAviso] = useState<{ tono: "ok" | "mal"; texto: string } | null>(null);

  const editando = borrador !== null;

  // Cómo se llama la pieza que está esperando un día. Va en la etiqueta del
  // botón de cada número: con lector de pantalla, «Poner el 18» no dice qué se
  // está poniendo, y hay una sola pieza elegida a la vez.
  const nombreDeLaElegida = piezas.find((p) => p.id === elegida)?.nombre ?? "la pieza";
  const fechas = borrador ?? guardado;

  // El mes que se está mirando. Arranca en el de la primera pieza con fecha, o
  // en el actual si no hay ninguna: es lo que alguien espera ver al entrar.
  // **La más temprana, no la primera que devolvió Drive.** Se tomaba
  // `piezas.find((p) => p.dia)`, o sea la que viniera primera en la lista, que
  // es el orden de Drive: con una pieza de noviembre antes que las de
  // septiembre, el calendario abría en noviembre, vacío, y las otras parecían
  // no estar.
  const [cursor, setCursor] = useState(() => {
    const fechados = piezas.map((p) => p.dia).filter((d): d is string => Boolean(d));
    const primera = fechados.length > 0 ? fechados.reduce((a, b) => (a < b ? a : b)) : null;
    if (primera) {
      const [a, m] = primera.split("-").map(Number);
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

  // **Las que están fechadas en otro mes.** Mirando septiembre, una pieza de
  // octubre no aparece en la grilla ni en «Sin fecha»: no está en ningún lado,
  // y del lado de la agencia eso se lee como que se perdió. El portal ya avisa
  // de esto; acá faltaba.
  const mesActual = `${cursor.anio}-${String(cursor.mes + 1).padStart(2, "0")}`;
  const enOtrosMeses = piezas.filter((p) => {
    const d = fechas[p.id];
    return d && !d.startsWith(mesActual);
  });

  const hayCambios =
    borrador !== null && piezas.some((p) => (borrador[p.id] ?? null) !== (guardado[p.id] ?? null));

  // **Salir con cambios sin guardar pregunta antes.** El borrador vive en la
  // memoria de esta pantalla: tocar «volver», cerrar la pestaña o recargar lo
  // tiraba entero y sin una palabra, después de veinte arrastres.
  useEffect(() => {
    if (!hayCambios) return;

    const alIrse = (e: BeforeUnloadEvent) => e.preventDefault();

    // Un enlace de la aplicación no dispara `beforeunload`: Next navega sin
    // recargar. Se atiende el clic antes de que llegue al enlace.
    const alTocar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const destino = (e.target as Element | null)?.closest?.("a[href]");
      if (!(destino instanceof HTMLAnchorElement)) return;
      if (destino.target === "_blank") return;
      if (destino.href === location.href) return;
      if (!confirm("Tenés fechas sin guardar. ¿Salís igual y las perdés?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", alIrse);
    document.addEventListener("click", alTocar, true);
    return () => {
      window.removeEventListener("beforeunload", alIrse);
      document.removeEventListener("click", alTocar, true);
    };
  }, [hayCambios]);

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
        .map((p) => ({ pieza: p.id, dia: borrador[p.id] ?? null }));

      const r = await guardarCalendario(carpetaId, cambios);
      if (r.ok) {
        setGuardado(borrador);
        setBorrador(null);
        setAviso({
          tono: "ok",
          texto: visible
            ? "Listo. El cliente ya lo ve así."
            : "Listo. Guardadas. Esta carpeta está oculta: el cliente todavía no las ve.",
        });
      } else {
        setAviso({ tono: "mal", texto: r.motivo });
      }
    } catch {
      setAviso({ tono: "mal", texto: "No pude guardar. Probá de nuevo." });
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
            className="rounded-full grid h-10 w-10 place-items-center border-2 border-tinta text-tinta transition-colors hover:bg-hueco"
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
            className="rounded-full grid h-10 w-10 place-items-center border-2 border-tinta text-tinta transition-colors hover:bg-hueco"
          >
            <IconoFlecha />
          </button>
          {/* Después de tres meses de flechas, volver al de hoy era tres
              flechas más. */}
          <button
            type="button"
            onClick={() => {
              const hoy = new Date();
              setCursor({ anio: hoy.getFullYear(), mes: hoy.getMonth() });
            }}
            className="min-h-toque px-2 text-menudo font-bold text-apagado underline
                       underline-offset-4 transition-colors hover:text-tinta"
          >
            Hoy
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {!editando ? (
            <Boton
              variante="principal"
              onClick={() => {
                setBorrador({ ...guardado });
                // Si no, el «Listo» de hace veinte minutos sigue colgado
                // arriba mientras se mueven fechas nuevas.
                setAviso(null);
              }}
            >
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
                {/* Apagado y sin decir por qué es un botón roto: con el
                    borrador recién abierto todavía no hay nada que guardar. */}
                {guardando ? "Guardando…" : hayCambios ? "Guardar" : "Sin cambios"}
              </Boton>
            </>
          )}
        </div>
      </div>

      {aviso && (
        <p
          aria-live="polite"
          className={`mt-4 border-l-4 px-4 py-3 text-normal font-semibold ${
            aviso.tono === "ok"
              ? "border-acento bg-acento-tenue text-acento"
              : "border-alerta bg-alerta-tenue text-alerta"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {editando && (
        <p className="mt-4 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-menudo text-espera">
          Arrastrá las piezas hasta el día que salen. Sin mouse: tocá una pieza de abajo
          para elegirla y después tocá el día. Nada se guarda hasta que aprietes Guardar.
        </p>
      )}

      {/* **La grilla y las piezas sueltas, a la vista al mismo tiempo.**
          «Sin fecha» vivía abajo de todo el calendario: para arrastrar una
          pieza a un día había que ver las dos cosas juntas, y en una pantalla
          normal la grilla sola ya ocupa todo, así que el arrastre era bajar,
          agarrar, subir a ciegas y soltar. Al costado se ven juntas; en el
          teléfono queda abajo, pero pegada al borde mientras se edita. */}
      <div className="lg:grid lg:grid-cols-[1fr_17rem] lg:items-start lg:gap-6">
      <div>
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

          // **Un botón y no un `div`, para que se pueda soltar sin mouse.** El
          // cartel dice «tocá una pieza de abajo y después tocá el día»: la
          // pieza ya era un botón, así que con teclado se podía elegir y no
          // había forma de soltarla en ningún lado. Arrastrar sigue existiendo
          // para quien usa el mouse; esto es el otro camino, el que faltaba.
          const seDeja = editando && Boolean(elegida);

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
              {/* **El número del día es el objetivo cuando hay una pieza
                  elegida**, y es lo que hace que esto se pueda usar sin mouse.
                  El cartel dice «tocá una pieza de abajo y después tocá el
                  día»: la pieza ya era un botón, así que con teclado se podía
                  elegir y no había dónde soltarla. La celda entera no puede ser
                  el botón —adentro hay otro, la X de cada pieza— así que el
                  objetivo es el número. Arrastrar sigue igual para el mouse. */}
              {seDeja ? (
                <button
                  type="button"
                  onClick={() => elegida && ponerEn(elegida, esteDia)}
                  aria-label={`Poner ${nombreDeLaElegida} el ${numero}`}
                  className="cifras rounded-full px-1 text-menudo font-extrabold text-tinta underline decoration-dotted"
                >
                  {numero}
                </button>
              ) : (
                <p className="cifras px-1 text-menudo font-extrabold text-apagado">{numero}</p>
              )}

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
                        <Miniatura
                          src={urlDeMiniatura(pieza.archivo, 110, pieza.modificado)}
                          alt=""
                          nombre={pieza.nombre}
                          tono="oscuro"
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

      {enOtrosMeses.length > 0 && (
        <p className="mt-3 text-menudo text-apagado">
          {enOtrosMeses.length === 1 ? "Hay 1 pieza" : `Hay ${enOtrosMeses.length} piezas`} en
          otros meses:{" "}
          {[...new Set(enOtrosMeses.map((p) => fechas[p.id]!.slice(0, 7)))]
            .sort()
            .map((m) => {
              const [a, mm] = m.split("-").map(Number);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCursor({ anio: a, mes: mm - 1 })}
                  className="mr-2 font-semibold capitalize text-acento underline underline-offset-4"
                >
                  {nombreDelMes(a, mm - 1)}
                </button>
              );
            })}
        </p>
      )}
      </div>

      {/* ==================== Las que no tienen día ===================== */}
      <section
        className={`mt-8 lg:sticky lg:top-4 lg:mt-5 ${
          editando ? "sticky bottom-0 z-10 bg-papel pb-2 pt-2 lg:static lg:pb-0" : ""
        }`}
      >
        <h2 className="text-titulo font-extrabold tracking-tight">
          Sin fecha
          {sinFecha.length > 0 && (
            <span className="ml-2 text-normal font-semibold text-apagado">
              {sinFecha.length}
            </span>
          )}
        </h2>

        {sinFecha.length === 0 ? (
          // **Sin el título repetido ni el cero.** Con todo fechado decía «Sin
          // fecha 0» y abajo «Estas no le aparecen al cliente…», dos frases
          // sobre un conjunto vacío.
          <p className="mt-2 bg-acento-tenue px-4 py-3 text-menudo font-semibold text-acento">
            Todas las piezas tienen su día.
          </p>
        ) : (
          <>
          <p className="mt-1 text-menudo text-apagado">
            Estas no le aparecen al cliente en el calendario hasta que tengan día.
          </p>
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
                      <Miniatura
                        src={urlDeMiniatura(pieza.archivo, 110, pieza.modificado)}
                        alt=""
                        nombre={pieza.nombre}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </span>
                    <span className="max-w-40 truncate">{pieza.nombre}</span>
                    {pieza.version > 1 && (
                      <span className="text-micro font-extrabold opacity-60">
                        v{pieza.version}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </section>
      </div>
    </div>
  );
}
