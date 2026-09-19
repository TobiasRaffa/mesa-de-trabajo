// Botones.
//
// Pastillas con peso, como los rótulos de las piezas de Matter: esquinas
// bien redondeadas, texto pesado y apretado, sin sombras difusas. Se tiene que
// ver que alguien los puso ahí.
//
// Cinco variantes, y cada una dice algo distinto sobre lo que va a pasar:
//
//   principal   el camino que se propone. Lima macizo con tinta encima: el
//               color de la marca, reservado para lo que más importa.
//   aprobar     el acto que cierra una pieza. La misma lima, porque aprobar
//               ES la acción principal del portal.
//   contorno    una acción real pero no la propuesta. Borde negro, sin relleno.
//   fantasma    acciones de apoyo -- ampliar, comparar, cerrar.
//   sutil       lo que existe pero no se quiere invitar.
//
// Ninguna es un texto subrayado: un enlace en medio de una fila de botones se
// lee como un texto que alguien se olvidó de terminar.

import type { ComponentProps } from "react";

type Variante = "principal" | "aprobar" | "contorno" | "fantasma" | "sutil";
type Tamano = "normal" | "chico";

const VARIANTES: Record<Variante, string> = {
  principal: "bg-lima text-tinta hover:bg-lima-hover",
  aprobar: "bg-lima text-tinta hover:bg-lima-hover",
  contorno: "border-2 border-tinta bg-transparent text-tinta hover:bg-tinta hover:text-lienzo",
  fantasma: "bg-hueco text-tinta hover:bg-linea",
  sutil: "bg-transparent text-apagado hover:text-tinta",
};

const TAMANOS: Record<Tamano, string> = {
  normal: "min-h-toque px-6 text-normal gap-2",
  chico: "h-9 px-4 text-menudo gap-1.5",
};

const BASE =
  "inline-flex items-center justify-center rounded-full font-bold tracking-tight " +
  "transition-colors duration-150";

type Props = ComponentProps<"button"> & {
  variante?: Variante;
  tamano?: Tamano;
  ancho?: boolean;
};

export function Boton({
  variante = "principal",
  tamano = "normal",
  ancho = false,
  className = "",
  ...resto
}: Props) {
  return (
    <button
      {...resto}
      className={[
        BASE,
        "disabled:opacity-35 disabled:pointer-events-none",
        TAMANOS[tamano],
        VARIANTES[variante],
        ancho ? "w-full" : "",
        className,
      ].join(" ")}
    />
  );
}

/** Lo mismo, pero para cuando la acción lleva a un recurso y no ejecuta nada. */
export function BotonEnlace({
  variante = "contorno",
  tamano = "normal",
  ancho = false,
  className = "",
  ...resto
}: ComponentProps<"a"> & { variante?: Variante; tamano?: Tamano; ancho?: boolean }) {
  return (
    <a
      {...resto}
      className={[BASE, TAMANOS[tamano], VARIANTES[variante], ancho ? "w-full" : "", className].join(
        " ",
      )}
    />
  );
}
