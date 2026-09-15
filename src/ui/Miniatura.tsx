"use client";

// La imagen de una pieza, con qué hacer cuando no hay imagen.
//
// **No todo archivo tiene miniatura.** Drive dibuja la primera página de un
// PDF y casi cualquier imagen, pero no siempre: un archivo recién subido puede
// tardar en tenerla, y hay formatos que no la tienen nunca. Cuando falta, la
// ruta contesta 415 y el navegador dibuja el ícono de imagen rota —el cuadrito
// gris con la hoja partida—, que es la peor respuesta posible: parece que la
// aplicación se rompió, cuando lo único que pasa es que Google todavía no
// generó una vista previa.
//
// Acá, en cambio, queda un recuadro sobrio con la extensión del archivo. Dice
// lo que hay —un PDF, un AI— sin fingir que puede mostrarlo, y los botones de
// al lado siguen sirviendo para abrirlo.
//
// Existe como una sola pieza y no repetido en cada pantalla porque la misma
// imagen aparece en cinco lugares —la lista del portal, la pieza en grande, el
// comparador, el calendario y el armador—, y escrito cinco veces, cinco veces
// hay que acordarse de esto.

import { useState } from "react";

export function Miniatura({
  src,
  alt,
  nombre,
  rotulo,
  className = "",
  /** Fondo del recuadro cuando no hay imagen. */
  tono = "claro",
}: {
  src: string;
  alt: string;
  /** El nombre del archivo: de ahí sale la extensión que se muestra. */
  nombre?: string;
  /**
   * Qué decir cuando no hay imagen, si quien llama lo sabe mejor.
   *
   * Hay pantallas que muestran el nombre lindo —«Banner día del padre»— y no
   * el del archivo, así que no tienen extensión de dónde sacarlo. Pero sí
   * saben, por ejemplo, que es un PDF.
   */
  rotulo?: string;
  className?: string;
  tono?: "claro" | "oscuro";
}) {
  const [fallo, setFallo] = useState(false);

  if (fallo) {
    return (
      <span
        aria-label={alt || undefined}
        role={alt ? "img" : undefined}
        className={`grid place-items-center ${
          tono === "oscuro" ? "bg-tinta text-lienzo/60" : "bg-hueco text-apagado"
        } ${className}`}
      >
        <span className="px-1 text-micro font-extrabold uppercase tracking-widest">
          {rotulo ?? extension(nombre)}
        </span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setFallo(true)} />
  );
}

/**
 * La extensión, para decir qué clase de archivo es.
 *
 * Sin nombre o sin punto no se inventa nada: «archivo» es cierto siempre, y
 * una extensión adivinada sería una mentira chiquita en una pantalla donde
 * todo lo demás es exacto.
 */
function extension(nombre?: string): string {
  if (!nombre) return "archivo";
  const punto = nombre.lastIndexOf(".");
  if (punto <= 0 || punto === nombre.length - 1) return "archivo";
  return nombre.slice(punto + 1).slice(0, 5);
}
