// El encabezado de toda ventana emergente, en gestión y en el portal.
//
// **Existe porque había seis.** Cada ventana escribía el suyo: una con el
// título arriba y la cruz abajo, otra al revés, una negra y otra violeta, una
// con el rótulo en mono y otra sin rótulo. Puestas una al lado de la otra se
// notaba que eran de distintas manos. Ahora es uno solo, y lo que cambia entre
// ventanas es lo que se le pasa: el rótulo, el título, la bajada y los
// controles que van a la izquierda de la cruz.
//
// Todo va **centrado a lo alto**: el título y la cruz se alinean al medio
// aunque haya rótulo arriba o bajada abajo.

import type { ComponentProps, ReactNode } from "react";
import { IconoCerrar } from "@/ui/Icono";

export function EncabezadoDeVentana({
  rotulo,
  titulo,
  bajada,
  controles,
  onCerrar,
}: {
  /** Lo chico arriba del título: «Pieza 2 de 5», «Café Otoño · Marzo». */
  rotulo?: ReactNode;
  titulo: string;
  /** Una línea abajo del título, si hace falta explicar algo. */
  bajada?: string;
  /** Lo que va a la izquierda de la cruz: flechas, «Abrir la carpeta». */
  controles?: ReactNode;
  onCerrar: () => void;
}) {
  return (
    <header className="flex items-center gap-4 bg-acento px-6 py-4 text-white">
      <div className="min-w-0 flex-1">
        {rotulo && (
          <p className="truncate font-mono text-micro font-bold uppercase tracking-widest text-white/60">
            {rotulo}
          </p>
        )}
        {/* **En el teléfono usa dos renglones.** Cortaba en uno con puntos
            suspensivos y el nombre completo vivía en un `title`, que en un
            teléfono no existe: «V2_banner_dia_del_padre_fin…» y nada más. */}
        <h2
          title={titulo}
          className="line-clamp-2 text-titulo font-extrabold leading-tight tracking-tight sm:truncate"
        >
          {titulo}
        </h2>
        {bajada && <p className="mt-0.5 truncate text-menudo text-white/70">{bajada}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-1.5">
        {controles}
        <ControlDeVentana onClick={onCerrar} aria-label="Cerrar" relleno>
          <IconoCerrar />
        </ControlDeVentana>
      </div>
    </header>
  );
}

/**
 * Un botón redondo del encabezado: las flechas, la cruz.
 *
 * `relleno` es para el que manda —la cruz—: blanco macizo. Los demás van
 * translúcidos sobre la banda.
 */
export function ControlDeVentana({
  relleno = false,
  className = "",
  ...resto
}: ComponentProps<"button"> & { relleno?: boolean }) {
  return (
    <button
      type="button"
      {...resto}
      // **44 píxeles en el teléfono.** Medían 36, que es menos que la yema de
      // un dedo, y en el portal hay tres de estos pegados al borde de la
      // ventana: errarle a uno es tocar el de al lado, y los de al lado son
      // «pieza anterior» y «cerrar». Con mouse 36 alcanza, así que en pantalla
      // grande vuelven al tamaño de antes.
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-35 sm:h-9 sm:w-9 ${
        relleno
          ? "bg-white text-acento hover:bg-white/90"
          : "bg-white/15 text-white hover:bg-white/25"
      } ${className}`}
    />
  );
}

/** Lo mismo que un control, pero con palabras y llevando a otro lado. */
export const ENLACE_DE_VENTANA =
  "inline-flex h-9 shrink-0 items-center rounded-full bg-white px-4 text-menudo " +
  "font-bold tracking-tight text-acento transition-colors hover:bg-white/90";
