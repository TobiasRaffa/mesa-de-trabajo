// Botones.
//
// Todos miden al menos lo que mide un dedo. Es la diferencia entre una
// aplicación que se usa en el teléfono y una que se sufre en el teléfono.

import type { ComponentProps } from "react";

type Variante = "principal" | "aprobar" | "secundario" | "sutil";

const ESTILOS: Record<Variante, string> = {
  principal: "bg-acento text-white hover:bg-acento-hover",
  aprobar: "bg-listo text-white hover:brightness-110",
  secundario: "bg-lienzo text-tinta border border-linea hover:bg-hueco",
  // Para acciones que existen pero no se quieren invitar.
  sutil: "bg-transparent text-apagado hover:text-tinta hover:bg-hueco",
};

type Props = ComponentProps<"button"> & {
  variante?: Variante;
  ancho?: boolean;
};

export function Boton({
  variante = "principal",
  ancho = false,
  className = "",
  ...resto
}: Props) {
  return (
    <button
      {...resto}
      className={[
        "min-h-toque px-5 rounded-lg text-normal font-semibold",
        "inline-flex items-center justify-center gap-2",
        "transition-colors disabled:opacity-40 disabled:pointer-events-none",
        ESTILOS[variante],
        ancho ? "w-full" : "",
        className,
      ].join(" ")}
    />
  );
}
