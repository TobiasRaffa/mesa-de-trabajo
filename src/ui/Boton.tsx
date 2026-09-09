// Botones.
//
// Cinco variantes, y cada una dice algo distinto sobre lo que va a pasar:
//
//   principal   el camino que se propone. Lleno, con el color de acento.
//   aprobar     el acto que cierra una pieza. Verde, porque es un final.
//   contorno    una acción real pero no la propuesta. Borde, sin relleno.
//   fantasma    acciones de apoyo -- ampliar, comparar. Se ven al pasar cerca.
//   sutil       lo que existe pero no se quiere invitar. Sin borde, apagado.
//
// Ninguna es un texto subrayado. Un enlace subrayado en medio de una fila de
// botones se lee como un texto que alguien se olvidó de terminar.
//
// Todos miden al menos lo que mide un dedo, salvo los de tamaño chico, que
// solo se usan donde el dedo ya tiene otra cosa grande cerca.

import type { ComponentProps } from "react";

type Variante = "principal" | "aprobar" | "contorno" | "fantasma" | "sutil";
type Tamano = "normal" | "chico";

const VARIANTES: Record<Variante, string> = {
  principal: "bg-acento text-white hover:bg-acento-hover shadow-sm",
  aprobar: "bg-listo text-white hover:brightness-110 shadow-sm",
  contorno: "border border-linea bg-lienzo text-tinta hover:border-apagado hover:bg-hueco",
  fantasma: "text-tinta-suave hover:bg-hueco hover:text-tinta",
  sutil: "text-apagado hover:text-tinta",
};

const TAMANOS: Record<Tamano, string> = {
  normal: "min-h-toque px-5 text-normal rounded-lg gap-2",
  chico: "h-9 px-3 text-menudo rounded-md gap-1.5",
};

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
        "inline-flex items-center justify-center font-semibold",
        "transition-colors duration-150",
        "disabled:opacity-40 disabled:pointer-events-none",
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
      className={[
        "inline-flex items-center justify-center font-semibold",
        "transition-colors duration-150",
        TAMANOS[tamano],
        VARIANTES[variante],
        ancho ? "w-full" : "",
        className,
      ].join(" ")}
    />
  );
}
