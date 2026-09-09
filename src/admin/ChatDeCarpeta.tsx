"use client";

// El botón que abre la conversación de una carpeta, del lado de la agencia.
//
// Usa el mismo panel que el portal —`@/ui/Conversacion`— porque es la misma
// pantalla vista desde el otro lado del mostrador. Lo único que cambia es
// quién es «yo», que decide de qué lado va cada burbuja.

import { useEffect, useState } from "react";
import { escribirComoAgencia } from "@/app/(admin)/gestion/acciones";
import type { Mensaje } from "@/lib/conversaciones";
import { Conversacion } from "@/ui/Conversacion";

export function ChatDeCarpeta({
  carpetaId,
  nombre,
  cuantos,
}: {
  carpetaId: string;
  nombre: string;
  cuantos: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [enviando, setEnviando] = useState(false);

  // Mientras el chat está abierto se pregunta cada seis segundos: es cuando
  // importa enterarse rápido de que el cliente contestó.
  useEffect(() => {
    if (!abierto) return;
    let vivo = true;

    async function traer() {
      try {
        const r = await fetch(`/api/conversacion/${carpetaId}`, { cache: "no-store" });
        if (!r.ok) return;
        const { mensajes: llegaron } = (await r.json()) as { mensajes: Mensaje[] };
        if (vivo) setMensajes(llegaron);
      } catch {}
    }

    traer();
    const cada = setInterval(traer, 6000);
    return () => {
      vivo = false;
      clearInterval(cada);
    };
  }, [abierto, carpetaId]);

  async function enviar(texto: string) {
    setEnviando(true);
    try {
      const r = await escribirComoAgencia(carpetaId, texto);
      if (r.ok) setMensajes(r.mensajes);
    } finally {
      setEnviando(false);
    }
  }

  // Mientras no se abrió, el número lo pone el servidor; una vez abierto, lo
  // que se está viendo.
  const total = abierto ? mensajes.length : cuantos;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-toque border-2 border-tinta px-4 text-normal font-bold tracking-tight
                   text-tinta transition-colors hover:bg-hueco"
      >
        Conversación
        {total > 0 && (
          <span className="ml-2 bg-tinta px-1.5 text-micro font-extrabold text-lienzo">
            {total}
          </span>
        )}
      </button>

      {abierto && (
        <Conversacion
          carpeta={nombre}
          mensajes={mensajes}
          yo="agencia"
          enviando={enviando}
          onEnviar={enviar}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
