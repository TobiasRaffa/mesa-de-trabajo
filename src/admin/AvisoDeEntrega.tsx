"use client";

// El mensaje para avisarle al cliente, apenas se entregó.
//
// **Aparece solo, en el único momento en que hace falta.** Entregar y avisar
// son dos actos, y el segundo es el que se olvida: el trabajo queda entregado,
// el plazo corriendo, y el cliente sin enterarse hasta que alguien se acuerda
// tres días después. El mensaje ya escrito, ahí mismo, es lo que hace que ese
// paso se dé.
//
// **La aplicación sigue sin escribirle a nadie.** Eso no se toca: no hay envío
// automático, no hay nada que salga sin que una persona lo lea. Acá hay un
// texto para copiar y, si el cliente tiene teléfono cargado, un link que abre
// WhatsApp con el mensaje escrito. Quien entregó decide si lo manda.

import { useState } from "react";
import { linkDeWhatsApp, mensajeDeEntrega } from "@/lib/plantillas";
import type { ParaAvisar } from "@/app/(admin)/gestion/acciones";

export function AvisoDeEntrega({
  avisar,
  cuantas,
  onListo,
}: {
  avisar: ParaAvisar;
  cuantas: number;
  onListo: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  // El link se arma acá porque la dirección de la aplicación la sabe el
  // navegador y no el servidor.
  const link =
    typeof location === "undefined"
      ? `/t/${avisar.token}`
      : new URL(`/t/${avisar.token}`, location.origin).toString();

  const texto = mensajeDeEntrega({
    cliente: "",
    carpeta: avisar.carpeta,
    link,
    dias: avisar.dias,
  });

  const whatsapp = linkDeWhatsApp(avisar.telefono, texto);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin portapapeles el texto está a la vista para seleccionarlo a mano.
    }
  }

  return (
    <div className="flex flex-col gap-3 border-2 border-tinta bg-lienzo p-3">
      <p className="text-menudo font-bold tracking-tight">
        {cuantas === 1 ? "Entregada 1 pieza" : `Entregadas ${cuantas} piezas`}. Falta
        avisarle.
      </p>

      {/* El texto se muestra entero y se puede editar antes de copiarlo: quien
          manda es quien decide qué dice. */}
      <textarea
        readOnly
        value={texto}
        rows={4}
        aria-label="El mensaje para el cliente"
        className="w-full resize-y border border-linea bg-papel p-2 text-menudo
                   whitespace-pre-wrap"
      />

      <div className="flex flex-wrap gap-2">
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer noopener"
            className="min-h-toque inline-flex items-center bg-acento px-4 text-normal
                       font-bold tracking-tight text-white transition-colors hover:bg-acento-hover"
          >
            Mandarlo por WhatsApp
          </a>
        ) : (
          // Sin teléfono no se ofrece un botón que no va a funcionar: se dice
          // dónde se carga, que es lo único útil en ese momento.
          <p className="self-center text-micro text-apagado">
            Cargá el teléfono del cliente en su configuración y este mensaje sale de
            acá por WhatsApp.
          </p>
        )}

        <button
          type="button"
          onClick={copiar}
          className="min-h-toque border-2 border-tinta px-4 text-normal font-bold
                     tracking-tight text-tinta transition-colors hover:bg-hueco"
        >
          {copiado ? "Copiado" : "Copiar el mensaje"}
        </button>

        <button
          type="button"
          onClick={onListo}
          className="min-h-toque px-3 text-menudo font-bold tracking-tight text-apagado
                     underline underline-offset-4 transition-colors hover:text-tinta"
        >
          Listo
        </button>
      </div>
    </div>
  );
}
