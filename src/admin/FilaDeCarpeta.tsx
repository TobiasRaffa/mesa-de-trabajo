"use client";

// Una carpeta del cliente, con sus dos interruptores.
//
// Cada interruptor es un formulario propio y no un botón con JavaScript: así
// cada cambio es un pedido entero al servidor, que valida y guarda, y la
// pantalla vuelve dibujada con lo que de verdad quedó guardado. Nada de estado
// optimista que después no coincida con el archivo.

import { useActionState } from "react";
import { guardarCarpeta } from "@/app/(admin)/gestion/acciones";
import type { CarpetaEnGestion } from "@/admin/datos/carpetas";

export function FilaDeCarpeta({ carpeta }: { carpeta: CarpetaEnGestion }) {
  const [estado, enviar, esperando] = useActionState(guardarCarpeta, null);

  const oculta = !carpeta.visible;

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
      </div>

      <div className="flex flex-wrap gap-2">
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
