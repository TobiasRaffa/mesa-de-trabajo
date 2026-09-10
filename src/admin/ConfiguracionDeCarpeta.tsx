"use client";

// Todo lo que se configura de una carpeta de trabajo.
//
// Mismo criterio que con el cliente: abrir la fila muestra qué hay adentro,
// esto muestra qué se puede cambiar.

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  guardarCarpeta,
  guardarQuienYCuando,
  pedirLinkDeCarpeta,
} from "@/app/(admin)/gestion/acciones";
import { LinkParaCompartir } from "@/admin/LinkParaCompartir";
import type { NodoCarpeta } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";

const CAMPO =
  "min-h-toque border border-linea bg-lienzo px-2 text-menudo font-bold " +
  "focus:border-acento focus:outline-none";

export function ConfiguracionDeCarpeta({
  carpeta,
  clienteId,
  equipo,
}: {
  carpeta: NodoCarpeta;
  clienteId: string;
  equipo: Persona[];
}) {
  const [estado, guardar, esperando] = useActionState(guardarCarpeta, null);
  const [estadoQuien, guardarQuien, guardandoQuien] = useActionState(
    guardarQuienYCuando,
    null
  );
  const [token, setToken] = useState(carpeta.token ?? null);
  const [pidiendo, setPidiendo] = useState(false);

  const oculta = !carpeta.visible;

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
    <div className="flex flex-col gap-5">
      {/* --------------------------- Qué ve el cliente ------------------- */}
      <section>
        <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
          Qué ve el cliente
        </h4>
        <div className="mt-2 flex flex-wrap gap-2">
          <form action={guardar}>
            <input type="hidden" name="carpetaId" value={carpeta.id} />
            <input type="hidden" name="nombre" value={carpeta.nombre} />
            <input type="hidden" name="vista" value={carpeta.vista} />
            <input type="hidden" name="visible" value={oculta ? "si" : "no"} />
            <button
              type="submit"
              disabled={esperando}
              className={`min-h-toque px-4 text-normal font-bold tracking-tight transition-colors
                          disabled:opacity-40 ${
                            oculta
                              ? "bg-tinta text-lienzo hover:bg-tinta/90"
                              : "border-2 border-tinta text-tinta hover:bg-hueco"
                          }`}
            >
              {oculta ? "Mostrar" : "Ocultar"}
            </button>
          </form>

          <form action={guardar}>
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

          {carpeta.vista === "calendario" && !oculta && (
            <Link
              href={`/gestion/cliente/${clienteId}/carpeta/${carpeta.id}`}
              className="inline-flex min-h-toque items-center bg-acento px-4 text-normal font-bold
                         tracking-tight text-white transition-colors hover:bg-acento-hover"
            >
              Armar calendario
            </Link>
          )}
        </div>
      </section>

      {/* ------------------------ Quién y hasta cuándo ------------------- */}
      <section>
        <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
          Quién lo lleva, y hasta cuándo
        </h4>
        <p className="mt-1 max-w-xl text-menudo text-tinta-suave">
          A quien lo lleva le llegan los avisos. El plazo es de toda la carpeta; una
          pieza suelta puede tener el suyo desde el calendario.
        </p>

        <form action={guardarQuien} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="carpetaId" value={carpeta.id} />

          <select
            name="asignada"
            defaultValue={carpeta.asignada ?? ""}
            aria-label="Quién lo lleva"
            className={CAMPO}
          >
            <option value="">sin asignar</option>
            {equipo.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.nombre}
              </option>
            ))}
          </select>

          <input
            name="vence"
            type="date"
            defaultValue={carpeta.vence ?? ""}
            aria-label="Hasta cuándo"
            className={CAMPO}
          />

          <button
            type="submit"
            disabled={guardandoQuien}
            className="min-h-toque border-2 border-tinta px-4 text-normal font-bold tracking-tight
                       text-tinta transition-colors hover:bg-hueco disabled:opacity-40"
          >
            Guardar
          </button>

          {equipo.length === 0 && (
            <span className="text-menudo text-espera">
              Cargá gente en «Equipo» para poder asignar.
            </span>
          )}
        </form>
      </section>

      {/* ------------------------- El link de la carpeta ----------------- */}
      {!oculta && (
        <section className="border-t border-linea-tenue pt-4">
          <h4 className="text-micro font-extrabold uppercase tracking-widest text-apagado">
            El link de esta carpeta sola
          </h4>
          <p className="mt-1 max-w-xl text-menudo text-tinta-suave">
            Muestra solo esta carpeta. Se entra con la misma clave del cliente.
          </p>
          <div className="mt-2">
            {token ? (
              <LinkParaCompartir token={token} etiqueta="Solo esta carpeta" />
            ) : (
              <button
                type="button"
                onClick={pedirLink}
                disabled={pidiendo}
                className="min-h-toque border-2 border-tinta px-4 text-menudo font-bold
                           text-tinta transition-colors hover:bg-hueco disabled:opacity-40"
              >
                {pidiendo ? "Generando…" : "Generar el link"}
              </button>
            )}
          </div>
        </section>
      )}

      {[estado, estadoQuien]
        .filter((r) => r && !r.ok)
        .map((r, i) => (
          <p key={i} aria-live="polite" className="text-menudo font-semibold text-alerta">
            {r && !r.ok ? r.motivo : ""}
          </p>
        ))}
    </div>
  );
}
