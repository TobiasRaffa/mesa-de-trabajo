"use client";

import { useState, useTransition } from "react";

// Lo que se configura de un archivo suelto.
//
// Existe para los casos que no entran en la regla de la carpeta: «esta la
// necesitamos el jueves y el resto la semana que viene», «esta la lleva Delfi
// aunque el resto sea de Nari». Es el último escalón de la herencia, y lo que
// se pone acá gana sobre todo lo de arriba.

import { Entregar } from "@/admin/Entregar";
import { Visibilidad } from "@/admin/Visibilidad";
import { DiasDeRevision } from "@/admin/DiasDeRevision";
import { Responsable } from "@/admin/Responsable";
import { habilitarExtraDePieza, reabrirPieza } from "@/app/(admin)/gestion/acciones";
import type { NodoArchivo } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";

import { TITULO } from "@/admin/estilos";
import { Boton } from "@/ui/Boton";

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
      {/*
        **Entregar de a una, además de la carpeta entera.**
        Entregar la tanda es lo habitual —se arma y se manda—, pero no siempre:
        el banner sale hoy y el resto de la campaña la semana que viene.
        Faltaba, y sin esto la única salida era entregar todo o no entregar
        nada.
      */}
      {/*
        **Acá se puede entregar aunque no haya vuelta nueva.** En la carpeta no:
        entregar la tanda con una pieza que el cliente acaba de devolver le
        manda el mismo archivo sin una línea cambiada. Pero esta es la ficha de
        una pieza, y quien la abre está mirando esa y ninguna otra: si decide
        mandarla igual —porque el cambio se resolvió hablando, porque se
        entregó por otro lado—, es una decisión, no un descuido. Se avisa y se
        deja pasar.
      */}
      {archivo.estado === "en_curso" && archivo.version <= archivo.ronda && (
        <p className="border-l-4 border-espera-borde bg-espera-tenue px-3 py-2 text-menudo text-espera">
          El cliente devolvió esta pieza con cambios y todavía no hay una vuelta
          nueva en Drive. Si la entregás así, le llega el mismo archivo.
        </p>
      )}

      {/* Sin condición afuera: «Entregar» decide solo si se muestra. Con una
          condición acá, entregar desmonta el componente en el mismo momento en
          que el árbol se refresca —y se lleva puesto el mensaje para el
          cliente, que es justo lo que aparece después de entregar—. Ya había
          pasado dos veces: en el árbol y en el tablero. */}
      <Entregar
        carpetaId={carpetaId}
        carpeta={archivo.nombre}
        cuantas={archivo.estado === "en_curso" ? 1 : 0}
        piezaId={archivo.id}
        dias={archivo.diasQueCorren}
        alEntregar={alGuardar}
      />

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
            className="rounded-full mt-2 inline-flex h-8 items-center border-2 border-tinta px-3
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
          <Boton
            disabled={yendo}
            onClick={() => hacer(() => habilitarExtraDePieza(carpetaId, archivo.id))}
            tamano="chico"
            className="mt-2"
          >
            {yendo ? "…" : "Habilitar una revisión más"}
          </Boton>
        </>
      ) : (
        <>
          <p className="mt-1 text-menudo text-apagado">
            Reabrirla se la devuelve al cliente para que la mire de nuevo, y saca
            el archivo de «Entregas finales».
          </p>
          <Boton
            variante="contorno"
            disabled={yendo}
            onClick={() => hacer(() => reabrirPieza(carpetaId, archivo.id))}
            tamano="chico"
            className="mt-2"
          >
            {yendo ? "…" : "Reabrir"}
          </Boton>
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
