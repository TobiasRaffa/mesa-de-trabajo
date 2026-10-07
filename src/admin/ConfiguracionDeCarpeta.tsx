"use client";

// Todo lo que se configura de una carpeta de trabajo.

import { useActionState, useEffect, useState } from "react";
import { guardarCarpeta, pedirLinkDeCarpeta } from "@/app/(admin)/gestion/acciones";
import { DiasDeRevision } from "@/admin/DiasDeRevision";
import { Responsable } from "@/admin/Responsable";
import { LinkParaCompartir } from "@/admin/LinkParaCompartir";
import { Visibilidad } from "@/admin/Visibilidad";
import type { NodoCarpeta } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";

import { BOTON, TITULO } from "@/admin/estilos";
import { CALENDARIO_ACTIVO } from "@/dominio/agencia";

/**
 * Dos botones que dicen qué está pasando, no qué va a pasar.
 *
 * Un solo botón que dice «Ocultar» obliga a deducir el estado actual de la
 * acción contraria. Con Sí y No, el estado se lee sin pensar.
 */
function SiONo({
  activo,
  esperando,
  campos,
  nombre,
  valorSi,
  valorNo,
}: {
  activo: boolean;
  esperando: boolean;
  campos: React.ReactNode;
  nombre: string;
  valorSi: string;
  valorNo: string;
}) {
  return (
    <div className="flex">
      {campos}
      <button
        type="submit"
        name={nombre}
        value={valorSi}
        disabled={esperando}
        aria-pressed={activo}
        className={`rounded-l-full h-8 border-2 border-tinta px-4 text-menudo font-bold tracking-tight
                    transition-colors disabled:opacity-40 ${
                      activo ? "bg-tinta text-lienzo" : "text-tinta hover:bg-hueco"
                    }`}
      >
        Sí
      </button>
      <button
        type="submit"
        name={nombre}
        value={valorNo}
        disabled={esperando}
        aria-pressed={!activo}
        className={`rounded-r-full h-8 border-2 border-l-0 border-tinta px-4 text-menudo font-bold
                    tracking-tight transition-colors disabled:opacity-40 ${
                      activo ? "text-tinta hover:bg-hueco" : "bg-tinta text-lienzo"
                    }`}
      >
        No
      </button>
    </div>
  );
}

export function ConfiguracionDeCarpeta({
  carpeta,
  equipo,
  alGuardar,
}: {
  carpeta: NodoCarpeta;
  equipo: Persona[];
  /** Se llama cuando algo se guardó, para que la fila de arriba se actualice. */
  alGuardar: () => void;
}) {
  const [estado, guardar, esperando] = useActionState(guardarCarpeta, null);
  const [token, setToken] = useState(carpeta.token ?? null);
  const [pidiendo, setPidiendo] = useState(false);

  const oculta = !carpeta.visible;

  // Guardar cambia lo que dice la fila de arriba —«oculta», «calendario», quién
  // la lleva—. Sin esto, el cartel seguía mostrando lo viejo hasta cerrar y
  // volver a abrir, y parecía que el cambio no se había guardado.
  useEffect(() => {
    if (estado?.ok) alGuardar();
  }, [estado, alGuardar]);

  async function pedirLink() {
    setPidiendo(true);
    try {
      const r = await pedirLinkDeCarpeta(carpeta.id);
      if (r.ok) setToken(r.token);
    } finally {
      setPidiendo(false);
    }
  }

  return (
    <div className="flex flex-col divide-y divide-linea">
      {/* Cada opción es un renglón: el nombre a la izquierda y el control a la
          derecha. Apiladas una debajo de otra —título, control, título,
          control— el panel ocupaba el doble de alto para lo mismo. */}
      <div className="py-2.5 first:pt-0">
        <Visibilidad
          ids={[carpeta.id]}
          visible={carpeta.visible}
          que="carpeta"
          alGuardar={alGuardar}
        />
      </div>

      {CALENDARIO_ACTIVO && (
        <Renglon titulo="Verlo como calendario">
          <form action={guardar}>
            <SiONo
              activo={carpeta.vista === "calendario"}
              esperando={esperando || oculta}
              nombre="vista"
              valorSi="calendario"
              valorNo="lista"
              campos={
                <>
                  <input type="hidden" name="carpetaId" value={carpeta.id} />
                  <input type="hidden" name="nombre" value={carpeta.nombre} />
                </>
              }
            />
          </form>
        </Renglon>
      )}

      <Renglon titulo="Quién lo lleva">
        <Responsable
          nivel="carpeta"
          id={carpeta.id}
          quien={carpeta.responsableQueCorre}
          equipo={equipo}
          alGuardar={alGuardar}
        />
      </Renglon>

      <Renglon titulo="Tiempo de revisión">
        <DiasDeRevision
          nivel="carpeta"
          id={carpeta.id}
          dias={carpeta.diasQueCorren}
          alGuardar={alGuardar}
        />
      </Renglon>

      {!oculta && (
        <Renglon titulo="Link de esta carpeta">
          {token ? (
            <LinkParaCompartir token={token} etiqueta="Solo esta carpeta" />
          ) : (
            <button type="button" onClick={pedirLink} disabled={pidiendo} className={BOTON}>
              {pidiendo ? "Generando…" : "Generar el link"}
            </button>
          )}
        </Renglon>
      )}

      {[estado]
        .filter((r) => r && !r.ok)
        .map((r, i) => (
          <p key={i} aria-live="polite" className="py-2 text-menudo font-semibold text-alerta">
            {r && !r.ok ? r.motivo : ""}
          </p>
        ))}
    </div>
  );
}

/** Un renglón del panel: el nombre de la opción a la izquierda, el control a la derecha. */
function Renglon({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
      <h4 className={TITULO}>{titulo}</h4>
      <div className="flex min-w-0 justify-end">{children}</div>
    </section>
  );
}
