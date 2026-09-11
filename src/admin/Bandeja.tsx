"use client";

// La bandeja de avisos.
//
// Todo lo que hizo el cliente queda anotado acá, haya salido por correo o no.
// Esa separación es a propósito: que el correo no esté configurado, o que el
// proveedor se caiga, **no puede hacer que el aviso se pierda**.
//
// Por eso cada línea dice también si salió y a quién. Un aviso que quedó sin
// mandar no es un error escondido en un registro: se ve al lado del aviso.
//
// **Se abre y se cierra, y abrirla las marca leídas.** Antes había que apretar
// «Marcar como visto» a mano, que es pedirle a alguien que declare algo que la
// aplicación ya sabe: si abriste la lista, las viste. Cerrada muestra cuántas
// hay sin leer, que es lo único que hace falta saber de un vistazo.
//
// Lo que estaba sin leer **al abrir la pantalla** se sigue marcando en la lista
// aunque ya se hayan dado por leídas. Si no, abrir la bandeja las volvería
// todas iguales en el mismo instante y no habría forma de ver cuáles eran las
// nuevas, que es justamente para lo que se abrió.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { marcarAvisosVistos } from "@/app/(admin)/gestion/acciones";
import { IconoFlecha } from "@/ui/Icono";
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

/** A quién le tocaba, sea uno o varios. */
function aQuienes(aviso: Aviso): string[] {
  if (aviso.paraQuienes?.length) return aviso.paraQuienes;
  return aviso.paraQuien ? [aviso.paraQuien] : [];
}

export function Bandeja({
  avisos,
  correoConfigurado,
}: {
  avisos: Aviso[];
  correoConfigurado: boolean;
}) {
  const sinVer = avisos.filter((a) => !a.visto).length;

  // Cuáles eran nuevas cuando se abrió la pantalla.
  //
  // Se calcula **una sola vez**, al montar, y por eso va en un `useState` con
  // función y no en un `useMemo`: no depende de nada que pueda cambiar, y es
  // justamente lo que permite que sigan marcadas después de darlas por leídas.
  const [eranNuevas] = useState(
    () => new Set(avisos.filter((a) => !a.visto).map((a) => a.id))
  );

  // Arranca abierta cuando hay algo nuevo. Si está todo leído, la novedad es
  // que no hay novedades, y para eso alcanza el título.
  const [abierta, setAbierta] = useState(sinVer > 0);
  const [, marcar] = useTransition();

  useEffect(() => {
    if (abierta && sinVer > 0) marcar(() => marcarAvisosVistos());
  }, [abierta, sinVer]);

  return (
    <section className="mt-10">
      <h2 className="text-titulo font-extrabold tracking-tight">
        <button
          type="button"
          onClick={() => setAbierta((a) => !a)}
          aria-expanded={abierta}
          className="flex w-full items-center gap-3 py-1 text-left transition-colors
                     hover:text-acento focus-visible:outline-2 focus-visible:outline-acento"
        >
          <span
            aria-hidden="true"
            className={`shrink-0 transition-transform ${abierta ? "rotate-90" : ""}`}
          >
            <IconoFlecha />
          </span>
          Novedades
          {sinVer > 0 && (
            <span className="bg-acento px-2 py-0.5 text-micro font-extrabold text-white">
              {sinVer} {sinVer === 1 ? "nueva" : "nuevas"}
            </span>
          )}
          {sinVer === 0 && avisos.length > 0 && (
            <span className="text-menudo font-normal text-apagado">
              {avisos.length}
            </span>
          )}
        </button>
      </h2>

      {!abierta ? null : (
        <>
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
                const nueva = eranNuevas.has(aviso.id);
                const quienes = aQuienes(aviso);

                return (
                  <li
                    key={aviso.id}
                    className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-linea px-4 py-3 ${
                      nueva ? "bg-acento-tenue/30" : ""
                    }`}
                  >
                    {nueva && (
                      <span
                        aria-label="Nueva"
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
                    {quienes.length > 0 && (
                      <span className="shrink-0 text-micro text-apagado">
                        para {quienes.join(", ")}
                      </span>
                    )}
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
        </>
      )}
    </section>
  );
}
