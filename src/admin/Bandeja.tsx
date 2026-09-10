"use client";

// La bandeja de avisos.
//
// Todo lo que hizo el cliente queda anotado acá, haya salido por correo o no.
// Esa separación es a propósito: que el correo no esté configurado, o que el
// proveedor se caiga, **no puede hacer que el aviso se pierda**.
//
// Por eso cada línea dice también si salió. Un aviso que quedó sin mandar no
// es un error escondido en un registro: se ve al lado del aviso.

import { useTransition } from "react";
import Link from "next/link";
import { marcarAvisosVistos } from "@/app/(admin)/gestion/acciones";
import type { Aviso } from "@/lib/avisos";

const cuando = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const COMO_SALIO: Record<Aviso["correo"], { texto: string; estilo: string } | null> = {
  enviado: { texto: "por correo", estilo: "text-apagado" },
  sin_configurar: null,
  sin_destinatario: { texto: "sin asignar", estilo: "text-espera" },
  fallo: { texto: "no salió el correo", estilo: "text-alerta" },
};

export function Bandeja({
  avisos,
  correoConfigurado,
}: {
  avisos: Aviso[];
  correoConfigurado: boolean;
}) {
  const [marcando, marcar] = useTransition();
  const sinVer = avisos.filter((a) => !a.visto).length;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-titulo font-extrabold tracking-tight">
          Novedades
          {sinVer > 0 && (
            <span className="ml-2 bg-acento px-2 py-0.5 align-middle text-micro font-extrabold text-white">
              {sinVer}
            </span>
          )}
        </h2>
        {sinVer > 0 && (
          <button
            type="button"
            onClick={() => marcar(() => marcarAvisosVistos())}
            disabled={marcando}
            className="min-h-toque border-2 border-tinta px-4 text-normal font-bold tracking-tight
                       text-tinta transition-colors hover:bg-hueco disabled:opacity-40"
          >
            {marcando ? "…" : "Marcar como visto"}
          </button>
        )}
      </div>

      {!correoConfigurado && (
        <p className="mt-3 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-menudo font-semibold text-espera">
          Sin correo configurado: los avisos quedan solo acá.
        </p>
      )}

      {avisos.length === 0 ? (
        <p className="mt-4 text-normal text-apagado">Todavía no pasó nada.</p>
      ) : (
        <ul className="mt-4 border-t border-linea">
          {avisos.map((aviso) => {
            const salida = COMO_SALIO[aviso.correo];
            return (
              <li
                key={aviso.id}
                className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-linea px-4 py-3 ${
                  aviso.visto ? "" : "bg-acento-tenue/30"
                }`}
              >
                {!aviso.visto && (
                  <span
                    aria-label="Sin ver"
                    className="h-2 w-2 shrink-0 self-center bg-acento"
                  />
                )}
                <span className="cifras shrink-0 text-menudo text-apagado">
                  {cuando.format(new Date(aviso.cuando))}
                </span>
                {/* Un mensaje se lee en Conversaciones; lo demás, en su carpeta. */}
                <Link
                  href={
                    aviso.clase === "escribio"
                      ? "/gestion/chats"
                      : `/gestion/cliente/${aviso.clienteId}/carpeta/${aviso.carpetaId}`
                  }
                  className="min-w-0 flex-1 text-normal underline-offset-4 hover:underline"
                >
                  {aviso.texto}
                </Link>
                {salida && (
                  <span className={`shrink-0 text-micro ${salida.estilo}`}>
                    {salida.texto}
                    {aviso.detalleDelCorreo && ` · ${aviso.detalleDelCorreo}`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
