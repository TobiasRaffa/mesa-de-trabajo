"use client";

// Todo lo que se configura de una carpeta de trabajo.

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { guardarCarpeta, pedirLinkDeCarpeta } from "@/app/(admin)/gestion/acciones";
import { DiasDeRevision } from "@/admin/DiasDeRevision";
import { Responsable } from "@/admin/Responsable";
import { LinkParaCompartir } from "@/admin/LinkParaCompartir";
import { Visibilidad } from "@/admin/Visibilidad";
import type { NodoCarpeta } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";

import { BOTON, TITULO } from "@/admin/estilos";

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
        className={`h-8 border-2 border-tinta px-4 text-menudo font-bold tracking-tight
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
        className={`h-8 border-2 border-l-0 border-tinta px-4 text-menudo font-bold
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
  clienteId,
  equipo,
  alGuardar,
}: {
  carpeta: NodoCarpeta;
  clienteId: string;
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
    <div className="flex flex-col gap-4">
      {/* -------------------------- Lo ve el cliente --------------------- */}
      <Visibilidad
        ids={[carpeta.id]}
        visible={carpeta.visible}
        que="carpeta"
        alGuardar={alGuardar}
      />

      {/* ------------------------------ Calendario ----------------------- */}
      <section>
        <h4 className={TITULO}>Verlo como calendario</h4>
        <div className="mt-2 flex flex-wrap items-center gap-3">
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

          {carpeta.vista === "calendario" && !oculta && (
            <Link
              href={`/gestion/cliente/${clienteId}/carpeta/${carpeta.id}`}
              className="inline-flex h-8 items-center bg-acento px-3 text-menudo font-bold
                         tracking-tight text-white transition-colors hover:bg-acento-hover"
            >
              Armar calendario
            </Link>
          )}
        </div>
      </section>

      {/* ---------------------------- Quién lo lleva --------------------- */}
      <section>
        <h4 className={TITULO}>Quién lo lleva</h4>
        <div className="mt-2">
          <Responsable
            nivel="carpeta"
            id={carpeta.id}
            quien={carpeta.responsableQueCorre}
            propio={carpeta.responsable !== undefined}
            equipo={equipo}
            alGuardar={alGuardar}
          />
        </div>
      </section>

      {/* -------------------------- Tiempo de revisión ------------------- */}
      <section>
        <h4 className={TITULO}>Tiempo de revisión</h4>
        <div className="mt-2">
          <DiasDeRevision
            nivel="carpeta"
            id={carpeta.id}
            dias={carpeta.diasQueCorren}
            propio={carpeta.dias !== undefined}
            alGuardar={alGuardar}
          />
        </div>
      </section>

      {/* ------------------------- El link de la carpeta ----------------- */}
      {!oculta && (
        <section>
          <h4 className={TITULO}>Link de esta carpeta sola</h4>
          <div className="mt-2">
            {token ? (
              <LinkParaCompartir token={token} etiqueta="Solo esta carpeta" />
            ) : (
              <button
                type="button"
                onClick={pedirLink}
                disabled={pidiendo}
                className={BOTON}
              >
                {pidiendo ? "Generando…" : "Generar el link"}
              </button>
            )}
          </div>
        </section>
      )}

      {[estado]
        .filter((r) => r && !r.ok)
        .map((r, i) => (
          <p key={i} aria-live="polite" className="text-menudo font-semibold text-alerta">
            {r && !r.ok ? r.motivo : ""}
          </p>
        ))}
    </div>
  );
}
