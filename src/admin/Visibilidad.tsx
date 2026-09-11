"use client";

// El interruptor de «lo ve el cliente».
//
// **Es uno solo para todo**: una carpeta de trabajo, una subcarpeta de cuarto
// nivel y un archivo suelto se prenden y se apagan con este mismo control. La
// alternativa era escribir uno para carpetas y otro para archivos, y ya
// sabemos cómo termina: se arregla uno y el otro queda raro.
//
// Dice «Sí» y «No» y no «Ocultar», porque un botón que nombra la acción
// contraria obliga a deducir el estado actual. Acá el estado se lee sin pensar.
//
// Apagar algo apaga todo lo que tiene adentro, y eso se avisa antes de que
// alguien se pregunte por qué desapareció media carpeta del portal.

import { useState, useTransition } from "react";
import { cambiarVisibilidad } from "@/app/(admin)/gestion/acciones";
import { TITULO } from "@/admin/estilos";

export function Visibilidad({
  ids,
  visible,
  /** «carpeta» o «archivo»: cambia lo que se advierte, no lo que hace. */
  que,
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
      <h4 className={TITULO}>Lo ve el cliente</h4>

      <div className="mt-2 flex">
        <Boton
          texto="Sí"
          activo={visible}
          esperando={guardando}
          onTocar={() => poner(true)}
        />
        <Boton
          texto="No"
          activo={!visible}
          esperando={guardando}
          primero={false}
          onTocar={() => poner(false)}
        />
      </div>

      {!visible && que === "carpeta" && (
        <p className="mt-2 text-menudo text-apagado">
          Tampoco ve nada de lo que tenga adentro, por hondo que esté.
        </p>
      )}

      {error && <p className="mt-2 text-menudo font-semibold text-alerta">{error}</p>}
    </section>
  );
}

function Boton({
  texto,
  activo,
  esperando,
  primero = true,
  onTocar,
}: {
  texto: string;
  activo: boolean;
  esperando: boolean;
  primero?: boolean;
  onTocar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTocar}
      disabled={esperando}
      aria-pressed={activo}
      className={`h-8 border-2 border-tinta px-4 text-menudo font-bold tracking-tight
                  transition-colors disabled:opacity-40 ${primero ? "" : "border-l-0"} ${
                    activo ? "bg-tinta text-lienzo" : "text-tinta hover:bg-hueco"
                  }`}
    >
      {texto}
    </button>
  );
}
