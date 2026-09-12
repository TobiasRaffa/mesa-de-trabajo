"use client";

import { useState, useTransition } from "react";

// Lo que se configura de un archivo suelto.
//
// Existe para los casos que no entran en la regla de la carpeta: «esta la
// necesitamos el jueves y el resto la semana que viene», «esta la lleva Delfi
// aunque el resto sea de Nari». Es el último escalón de la herencia, y lo que
// se pone acá gana sobre todo lo de arriba.

import { Visibilidad } from "@/admin/Visibilidad";
import { DiasDeRevision } from "@/admin/DiasDeRevision";
import { Responsable } from "@/admin/Responsable";
import { habilitarExtraDePieza, reabrirPieza } from "@/app/(admin)/gestion/acciones";
import type { NodoArchivo } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";

import { TITULO } from "@/admin/estilos";

export function ConfiguracionDeArchivo({
  archivo,
  carpetaId,
  equipo,
  alGuardar,
}: {
  archivo: NodoArchivo;
  carpetaId: string;
  equipo: Persona[];
  alGuardar: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Visibilidad
        ids={archivo.archivos}
        visible={archivo.visible}
        que="archivo"
        alGuardar={alGuardar}
      />

      <section>
        <h4 className={TITULO}>Quién lo lleva</h4>
        <div className="mt-2">
          <Responsable
            nivel="archivo"
            id={archivo.id}
            carpetaId={carpetaId}
            quien={archivo.responsableQueCorre}
            propio={archivo.responsable !== undefined}
            equipo={equipo}
            alGuardar={alGuardar}
          />
        </div>
      </section>

      <section>
        <h4 className={TITULO}>Tiempo de revisión</h4>
        <div className="mt-2">
          <DiasDeRevision
            nivel="archivo"
            id={archivo.id}
            carpetaId={carpetaId}
            dias={archivo.diasQueCorren}
            propio={archivo.dias !== undefined}
            alGuardar={alGuardar}
          />
        </div>
      </section>

      {/* ------------------------ Lo que solo puede la agencia ----------- */}
      <AccionesDeAgencia archivo={archivo} carpetaId={carpetaId} alGuardar={alGuardar} />

      {archivo.enlaceDrive && (
        <section>
          <h4 className={TITULO}>El archivo</h4>
          <a
            href={archivo.enlaceDrive}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-flex h-8 items-center border-2 border-tinta px-3
                       text-menudo font-bold tracking-tight text-tinta transition-colors hover:bg-hueco"
          >
            Abrirlo en Drive
          </a>
        </section>
      )}
    </div>
  );
}

/**
 * Reabrir y habilitar la revisión adicional.
 *
 * Son las dos cosas que el dominio reservó para la agencia desde el principio
 * y que no tenían botón: aprobar era definitivo para todos —no había salida el
 * día que un cliente aprobaba por error— y el cliente que pedía una revisión
 * adicional esperaba para siempre.
 *
 * Cada una aparece solo cuando se puede hacer. Un botón que existe siempre y
 * contesta «no se puede» la mitad de las veces enseña a no leerlo.
 */
function AccionesDeAgencia({
  archivo,
  carpetaId,
  alGuardar,
}: {
  archivo: NodoArchivo;
  carpetaId: string;
  alGuardar: () => void;
}) {
  const [dicho, setDicho] = useState<string | null>(null);
  const [yendo, empezar] = useTransition();

  const puedeReabrir = archivo.estado === "final";
  const esperaExtra = archivo.estado === "extra_pedida";
  if (!puedeReabrir && !esperaExtra) return null;

  const hacer = (que: () => Promise<{ ok: boolean; motivo: string }>) =>
    empezar(async () => {
      const r = await que();
      setDicho(r.motivo);
      if (r.ok) alGuardar();
    });

  return (
    <section>
      <h4 className={TITULO}>{esperaExtra ? "Revisión adicional" : "Aprobada"}</h4>

      {esperaExtra ? (
        <>
          <p className="mt-1 text-menudo text-apagado">
            El cliente se quedó sin rondas y pidió una más. Está esperando.
          </p>
          <button
            type="button"
            disabled={yendo}
            onClick={() => hacer(() => habilitarExtraDePieza(carpetaId, archivo.id))}
            className="mt-2 min-h-toque bg-acento px-4 text-normal font-bold tracking-tight
                       text-white transition-colors hover:bg-acento-hover disabled:opacity-40"
          >
            {yendo ? "…" : "Habilitar una revisión más"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-menudo text-apagado">
            Reabrirla se la devuelve al cliente para que la mire de nuevo, y saca
            el archivo de «Entregas finales».
          </p>
          <button
            type="button"
            disabled={yendo}
            onClick={() => hacer(() => reabrirPieza(carpetaId, archivo.id))}
            className="mt-2 min-h-toque border-2 border-tinta px-4 text-normal font-bold
                       tracking-tight text-tinta transition-colors hover:bg-hueco disabled:opacity-40"
          >
            {yendo ? "…" : "Reabrir"}
          </button>
        </>
      )}

      {dicho && (
        <p aria-live="polite" className="mt-2 text-menudo font-semibold text-tinta-suave">
          {dicho}
        </p>
      )}
    </section>
  );
}
