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

/** Deja los trabajos que pasan todos los filtros puestos. */
export function filtrar(
  carpetas: CarpetaEnElTablero[],
  f: Filtros
): CarpetaEnElTablero[] {
  return carpetas.filter((c) => {
    if (f.quien !== null && c.asignadaA !== f.quien) return false;
    if (f.visible !== null && c.visible !== f.visible) return false;
    if (f.soloVencidos && !c.vencida) return false;
    if (f.soloSinLeer && c.sinLeer === 0) return false;
    return true;
  });
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
  const quienes = [
    ...new Set(carpetas.map((c) => c.asignadaA).filter((q): q is string => q !== null)),
  ].sort((a, b) => a.localeCompare(b, "es"));

  const puesto = hayFiltros(filtros);

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
          className="h-8 border-2 border-linea bg-lienzo px-2 text-menudo font-bold
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
        className="h-8 border-2 border-linea bg-lienzo px-2 text-menudo font-bold
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

      <Interruptor
        puesto={filtros.soloSinLeer}
        onTocar={() => onCambiar({ ...filtros, soloSinLeer: !filtros.soloSinLeer })}
      >
        Con mensajes
      </Interruptor>

      {/* Cuántos quedaron, y cómo salir. Un tablero filtrado que no dice que
          está filtrado es la forma más fácil de creer que no hay trabajo. */}
      {puesto && (
        <>
          <span className="text-menudo text-apagado">
            {cuantos} {cuantos === 1 ? "trabajo" : "trabajos"}
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
      className={`h-8 border-2 border-linea px-3 text-menudo font-bold tracking-tight
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
