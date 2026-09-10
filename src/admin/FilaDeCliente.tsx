"use client";

// Un cliente en la pantalla que los administra.
//
// Muestra lo único que Drive no sabe —si está habilitado y cuál es su link— y
// deja entrar a sus carpetas.

import { useActionState } from "react";
import Link from "next/link";
import {
  cambiarCliente,
  ponerTagDeCliente,
  renovarLinkDeCliente,
} from "@/app/(admin)/gestion/acciones";
import { LinkParaCompartir } from "@/admin/LinkParaCompartir";
import type { ClienteEnGestion } from "@/admin/datos/carpetas";

export function FilaDeCliente({ cliente }: { cliente: ClienteEnGestion }) {
  const [estado, guardar, esperando] = useActionState(cambiarCliente, null);
  const [estadoLink, renovar, renovando] = useActionState(renovarLinkDeCliente, null);
  const [estadoTag, guardarTag, guardandoTag] = useActionState(ponerTagDeCliente, null);

  const apagado = !cliente.habilitado;
  const sinTag = cliente.tag.trim() === "";

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
            {!apagado && sinTag && (
              <span className="bg-espera-borde px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-tinta">
                Falta la clave
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

      {!apagado && (
        <div className="mt-4 flex flex-col gap-3">
          {/*
            La clave del cliente. Se le pasa **por otro lado**, no por el mismo
            mensaje que lleva el link: mandar los dos juntos es mandar la llave
            pegada a la puerta.
          */}
          <form action={guardarTag} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="clienteId" value={cliente.id} />
            <label
              htmlFor={`tag-${cliente.id}`}
              className="shrink-0 text-micro font-extrabold uppercase tracking-wider text-apagado"
            >
              Clave
            </label>
            <input
              id={`tag-${cliente.id}`}
              name="tag"
              type="text"
              defaultValue={cliente.tag}
              placeholder="una palabra que le pases vos"
              autoComplete="off"
              className="min-w-0 flex-1 border border-linea bg-lienzo px-3 py-1.5 text-menudo
                         font-bold transition-colors placeholder:font-normal placeholder:text-apagado
                         focus:border-acento focus:outline-none"
            />
            <button
              type="submit"
              disabled={guardandoTag}
              className="shrink-0 border-2 border-tinta px-3 py-1.5 text-micro font-extrabold
                         uppercase tracking-wider text-tinta transition-colors hover:bg-hueco
                         disabled:opacity-40"
            >
              Guardar
            </button>
          </form>

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

          {sinTag && (
            <p className="border-l-4 border-espera-borde bg-espera-tenue px-3 py-2 text-menudo text-espera">
              Sin clave, el link no deja entrar a nadie. Poné una y pasásela al cliente
              por otro lado.
            </p>
          )}
        </div>
      )}

      {[estado, estadoLink, estadoTag]
        .filter((r) => r && !r.ok)
        .map((r, i) => (
          <p key={i} aria-live="polite" className="mt-2 text-menudo font-semibold text-alerta">
            {r && !r.ok ? r.motivo : ""}
          </p>
        ))}
    </li>
  );
}
