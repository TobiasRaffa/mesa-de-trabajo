// La marca de Matter: el logo y el nombre.
//
// Es lo que dice de quién es esta herramienta. Antes cada pantalla ponía un
// rótulo gris que decía «Mesa de trabajo» y nada más; ahora está la agencia,
// y «Mesa de trabajo» es lo que la agencia abre.
//
// El logo está dibujado a mano como SVG y no traído como imagen: escala a
// cualquier tamaño —de un favicon a una portada— sin pixelarse ni pesar. Es
// la «m» ondulada de Matter dentro de su círculo lima.

type Tono = "sobre_claro" | "sobre_oscuro";

/** Solo la «m» en su círculo. */
export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <circle cx="50" cy="50" r="50" fill="#d1fe6f" />
      <path
        d="M17 72 C 17 47 25 32 35 32 C 46 32 45 61 55 61 C 65 61 63 32 74 32 C 83 32 84 46 84 63"
        fill="none"
        stroke="#121212"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <circle cx="88" cy="30" r="2.5" fill="#121212" />
    </svg>
  );
}

/**
 * El logo con el nombre y, abajo, qué es esto.
 *
 * `tono` dice sobre qué fondo va: la barra de gestión y la del portal son
 * negras, las puertas son de papel.
 */
/** Cómo se llama la agencia, para las pantallas que hablan de ella por nombre. */
export { NOMBRE_DE_LA_AGENCIA } from "@/dominio/agencia";

export function Marca({
  tono = "sobre_claro",
  className = "",
}: {
  tono?: Tono;
  className?: string;
}) {
  const nombre = tono === "sobre_oscuro" ? "text-lienzo" : "text-tinta";
  const bajada = tono === "sobre_oscuro" ? "text-lienzo/50" : "text-apagado";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Logo className="h-11 w-11" />
      <div className="min-w-0 leading-none">
        <p
          className={`text-guia font-extrabold uppercase leading-none tracking-tight ${nombre}`}
          style={{ fontStretch: "118%" }}
        >
          Matter<span className="align-super text-[0.45em] font-bold">®</span>
        </p>
        <p className={`mt-1.5 font-mono text-micro uppercase tracking-widest ${bajada}`}>
          Mesa de trabajo
        </p>
      </div>
    </div>
  );
}
