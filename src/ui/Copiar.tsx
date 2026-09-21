"use client";

// Un botón que copia un texto corto y lo dice.
//
// Existe porque los datos que hay que pasarle a alguien —un link del portal, un
// código de alta— se dictan o se pegan en un chat, y seleccionar con el mouse
// un texto de ocho caracteres en una fila apretada es de las cosas que más se
// erran. El «Copiado» dura dos segundos: alcanza para saber que prendió y no
// deja un cartel pegado.

import { useState } from "react";

export function Copiar({
  texto,
  etiqueta = "Copiar",
  className,
}: {
  texto: string;
  etiqueta?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Un navegador que no deja copiar no rompe nada: el texto está a la vista.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={
        className ??
        "shrink-0 border border-linea bg-lienzo px-2 py-0.5 text-micro font-extrabold " +
          "uppercase tracking-wider text-tinta transition-colors hover:bg-hueco"
      }
    >
      {copiado ? "Copiado" : etiqueta}
    </button>
  );
}
