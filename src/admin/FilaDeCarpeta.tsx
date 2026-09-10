"use client";

// Una carpeta del cliente, con sus dos interruptores.
//
// Cada interruptor es un formulario propio y no un botón con JavaScript: así
// cada cambio es un pedido entero al servidor, que valida y guarda, y la
// pantalla vuelve dibujada con lo que de verdad quedó guardado. Nada de estado
// optimista que después no coincida con el archivo.

import { useActionState, useState } from "react";
import Link from "next/link";
import { guardarCarpeta, pedirLinkDeCarpeta } from "@/app/(admin)/gestion/acciones";
import { LinkParaCompartir } from "@/admin/LinkParaCompartir";
import type { CarpetaEnGestion } from "@/admin/datos/carpetas";
import { ChatDeCarpeta } from "@/admin/ChatDeCarpeta";

export function FilaDeCarpeta({
  carpeta,
  clienteId,
}: {
  carpeta: CarpetaEnGestion;
  clienteId: string;
}) {
  const [estado, enviar, esperando] = useActionState(guardarCarpeta, null);
  const [token, setToken] = useState(carpeta.token ?? null);
  const [pidiendo, setPidiendo] = useState(false);

  const oculta = !carpeta.visible;

  /**
   * El link se genera cuando alguien lo pide y no antes.
   *
   * Una carpeta que nadie va a compartir por separado no necesita link, y
   * generarlos todos de entrada llenaría el archivo de tokens que no se usan.
   */
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
    <li
      className={`grid gap-4 border-b border-linea px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
        oculta ? "bg-hueco/40" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={`truncate text-guia font-bold tracking-tight ${
              oculta ? "text-apagado" : ""
            }`}
          >
            {carpeta.nombre}
          </h3>
          {oculta && (
            <span className="bg-tinta px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-lienzo">
              Oculta
            </span>
          )}
          {carpeta.vista === "calendario" && !oculta && (
            <span className="bg-acento-tenue px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-acento">
              Calendario
            </span>
          )}
        </div>

        <p className="mt-1 text-menudo text-apagado">
          {carpeta.piezas} {carpeta.piezas === 1 ? "pieza" : "piezas"}
          {carpeta.conVueltas > 0 && (
            <> · {carpeta.conVueltas} con más de una vuelta</>
          )}
          {carpeta.vista === "calendario" && (
            <> · {carpeta.conFecha} con fecha</>
          )}
          {carpeta.enlaceDrive && (
            <>
              {" · "}
              <a
                href={carpeta.enlaceDrive}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-tinta underline underline-offset-2"
              >
                abrir en Drive
              </a>
            </>
          )}
        </p>

        {estado && !estado.ok && (
          <p aria-live="polite" className="mt-2 text-menudo font-semibold text-alerta">
            {estado.motivo}
          </p>
        )}

        {/* El link de esta carpeta sola. Se entra con la misma clave del
            cliente: es el mismo cliente, mirando menos cosas. */}
        {!oculta &&
          (token ? (
            <div className="mt-3">
              <LinkParaCompartir token={token} etiqueta="Solo esta carpeta" />
            </div>
          ) : (
            <button
              type="button"
              onClick={pedirLink}
              disabled={pidiendo}
              className="mt-3 text-menudo font-semibold text-apagado underline underline-offset-2
                         transition-colors hover:text-tinta disabled:opacity-40"
            >
              {pidiendo ? "Generando…" : "Generar un link solo para esta carpeta"}
            </button>
          ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <ChatDeCarpeta
          carpetaId={carpeta.id}
          nombre={carpeta.nombre}
          cuantos={carpeta.mensajes}
        />

        {/* Mostrar u ocultar */}
        <form action={enviar}>
          <input type="hidden" name="carpetaId" value={carpeta.id} />
          <input type="hidden" name="nombre" value={carpeta.nombre} />
          <input type="hidden" name="vista" value={carpeta.vista} />
          <input type="hidden" name="visible" value={carpeta.visible ? "no" : "si"} />
          <button
            type="submit"
            disabled={esperando}
            className={`min-h-toque px-4 text-normal font-bold tracking-tight transition-colors disabled:opacity-40 ${
              carpeta.visible
                ? "border-2 border-tinta text-tinta hover:bg-hueco"
                : "bg-tinta text-lienzo hover:bg-tinta/90"
            }`}
          >
            {carpeta.visible ? "Ocultar" : "Mostrar"}
          </button>
        </form>

        {/* El calendario se arma en su propia pantalla: arrastrar piezas a los
            días necesita espacio, y meterlo en una fila sería pelearse con el
            lugar. */}
        {carpeta.vista === "calendario" && !oculta && (
          <Link
            href={`/gestion/cliente/${clienteId}/carpeta/${carpeta.id}`}
            className="inline-flex min-h-toque items-center bg-acento px-4 text-normal
                       font-bold tracking-tight text-white transition-colors hover:bg-acento-hover"
          >
            Armar calendario
          </Link>
        )}

        {/* Lista o calendario. Solo tiene sentido si el cliente la ve. */}
        <form action={enviar}>
          <input type="hidden" name="carpetaId" value={carpeta.id} />
          <input type="hidden" name="nombre" value={carpeta.nombre} />
          <input type="hidden" name="visible" value={carpeta.visible ? "si" : "no"} />
          <input
            type="hidden"
            name="vista"
            value={carpeta.vista === "calendario" ? "lista" : "calendario"}
          />
          <button
            type="submit"
            disabled={esperando || oculta}
            title={oculta ? "La carpeta está oculta para el cliente" : undefined}
            className="min-h-toque border-2 border-tinta px-4 text-normal font-bold tracking-tight
                       text-tinta transition-colors hover:bg-hueco disabled:opacity-40"
          >
            {carpeta.vista === "calendario" ? "Pasar a lista" : "Pasar a calendario"}
          </button>
        </form>
      </div>
    </li>
  );
}
