"use client";

// Con qué recortar el tablero.
//
// **Filtra, no busca.** Un buscador contesta «dónde está esto»; estos filtros
// contestan «qué me toca a mí», «qué está vencido», «qué no está viendo el
// cliente». Son las tres preguntas que en la agencia se hacen en voz alta, y
// cada una tenía como única respuesta abrir todo y mirar.
//
// **Todo pasa en el navegador.** El tablero ya trajo sus trabajos; recortar la
// lista no necesita volver al servidor, y así el filtro se siente instantáneo
// en una pantalla que tarda un segundo en cargar.
//
// Lo que se filtra son **trabajos**, no clientes: un cliente sigue apareciendo
// mientras le quede algo que pase el filtro, con solo eso adentro.

import type { CarpetaEnElTablero } from "@/admin/datos/tablero";

export type Filtros = {
  /** El nombre de quien lo lleva, o `null` para todos. */
  quien: string | null;
  /** `null` es «no importa». */
  visible: boolean | null;
  soloVencidos: boolean;
  soloSinLeer: boolean;
};

export const SIN_FILTROS: Filtros = {
  quien: null,
  visible: null,
  soloVencidos: false,
  soloSinLeer: false,
};

export const hayFiltros = (f: Filtros) =>
  f.quien !== null || f.visible !== null || f.soloVencidos || f.soloSinLeer;

/** Si esta carpeta, ella sola, pasa los filtros. */
function pasa(c: CarpetaEnElTablero, f: Filtros): boolean {
  if (f.quien !== null && c.asignadaA !== f.quien) return false;
  if (f.visible !== null && c.visible !== f.visible) return false;
  if (f.soloVencidos && !c.vencida) return false;
  if (f.soloSinLeer && c.sinLeer === 0) return false;
  return true;
}

/**
 * Deja los trabajos que pasan todos los filtros puestos.
 *
 * **Mira el árbol entero, no el primer escalón.** El trabajo no siempre está
 * arriba: «Banners / Septiembre» es una carpeta de trabajo tanto como
 * «Banners», y el filtro solo miraba el primer nivel. Con eso, «Solo los
 * míos» escondía una subcarpeta asignada a quien filtraba porque su carpeta
 * madre la lleva otro —y al revés, mostraba una carpeta madre entera con
 * subcarpetas de todo el equipo adentro—.
 *
 * Una carpeta se conserva si pasa ella **o** si le queda alguna hija, con las
 * hijas ya filtradas: así el camino hasta el trabajo que pasa no se corta.
 */
export function filtrar(
  carpetas: CarpetaEnElTablero[],
  f: Filtros
): CarpetaEnElTablero[] {
  const salida: CarpetaEnElTablero[] = [];
  for (const c of carpetas) {
    const hijas = filtrar(c.hijas, f);
    if (pasa(c, f) || hijas.length > 0) salida.push({ ...c, hijas });
  }
  return salida;
}

/** Todas las carpetas del árbol, a cualquier profundidad. */
function todasLasDelArbol(carpetas: CarpetaEnElTablero[]): CarpetaEnElTablero[] {
  return carpetas.flatMap((c) => [c, ...todasLasDelArbol(c.hijas)]);
}

export function FiltrosDelTablero({
  carpetas,
  filtros,
  onCambiar,
  cuantos,
}: {
  /** Todos, sin filtrar: de acá salen los nombres que se ofrecen. */
  carpetas: CarpetaEnElTablero[];
  filtros: Filtros;
  onCambiar: (f: Filtros) => void;
  /** Cuántos trabajos quedaron, para decirlo sin que haya que contar. */
  cuantos: number;
}) {
  // Solo los que de verdad llevan algo: ofrecer a todo el equipo incluiría
  // nombres que nunca van a devolver nada.
  // **Del árbol entero.** Salían del primer nivel, así que quien solo lleva
  // subcarpetas no aparecía en la lista: su nombre no se podía elegir aunque
  // tuviera trabajo asignado.
  const quienes = [
    ...new Set(
      todasLasDelArbol(carpetas)
        .map((c) => c.asignadaA)
        .filter((q): q is string => q !== null)
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

  const puesto = hayFiltros(filtros);

  // Cuántos clientes escribieron, para que el contador diga lo que el
  // interruptor promete.
  const clientesQueEscribieron = new Set(
    todasLasDelArbol(carpetas)
      .filter((c) => c.sinLeer > 0)
      .map((c) => c.clienteId)
  ).size;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-linea py-3">
      <span className="text-micro font-extrabold uppercase tracking-widest text-apagado">
        Ver
      </span>

      {quienes.length > 0 && (
        <select
          aria-label="Quién lo lleva"
          value={filtros.quien ?? ""}
          onChange={(e) => onCambiar({ ...filtros, quien: e.target.value || null })}
          className="rounded-full h-8 border-2 border-linea bg-lienzo px-2 text-menudo font-bold
                     tracking-tight focus:border-acento focus:outline-none"
        >
          <option value="">Todo el equipo</option>
          {quienes.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      )}

      <select
        aria-label="Lo ve el cliente"
        value={filtros.visible === null ? "" : filtros.visible ? "si" : "no"}
        onChange={(e) =>
          onCambiar({
            ...filtros,
            visible: e.target.value === "" ? null : e.target.value === "si",
          })
        }
        className="rounded-full h-8 border-2 border-linea bg-lienzo px-2 text-menudo font-bold
                   tracking-tight focus:border-acento focus:outline-none"
      >
        <option value="">Visibles y ocultos</option>
        <option value="si">Solo los visibles</option>
        <option value="no">Solo los ocultos</option>
      </select>

      <Interruptor
        puesto={filtros.soloVencidos}
        onTocar={() => onCambiar({ ...filtros, soloVencidos: !filtros.soloVencidos })}
      >
        Vencidos
      </Interruptor>

      {/* **Dice lo que filtra.** Se llamaba «Con mensajes» y los mensajes son
          del cliente, no del trabajo: puesto, dejaba todos los trabajos de los
          clientes que escribieron —que es lo correcto— pero el contador de al
          lado seguía diciendo «7 trabajos», y el nombre hacía esperar siete
          conversaciones. */}
      <Interruptor
        puesto={filtros.soloSinLeer}
        onTocar={() => onCambiar({ ...filtros, soloSinLeer: !filtros.soloSinLeer })}
      >
        Clientes que escribieron
      </Interruptor>

      {/* Cuántos quedaron, y cómo salir. Un tablero filtrado que no dice que
          está filtrado es la forma más fácil de creer que no hay trabajo. */}
      {puesto && (
        <>
          <span className="text-menudo text-apagado">
            {cuantos} {cuantos === 1 ? "trabajo" : "trabajos"}
            {filtros.soloSinLeer && clientesQueEscribieron > 0 && (
              <>
                {" · "}
                {clientesQueEscribieron}{" "}
                {clientesQueEscribieron === 1 ? "cliente" : "clientes"}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => onCambiar(SIN_FILTROS)}
            className="text-menudo font-bold tracking-tight text-acento underline underline-offset-4"
          >
            Ver todo
          </button>
        </>
      )}
    </div>
  );
}

function Interruptor({
  puesto,
  onTocar,
  children,
}: {
  puesto: boolean;
  onTocar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onTocar}
      aria-pressed={puesto}
      className={`rounded-full h-8 border-2 border-linea px-3 text-menudo font-bold tracking-tight
                  transition-colors ${
                    puesto
                      ? "border-tinta bg-tinta text-lienzo"
                      : "text-tinta hover:bg-hueco"
                  }`}
    >
      {children}
    </button>
  );
}
