"use client";

// Un sí o un no que se lee de un vistazo: lima y a la derecha es sí, gris y a
// la izquierda es no, y al lado dice cuál de los dos.

export function Interruptor({
  encendido,
  onCambiar,
  deshabilitado = false,
  etiqueta,
}: {
  encendido: boolean;
  onCambiar: (nuevo: boolean) => void;
  deshabilitado?: boolean;
  /** Para lectores de pantalla: qué se prende y se apaga. */
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      aria-label={etiqueta}
      disabled={deshabilitado}
      onClick={() => onCambiar(!encendido)}
      className="inline-flex shrink-0 items-center gap-2 disabled:opacity-40"
    >
      <span
        className={`relative block h-6 w-11 rounded-full ring-1 ring-inset transition-colors ${
          encendido ? "bg-lima ring-tinta/25" : "bg-hueco ring-linea"
        }`}
      >
        <span
          className={`absolute left-0 top-0.5 block h-5 w-5 rounded-full shadow transition-transform ${
            encendido ? "translate-x-[1.375rem] bg-tinta" : "translate-x-0.5 bg-lienzo"
          }`}
        />
      </span>
      <span
        className={`inline-block w-6 text-left text-menudo font-bold ${
          encendido ? "text-tinta" : "text-apagado"
        }`}
      >
        {encendido ? "Sí" : "No"}
      </span>
    </button>
  );
}
