"use client";

// Todo lo que se configura de un cliente.
//
// La clave está tapada y pide contraseña para verse o cambiarse. Es el dato
// con el que alguien entra al portal del cliente: no tiene por qué estar
// escrito en pantalla para quien pase por atrás, ni viajar al navegador hasta
// que alguien lo pida.

import { useActionState, useEffect } from "react";
import {
  cambiarCliente,
  ponerTagDeCliente,
  renovarLinkDeCliente,
  verClaveDeCliente,
} from "@/app/(admin)/gestion/acciones";
import { LinkParaCompartir } from "@/admin/LinkParaCompartir";
import { DiasDeRevision } from "@/admin/DiasDeRevision";
import { Responsable } from "@/admin/Responsable";
import type { ClienteEnGestion } from "@/admin/datos/carpetas";
import type { Persona } from "@/lib/equipo";

const TITULO = "text-micro font-extrabold uppercase tracking-widest text-apagado";

const CAMPO =
  "min-w-0 border border-linea bg-lienzo px-3 py-2 text-normal font-bold " +
  "transition-colors placeholder:font-normal placeholder:text-apagado " +
  "focus:border-acento focus:outline-none";

const BOTON =
  "min-h-toque shrink-0 border-2 border-tinta px-4 text-normal font-bold " +
  "tracking-tight text-tinta transition-colors hover:bg-hueco disabled:opacity-40";

export function ConfiguracionDeCliente({
  cliente,
  equipo,
  alGuardar,
}: {
  cliente: ClienteEnGestion;
  equipo: Persona[];
  /** Se llama cuando algo se guardó, para que la fila de arriba se actualice. */
  alGuardar: () => void;
}) {
  const [estado, guardar, esperando] = useActionState(cambiarCliente, null);
  const [estadoLink, renovar, renovando] = useActionState(renovarLinkDeCliente, null);
  const [estadoTag, guardarTag, guardandoTag] = useActionState(ponerTagDeCliente, null);
  const [estadoVer, verClave, viendo] = useActionState(verClaveDeCliente, null);

  const apagado = !cliente.habilitado;
  const revelada = estadoVer?.ok ? estadoVer.clave : null;

  useEffect(() => {
    if (estado?.ok || estadoTag?.ok || estadoLink?.ok) alGuardar();
  }, [estado, estadoTag, estadoLink, alGuardar]);

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------- La clave ------------------------ */}
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className={TITULO}>Clave del cliente</h4>
          {!cliente.tieneClave && (
            <span className="bg-espera-borde px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-tinta">
              Falta
            </span>
          )}
        </div>

        {revelada === null ? (
          <form action={verClave} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="clienteId" value={cliente.id} />
            <input
              name="contrasena"
              type="password"
              autoComplete="off"
              placeholder="contraseña"
              aria-label="Contraseña de administración"
              className={`${CAMPO} w-44`}
            />
            <button type="submit" disabled={viendo} className={BOTON}>
              Ver o cambiar
            </button>
          </form>
        ) : (
          <form action={guardarTag} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="clienteId" value={cliente.id} />
            <input
              name="tag"
              type="text"
              defaultValue={revelada}
              autoComplete="off"
              aria-label="Clave del cliente"
              className={`${CAMPO} flex-1`}
            />
            <input
              name="contrasena"
              type="password"
              autoComplete="off"
              placeholder="contraseña"
              aria-label="Contraseña de administración"
              className={`${CAMPO} w-40`}
            />
            <button type="submit" disabled={guardandoTag} className={BOTON}>
              Guardar
            </button>
          </form>
        )}
      </section>

      {/* -------------------------------- El link ------------------------ */}
      {!apagado && (
        <section>
          <h4 className={TITULO}>Link del portal</h4>
          <div className="mt-2">
            <LinkParaCompartir
              token={cliente.token}
              etiqueta="Todo el cliente"
              alRenovar={
                <form action={renovar} className="shrink-0">
                  <input type="hidden" name="clienteId" value={cliente.id} />
                  <button
                    type="submit"
                    disabled={renovando}
                    title="El link viejo deja de funcionar en el acto"
                    className="px-2 py-1.5 text-micro font-extrabold uppercase tracking-wider
                               text-apagado underline underline-offset-2 transition-colors
                               hover:text-alerta disabled:opacity-40"
                  >
                    Cambiar
                  </button>
                </form>
              }
            />
          </div>
        </section>
      )}

      {/* ---------------------------- Quién lo lleva --------------------- */}
      <section>
        <h4 className={TITULO}>Quién lo lleva</h4>
        <div className="mt-2">
          <Responsable
            nivel="cliente"
            id={cliente.id}
            quien={cliente.responsable}
            propio={cliente.responsablePropio}
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
            nivel="cliente"
            id={cliente.id}
            dias={cliente.dias}
            propio={cliente.diasPropios}
            alGuardar={alGuardar}
          />
        </div>
      </section>

      {/* ------------------------------- El acceso ----------------------- */}
      <section>
        <h4 className={TITULO}>Acceso al portal</h4>
        <form action={guardar} className="mt-2 flex">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <button
            type="submit"
            name="habilitado"
            value="si"
            disabled={esperando}
            aria-pressed={!apagado}
            className={`min-h-toque border-2 border-tinta px-5 text-normal font-bold tracking-tight
                        transition-colors disabled:opacity-40 ${
                          apagado ? "text-tinta hover:bg-hueco" : "bg-tinta text-lienzo"
                        }`}
          >
            Sí
          </button>
          <button
            type="submit"
            name="habilitado"
            value="no"
            disabled={esperando}
            aria-pressed={apagado}
            className={`min-h-toque border-2 border-l-0 border-tinta px-5 text-normal font-bold
                        tracking-tight transition-colors disabled:opacity-40 ${
                          apagado ? "bg-tinta text-lienzo" : "text-tinta hover:bg-hueco"
                        }`}
          >
            No
          </button>
        </form>
      </section>

      {[estado, estadoLink, estadoTag, estadoVer]
        .filter((r) => r && !r.ok)
        .map((r, i) => (
          <p key={i} aria-live="polite" className="text-menudo font-semibold text-alerta">
            {r && !r.ok ? r.motivo : ""}
          </p>
        ))}
    </div>
  );
}
