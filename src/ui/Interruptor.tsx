"use client";

// Un sí o un no que se lee de un vistazo: verde y a la derecha es sí, gris y a
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
        className={`relative h-6 w-11 rounded-full transition-colors ${
          encendido ? "bg-acento" : "bg-hueco ring-1 ring-inset ring-linea"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-lienzo shadow transition-transform ${
            encendido ? "translate-x-[1.375rem]" : "translate-x-0.5"
          }`}
        />
      </span>
      <span
        className={`w-5 text-left text-menudo font-bold ${encendido ? "text-acento" : "text-apagado"}`}
      >
        {encendido ? "Sí" : "No"}
      </span>
    </button>
  );
}
