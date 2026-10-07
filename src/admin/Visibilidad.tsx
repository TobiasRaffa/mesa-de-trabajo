"use client";

// El interruptor de «lo ve el cliente».
//
// **Es uno solo para todo**: una carpeta de trabajo, una subcarpeta de cuarto
// nivel y un archivo suelto se prenden y se apagan con este mismo control. La
// alternativa era escribir uno para carpetas y otro para archivos, y ya
// sabemos cómo termina: se arregla uno y el otro queda raro.
//
// Es un interruptor y no dos botones «Sí» y «No»: con los dos botones, el
// elegido iba pintado de negro, y negro se leía como «botón», no como «esto es
// lo que está puesto». Verde a la derecha es sí; gris a la izquierda es no.

import { useState, useTransition } from "react";
import { cambiarVisibilidad } from "@/app/(admin)/gestion/acciones";
import { TITULO } from "@/admin/estilos";
import { Interruptor } from "@/ui/Interruptor";

export function Visibilidad({
  ids,
  visible,
  alGuardar,
}: {
  /** Uno para una carpeta; todas sus vueltas para una pieza. */
  ids: string[];
  visible: boolean;
  que: "carpeta" | "archivo";
  alGuardar: () => void;
}) {
  const [, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function poner(nuevo: boolean) {
    if (nuevo === visible || guardando) return;
    setGuardando(true);
    setError(null);
    empezar(async () => {
      const r = await cambiarVisibilidad(ids, nuevo);
      setGuardando(false);
      if (r.ok) alGuardar();
      else setError(r.motivo ?? "No pude guardarlo.");
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h4 className={TITULO}>Lo ve el cliente</h4>
        <Interruptor
          encendido={visible}
          deshabilitado={guardando}
          onCambiar={poner}
          etiqueta="Lo ve el cliente"
        />
      </div>
      {error && <p className="mt-2 text-menudo font-semibold text-alerta">{error}</p>}
    </section>
  );
}
