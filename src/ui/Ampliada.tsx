"use client";

// Una pieza, o dos, a pantalla completa.
//
// Existe porque una miniatura no alcanza para decidir. Y acepta dos porque
// agrandar mientras se comparan versiones tiene que agrandar **las dos**: si
// solo se abriera la actual, se pierde justo lo que se estaba haciendo.
//
// La imagen se muestra entera, nunca recortada: es una pieza de diseño y
// cortarle un borde puede cambiar lo que se está juzgando.

import { IconoCerrar } from "@/ui/Icono";
import { Miniatura } from "@/ui/Miniatura";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";

export type Lamina = {
  src: string;
  alt: string;
  /** «Antes · v1», «Ahora · v2». Solo cuando hay dos y hay que distinguirlas. */
  rotulo?: string;
};

type Props = {
  laminas: Lamina[];
  onCerrar: () => void;
};

export function Ampliada({ laminas, onCerrar }: Props) {
  // Comparte la pila con las demás ventanas: al abrirse queda arriba de la
  // pieza que se estaba revisando, y Escape cierra esta sola.
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);

  const dos = laminas.length > 1;

  return (
    <div
      ref={marco}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={dos ? "Comparación en grande" : laminas[0]?.alt}
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex flex-col bg-tinta/95 p-4 outline-none sm:p-6"
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCerrar}
          className="inline-flex min-h-toque items-center gap-2 px-4 text-normal font-bold text-white/85 hover:text-white"
        >
          <IconoCerrar />
          Cerrar
        </button>
      </div>

      {/*
        Toda la cadena lleva `min-h-0`. Sin eso, un elemento flexible se niega
        a achicarse por debajo de su contenido: la imagen se dibuja a tamaño
        completo y se desborda de la pantalla en lugar de entrar en ella.
      */}
      <div
        className={`flex min-h-0 flex-1 items-stretch justify-center gap-4 ${
          dos ? "flex-col sm:flex-row" : ""
        }`}
      >
        {laminas.map((lamina) => (
          <figure
            key={lamina.src}
            onClick={(e) => e.stopPropagation()}
            className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3"
          >
            {lamina.rotulo && (
              <figcaption className="shrink-0 bg-white/15 px-3 py-1 text-micro font-extrabold uppercase tracking-widest text-white">
                {lamina.rotulo}
              </figcaption>
            )}
            <Miniatura
              src={lamina.src}
              alt={lamina.alt}
              nombre={lamina.alt}
              tono="oscuro"
              className="min-h-0 w-full flex-1 object-contain"
            />
          </figure>
        ))}
      </div>

    </div>
  );
}
