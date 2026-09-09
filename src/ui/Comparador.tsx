"use client";

// Dos versiones de la misma pieza, una al lado de la otra.
//
// Existe para contestar la pregunta que hace todo cliente que pidió un cambio:
// «¿qué cambió?». Contestarla de memoria es incómodo para los dos lados, y
// contestarla mal es una vuelta perdida.
//
// En pantalla grande van juntas, que es como se comparan de verdad. En el
// teléfono no entran dos imágenes útiles al mismo tiempo, así que se alternan
// con dos pestañas: el ojo compara igual, recordando, y cada imagen se ve al
// tamaño que sirve.

import { useState } from "react";

export type VersionComparable = {
  numero: number;
  src: string;
  pie: string;
};

type Props = {
  nombre: string;
  antes: VersionComparable;
  ahora: VersionComparable;
  onAmpliar: (src: string, alt: string) => void;
};

export function Comparador({ nombre, antes, ahora, onAmpliar }: Props) {
  const [enPantalla, setEnPantalla] = useState<"antes" | "ahora">("ahora");

  const cual = enPantalla === "antes" ? antes : ahora;

  return (
    <div className="flex flex-col gap-3">
      {/* Las pestañas solo existen en el teléfono: en pantalla grande las dos
          imágenes están a la vista y elegir no tiene sentido. */}
      <div
        role="tablist"
        aria-label={`Versiones de ${nombre}`}
        className="flex gap-1 rounded-lg bg-hueco p-1 sm:hidden"
      >
        {(["antes", "ahora"] as const).map((cual) => {
          const version = cual === "antes" ? antes : ahora;
          const activa = enPantalla === cual;
          return (
            <button
              key={cual}
              role="tab"
              aria-selected={activa}
              onClick={() => setEnPantalla(cual)}
              className={`min-h-toque flex-1 rounded-md text-menudo font-semibold transition-colors ${
                activa ? "bg-lienzo text-tinta shadow-sm" : "text-apagado"
              }`}
            >
              v{version.numero}
            </button>
          );
        })}
      </div>

      {/* Teléfono: una sola, la elegida. */}
      <figure className="sm:hidden">
        <Lamina version={cual} nombre={nombre} onAmpliar={onAmpliar} />
        <figcaption className="mt-2 text-menudo text-apagado">{cual.pie}</figcaption>
      </figure>

      {/* Pantalla grande: las dos, que es como se compara. */}
      <div className="hidden gap-4 sm:grid sm:grid-cols-2">
        {[antes, ahora].map((version, i) => (
          <figure key={version.numero}>
            <p className="mb-2 text-micro uppercase tracking-[0.18em] text-apagado">
              {i === 0 ? "Antes" : "Ahora"} · v{version.numero}
            </p>
            <Lamina version={version} nombre={nombre} onAmpliar={onAmpliar} />
            <figcaption className="mt-2 text-menudo text-apagado">{version.pie}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function Lamina({
  version,
  nombre,
  onAmpliar,
}: {
  version: VersionComparable;
  nombre: string;
  onAmpliar: (src: string, alt: string) => void;
}) {
  const alt = `${nombre}, versión ${version.numero}`;

  return (
    <button
      type="button"
      onClick={() => onAmpliar(version.src, alt)}
      aria-label={`Ver ${alt} en grande`}
      className="group relative grid aspect-[4/5] w-full place-items-center overflow-hidden
                 rounded-lg border border-linea bg-lienzo"
    >
      <span className="px-4 text-center text-micro text-apagado">v{version.numero}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={version.src}
        alt={alt}
        className="absolute inset-0 h-full w-full bg-lienzo object-contain transition-transform group-hover:scale-[1.02]"
      />
    </button>
  );
}
