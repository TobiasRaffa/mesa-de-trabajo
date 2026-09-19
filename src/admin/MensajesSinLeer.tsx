"use client";

// Cuántos mensajes del cliente faltan leer, dicho con un globo y un número.
//
// Aparece en dos listas —el tablero y la de clientes— al lado de un nombre que
// ya tiene cosas alrededor: días, vencidos, sin entregar. Ahí «3 mensajes sin
// leer» escrito con todas las letras era lo que más lugar ocupaba, y lo que
// hay que leer es el número. El globo dice de qué es el número sin gastar una
// palabra.
//
// **Y se toca.** Lleva a la conversación de ese cliente, ya abierta: ver que
// hay tres sin leer y tener que ir a Conversaciones a buscar cuál era es el
// paso que el globo vino a ahorrar.
//
// No es un `<a>` a propósito: en el tablero vive adentro del botón que abre
// al cliente, y un enlace adentro de un botón es HTML inválido —el navegador
// resuelve el conflicto como quiere—. Es un trozo de texto que sabe a dónde
// ir, y el clic no le llega al botón de atrás.

import { useRouter } from "next/navigation";
import { IconoMensaje } from "@/ui/Icono";

export function MensajesSinLeer({
  cuantos,
  clienteId,
}: {
  cuantos: number;
  /** De quién son: es a cuya conversación lleva. */
  clienteId: string;
}) {
  const router = useRouter();
  if (cuantos <= 0) return null;

  const dice = `${cuantos} ${cuantos === 1 ? "mensaje sin leer" : "mensajes sin leer"}`;
  const ir = () => router.push(`/gestion/chats?abrir=${encodeURIComponent(clienteId)}`);

  return (
    <span
      role="link"
      tabIndex={0}
      aria-label={`${dice}: abrir la conversación`}
      title={dice}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        ir();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.stopPropagation();
        e.preventDefault();
        ir();
      }}
      className="inline-flex items-center gap-1 bg-acento px-1.5 py-0.5 text-micro font-extrabold text-white
                 transition-colors hover:bg-acento/85 focus-visible:outline-2 focus-visible:outline-tinta"
    >
      <IconoMensaje className="h-[1.2em] w-[1.2em]" />
      <span className="cifras leading-none">{cuantos}</span>
    </span>
  );
}
