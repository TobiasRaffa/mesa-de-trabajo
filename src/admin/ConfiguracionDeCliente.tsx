"use client";

// Todo lo que se configura de un cliente, en un solo lugar.
//
// Está separado de la navegación a propósito: abrir la fila muestra qué hay
// adentro, esto muestra qué se puede cambiar. Mezclarlos hacía que buscar un
// archivo obligara a pasar por encima del botón que le corta el acceso.

import { useActionState } from "react";
import {
  cambiarCliente,
  ponerTagDeCliente,
  renovarLinkDeCliente,
} from "@/app/(admin)/gestion/acciones";
import { LinkParaCompartir } from "@/admin/LinkParaCompartir";
import type { ClienteEnGestion } from "@/admin/datos/carpetas";

export function ConfiguracionDeCliente({ cliente }: { cliente: ClienteEnGestion }) {
  const [estado, guardar, esperando] = useActionState(cambiarCliente, null);
  const [estadoLink, renovar, renovando] = useActionState(renovarLinkDeCliente, null);
  const [estadoTag, guardarTag, guardandoTag] = useActionState(ponerTagDeCliente, null);

  const apagado = !cliente.habilitado;
  const sinTag = cliente.tag.trim() === "";

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------- La clave ------------------------ */}
      <section>
        <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
          La clave del cliente
        </h4>
        <p className="mt-1 max-w-xl text-menudo text-tinta-suave">
          Es lo que escribe para entrar. Pasásela <strong>por otro lado</strong>, no en
          el mismo mensaje que el link: mandar los dos juntos es mandar la llave pegada a
          la puerta.
        </p>

        <form action={guardarTag} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <input
            name="tag"
            type="text"
            defaultValue={cliente.tag}
            placeholder="una palabra que le pases vos"
            autoComplete="off"
            aria-label="Clave del cliente"
            className="min-w-0 flex-1 border border-linea bg-lienzo px-3 py-2 text-normal
                       font-bold transition-colors placeholder:font-normal
                       placeholder:text-apagado focus:border-acento focus:outline-none"
          />
          <button
            type="submit"
            disabled={guardandoTag}
            className="min-h-toque shrink-0 border-2 border-tinta px-4 text-normal font-bold
                       tracking-tight text-tinta transition-colors hover:bg-hueco disabled:opacity-40"
          >
            Guardar
          </button>
        </form>

        {sinTag && (
          <p className="mt-2 border-l-4 border-espera-borde bg-espera-tenue px-3 py-2 text-menudo text-espera">
            Sin clave, el link no deja entrar a nadie.
          </p>
        )}
      </section>

      {/* -------------------------------- El link ------------------------ */}
      {!apagado && (
        <section>
          <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
            El link del portal
          </h4>
          <p className="mt-1 max-w-xl text-menudo text-tinta-suave">
            Muestra todas sus carpetas visibles. Cada carpeta tiene además el suyo, si
            querés mandarle una sola.
          </p>
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

      {/* ------------------------------- El acceso ----------------------- */}
      <section className="border-t border-linea-tenue pt-4">
        <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
          El acceso
        </h4>
        <p className="mt-1 max-w-xl text-menudo text-tinta-suave">
          {apagado
            ? "Su portal está apagado. El robot sigue viendo la carpeta en Drive."
            : "Apagarlo deja su portal sin funcionar, sin tocar Drive. Para cortar de raíz, dejá de compartirle la carpeta en Drive."}
        </p>
        <form action={guardar} className="mt-2">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <input type="hidden" name="habilitado" value={apagado ? "si" : "no"} />
          <button
            type="submit"
            disabled={esperando}
            className={`min-h-toque border-2 px-4 text-normal font-bold tracking-tight
                        transition-colors disabled:opacity-40 ${
                          apagado
                            ? "border-tinta bg-tinta text-lienzo hover:bg-tinta/90"
                            : "border-alerta text-alerta hover:bg-alerta-tenue"
                        }`}
          >
            {apagado ? "Dar acceso" : "Quitar acceso"}
          </button>
        </form>
      </section>

      {[estado, estadoLink, estadoTag]
        .filter((r) => r && !r.ok)
        .map((r, i) => (
          <p key={i} aria-live="polite" className="text-menudo font-semibold text-alerta">
            {r && !r.ok ? r.motivo : ""}
          </p>
        ))}
    </div>
  );
}
