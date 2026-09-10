"use client";

// Lo que se configura de un archivo suelto.
//
// Existe para los casos que no entran en la regla de la carpeta: «esta la
// necesitamos el jueves y el resto la semana que viene», «esta la lleva Delfi
// aunque el resto sea de Nari». Es el último escalón de la herencia, y lo que
// se pone acá gana sobre todo lo de arriba.

import { DiasDeRevision } from "@/admin/DiasDeRevision";
import { Responsable } from "@/admin/Responsable";
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
