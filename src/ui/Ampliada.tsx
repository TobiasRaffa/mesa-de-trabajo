"use client";

// La pieza en grande, ocupando toda la pantalla.
//
// Existe porque una miniatura no alcanza para decidir. El cliente tiene que
// poder mirar el trabajo de cerca antes de aprobarlo, y en el teléfono eso es
// la diferencia entre revisar y adivinar.
//
// La imagen se muestra entera, nunca recortada: es una pieza de diseño y
// cortarle un borde puede cambiar lo que se está juzgando.

import { useEffect } from "react";

type Props = {
  src: string;
  alt: string;
  onCerrar: () => void;
};

export function Ampliada({ src, alt, onCerrar }: Props) {
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", alTeclado);
    // Que el fondo no se mueva mientras se mira la pieza.
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.body.style.overflow = antes;
    };
  }, [onCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex flex-col bg-tinta/90 p-4 sm:p-8"
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCerrar}
          className="min-h-toque rounded-md px-4 text-normal font-semibold text-white/90 hover:text-white"
        >
          Cerrar
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <p className="pt-4 text-center text-menudo text-white/70">
        Tocá fuera de la imagen para volver
      </p>
    </div>
  );
}
