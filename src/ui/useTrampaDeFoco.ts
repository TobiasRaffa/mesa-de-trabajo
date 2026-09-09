"use client";

// Mantiene el foco adentro de una ventana emergente.
//
// Sin esto, apretar Tab dentro de un diálogo lleva el foco a los botones que
// quedaron detrás: quien navega con teclado —o con un lector de pantalla— se
// encuentra apretando cosas que no ve, mientras el diálogo sigue abierto
// tapándolo todo.
//
// Hace tres cosas: pone el foco adentro al abrir, no lo deja salir mientras
// esté abierto, y lo devuelve a donde estaba al cerrar.
//
// Son dos efectos y no uno a propósito. El del foco corre una sola vez, al
// abrir; el del teclado se rearma cada vez que cambia la función de cerrar.
// Juntos, el foco saltaría al primer botón cada vez que el componente de
// arriba se dibuja de nuevo — o sea, en medio de la escritura.

import { useEffect, useRef } from "react";

const ENFOCABLES = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const enfocablesDe = (contenedor: HTMLElement) =>
  Array.from(contenedor.querySelectorAll<HTMLElement>(ENFOCABLES));

export function useTrampaDeFoco<T extends HTMLElement>(alCerrar: () => void) {
  const marco = useRef<T>(null);

  // Entrar y salir: solo al abrir y al cerrar.
  useEffect(() => {
    const contenedor = marco.current;
    if (!contenedor) return;

    const veniaDe = document.activeElement as HTMLElement | null;
    (enfocablesDe(contenedor)[0] ?? contenedor).focus();

    return () => {
      // Devolver el foco a donde estaba es lo que hace que cerrar un diálogo
      // no se sienta como caerse a la nada.
      veniaDe?.focus?.();
    };
  }, []);

  // No dejar que el foco se escape, y cerrar con Escape.
  useEffect(() => {
    const contenedor = marco.current;
    if (!contenedor) return;

    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        alCerrar();
        return;
      }
      if (e.key !== "Tab") return;

      const lista = enfocablesDe(contenedor!);
      if (lista.length === 0) {
        e.preventDefault();
        return;
      }

      const primero = lista[0];
      const ultimo = lista[lista.length - 1];

      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [alCerrar]);

  return marco;
}
