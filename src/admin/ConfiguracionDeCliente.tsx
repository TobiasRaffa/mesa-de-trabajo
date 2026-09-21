"use client";

// Lo que se configura de un cliente, todos los días.
//
// **La clave no está acá**: vive en Admin. Es un dato que se pone una vez y
// después se mira el día que alguien no puede entrar, y estando arriba de todo
// empujaba hacia abajo lo que sí se usa seguido —quién lo lleva, cuántos días
// tiene para revisar, si el portal está prendido—.

import { useActionState, useEffect } from "react";
import {
  cambiarCliente,
  cambiarVerEnDrive,
  ponerTelefonoDeCliente,
  renovarLinkDeCliente,
} from "@/app/(admin)/gestion/acciones";
import { LinkParaCompartir } from "@/admin/LinkParaCompartir";
import { DiasDeRevision } from "@/admin/DiasDeRevision";
import { Responsable } from "@/admin/Responsable";
import type { ClienteEnGestion } from "@/admin/datos/carpetas";
import type { Persona } from "@/lib/equipo";

import { TITULO } from "@/admin/estilos";

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
  const [estadoDrive, verDrive, cambiandoDrive] = useActionState(cambiarVerEnDrive, null);
  const [estadoTel, guardarTel, guardandoTel] = useActionState(ponerTelefonoDeCliente, null);
  const apagado = !cliente.habilitado;

  useEffect(() => {
    if (estado?.ok || estadoLink?.ok || estadoDrive?.ok || estadoTel?.ok) alGuardar();
  }, [estado, estadoLink, estadoDrive, estadoTel, alGuardar]);

  return (
    <div className="flex flex-col gap-4">
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
            alGuardar={alGuardar}
          />
        </div>
      </section>

      {/* ------------------------------ El teléfono ---------------------- */}
      <section>
        <h4 className={TITULO}>Teléfono del cliente</h4>
        <p className="mt-1 text-menudo text-apagado">
          Para el mensaje de entrega: con esto, al entregar un trabajo aparece un
          botón que abre WhatsApp con el aviso ya escrito. La aplicación no manda
          nada sola; el mensaje lo mandás vos.
        </p>
        <form action={guardarTel} className="mt-2 flex flex-wrap gap-2">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <input
            type="tel"
            name="telefono"
            defaultValue={cliente.telefono}
            placeholder="+54 9 11 5555-5555"
            aria-label="Teléfono del cliente"
            className="min-w-52 flex-1 border-2 border-linea bg-lienzo px-3 py-2 text-normal
                       placeholder:text-apagado focus:border-acento focus:outline-none"
          />
          <button
            type="submit"
            disabled={guardandoTel}
            className="rounded-full min-h-toque border-2 border-tinta px-4 text-normal font-bold
                       tracking-tight text-tinta transition-colors hover:bg-hueco disabled:opacity-40"
          >
            {guardandoTel ? "Guardando…" : "Guardar"}
          </button>
        </form>
        {estadoTel && !estadoTel.ok && (
          <p aria-live="polite" className="mt-2 text-menudo font-semibold text-alerta">
            {estadoTel.motivo}
          </p>
        )}
      </section>

      {/* ---------------------------- Links a Drive ---------------------- */}
      <section>
        <h4 className={TITULO}>¿Le compartiste la carpeta en Drive?</h4>
        <p className="mt-1 text-menudo text-apagado">
          El portal no lo necesita: ve y descarga por nuestro servidor. Esto es
          para mostrarle además los links a Drive, y solo sirve si le compartiste
          la carpeta desde Google. Si no, el link lo lleva a una pantalla
          pidiéndole un permiso que no tiene.
        </p>
        <form action={verDrive} className="mt-2 flex">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <button
            type="submit"
            name="verEnDrive"
            value="si"
            disabled={cambiandoDrive}
            aria-pressed={cliente.verEnDrive}
            className={`rounded-l-full h-8 border-2 border-tinta px-4 text-menudo font-bold tracking-tight
                        transition-colors disabled:opacity-40 ${
                          cliente.verEnDrive
                            ? "bg-tinta text-lienzo"
                            : "text-tinta hover:bg-hueco"
                        }`}
          >
            Sí
          </button>
          <button
            type="submit"
            name="verEnDrive"
            value="no"
            disabled={cambiandoDrive}
            aria-pressed={!cliente.verEnDrive}
            className={`rounded-r-full h-8 border-2 border-l-0 border-tinta px-4 text-menudo font-bold
                        tracking-tight transition-colors disabled:opacity-40 ${
                          cliente.verEnDrive
                            ? "text-tinta hover:bg-hueco"
                            : "bg-tinta text-lienzo"
                        }`}
          >
            No
          </button>
        </form>
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
            className={`rounded-l-full h-8 border-2 border-tinta px-4 text-menudo font-bold tracking-tight
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
            className={`rounded-r-full h-8 border-2 border-l-0 border-tinta px-4 text-menudo font-bold
                        tracking-tight transition-colors disabled:opacity-40 ${
                          apagado ? "bg-tinta text-lienzo" : "text-tinta hover:bg-hueco"
                        }`}
          >
            No
          </button>
        </form>
      </section>

      {[estado, estadoLink, estadoDrive]
        .filter((r) => r && !r.ok)
        .map((r, i) => (
          <p key={i} aria-live="polite" className="text-menudo font-semibold text-alerta">
            {r && !r.ok ? r.motivo : ""}
          </p>
        ))}
    </div>
  );
}
