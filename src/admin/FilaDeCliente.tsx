"use client";

// Un cliente en la pantalla que los administra.
//
// Muestra lo único que Drive no sabe —si está habilitado y cuál es su link— y
// deja entrar a sus carpetas.

import { useActionState, useState } from "react";
import Link from "next/link";
import { cambiarCliente, renovarLinkDeCliente } from "@/app/(admin)/gestion/acciones";
import type { ClienteEnGestion } from "@/admin/datos/carpetas";

export function FilaDeCliente({ cliente }: { cliente: ClienteEnGestion }) {
  const [estado, guardar, esperando] = useActionState(cambiarCliente, null);
  const [estadoLink, renovar, renovando] = useActionState(renovarLinkDeCliente, null);
  const [copiado, setCopiado] = useState(false);

  const apagado = !cliente.habilitado;
  const link = `/t/${cliente.token}`;

  async function copiar() {
    try {
      // La dirección completa, que es lo que el cliente necesita recibir.
      await navigator.clipboard.writeText(new URL(link, location.origin).toString());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Un navegador que no deja copiar no rompe nada: el link está a la vista.
    }
  }

  return (
    <li className={`border-b border-linea px-4 py-5 ${apagado ? "bg-hueco/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-guia font-bold tracking-tight ${apagado ? "text-apagado" : ""}`}
            >
              {cliente.nombre}
            </h3>
            {apagado && (
              <span className="bg-tinta px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-lienzo">
                Sin acceso
              </span>
            )}
            {cliente.mensajes > 0 && (
              <span className="bg-acento-tenue px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-acento">
                {cliente.mensajes} {cliente.mensajes === 1 ? "mensaje" : "mensajes"}
              </span>
            )}
          </div>

          <p className="mt-1 text-menudo text-apagado">
            {apagado ? (
              "El robot ve su carpeta, pero el portal no la muestra."
            ) : (
              <>
                {cliente.carpetasVisibles} de {cliente.carpetas}{" "}
                {cliente.carpetas === 1 ? "carpeta visible" : "carpetas visibles"}
                {cliente.enlaceDrive && (
                  <>
                    {" · "}
                    <a
                      href={cliente.enlaceDrive}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-tinta underline underline-offset-2"
                    >
                      abrir en Drive
                    </a>
                  </>
                )}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!apagado && (
            <Link
              href={`/gestion/cliente/${cliente.id}`}
              className="inline-flex min-h-toque items-center bg-tinta px-4 text-normal font-bold
                         tracking-tight text-lienzo transition-colors hover:bg-tinta/90"
            >
              Ver carpetas
            </Link>
          )}

          <form action={guardar}>
            <input type="hidden" name="clienteId" value={cliente.id} />
            <input type="hidden" name="habilitado" value={apagado ? "si" : "no"} />
            <button
              type="submit"
              disabled={esperando}
              className="min-h-toque border-2 border-tinta px-4 text-normal font-bold tracking-tight
                         text-tinta transition-colors hover:bg-hueco disabled:opacity-40"
            >
              {apagado ? "Dar acceso" : "Quitar acceso"}
            </button>
          </form>
        </div>
      </div>

      {/* El link del cliente. Es lo que se le manda por WhatsApp. */}
      {!apagado && (
        <div className="mt-4 flex flex-wrap items-center gap-2 bg-hueco/60 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-menudo text-tinta-suave">
            {link}
          </code>
          <button
            type="button"
            onClick={copiar}
            className="shrink-0 border border-linea bg-lienzo px-3 py-1.5 text-micro font-extrabold
                       uppercase tracking-wider text-tinta transition-colors hover:bg-hueco"
          >
            {copiado ? "Copiado" : "Copiar"}
          </button>
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
              Cambiar link
            </button>
          </form>
        </div>
      )}

      {((estado && !estado.ok) || (estadoLink && !estadoLink.ok)) && (
        <p aria-live="polite" className="mt-2 text-menudo font-semibold text-alerta">
          {estado && !estado.ok ? estado.motivo : estadoLink && !estadoLink.ok ? estadoLink.motivo : ""}
        </p>
      )}
    </li>
  );
}
