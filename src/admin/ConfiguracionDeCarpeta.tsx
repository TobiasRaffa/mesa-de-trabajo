"use client";

// Todo lo que se configura de una carpeta de trabajo.

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  guardarCarpeta,
  guardarQuienYCuando,
  pedirLinkDeCarpeta,
} from "@/app/(admin)/gestion/acciones";
import { LinkParaCompartir } from "@/admin/LinkParaCompartir";
import type { NodoCarpeta } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";

const TITULO = "text-micro font-extrabold uppercase tracking-widest text-apagado";

const CAMPO =
  "min-h-toque border border-linea bg-lienzo px-2 text-menudo font-bold " +
  "focus:border-acento focus:outline-none";

const BOTON =
  "min-h-toque border-2 border-tinta px-4 text-normal font-bold tracking-tight " +
  "text-tinta transition-colors hover:bg-hueco disabled:opacity-40";

/**
 * Dos botones que dicen qué está pasando, no qué va a pasar.
 *
 * Un solo botón que dice «Ocultar» obliga a deducir el estado actual de la
 * acción contraria. Con Sí y No, el estado se lee sin pensar.
 */
function SiONo({
  activo,
  esperando,
  campos,
  nombre,
  valorSi,
  valorNo,
}: {
  activo: boolean;
  esperando: boolean;
  campos: React.ReactNode;
  nombre: string;
  valorSi: string;
  valorNo: string;
}) {
  return (
    <div className="flex">
      {campos}
      <button
        type="submit"
        name={nombre}
        value={valorSi}
        disabled={esperando}
        aria-pressed={activo}
        className={`min-h-toque border-2 border-tinta px-5 text-normal font-bold tracking-tight
                    transition-colors disabled:opacity-40 ${
                      activo ? "bg-tinta text-lienzo" : "text-tinta hover:bg-hueco"
                    }`}
      >
        Sí
      </button>
      <button
        type="submit"
        name={nombre}
        value={valorNo}
        disabled={esperando}
        aria-pressed={!activo}
        className={`min-h-toque border-2 border-l-0 border-tinta px-5 text-normal font-bold
                    tracking-tight transition-colors disabled:opacity-40 ${
                      activo ? "text-tinta hover:bg-hueco" : "bg-tinta text-lienzo"
                    }`}
      >
        No
      </button>
    </div>
  );
}

export function ConfiguracionDeCarpeta({
  carpeta,
  clienteId,
  equipo,
  alGuardar,
}: {
  carpeta: NodoCarpeta;
  clienteId: string;
  equipo: Persona[];
  /** Se llama cuando algo se guardó, para que la fila de arriba se actualice. */
  alGuardar: () => void;
}) {
  const [estado, guardar, esperando] = useActionState(guardarCarpeta, null);
  const [estadoQuien, guardarQuien, guardandoQuien] = useActionState(
    guardarQuienYCuando,
    null
  );
  const [token, setToken] = useState(carpeta.token ?? null);
  const [pidiendo, setPidiendo] = useState(false);

  const oculta = !carpeta.visible;

  // Guardar cambia lo que dice la fila de arriba —«oculta», «calendario», quién
  // la lleva—. Sin esto, el cartel seguía mostrando lo viejo hasta cerrar y
  // volver a abrir, y parecía que el cambio no se había guardado.
  useEffect(() => {
    if (estado?.ok || estadoQuien?.ok) alGuardar();
  }, [estado, estadoQuien, alGuardar]);

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
    <div className="flex flex-col gap-6">
      {/* -------------------------- Mostrar en el portal ----------------- */}
      <section>
        <h4 className={TITULO}>Mostrar en el portal</h4>
        <form action={guardar} className="mt-2">
          <SiONo
            activo={carpeta.visible}
            esperando={esperando}
            nombre="visible"
            valorSi="si"
            valorNo="no"
            campos={
              <>
                <input type="hidden" name="carpetaId" value={carpeta.id} />
                <input type="hidden" name="nombre" value={carpeta.nombre} />
                <input type="hidden" name="vista" value={carpeta.vista} />
              </>
            }
          />
        </form>
      </section>

      {/* ------------------------------ Calendario ----------------------- */}
      <section>
        <h4 className={TITULO}>Verlo como calendario</h4>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <form action={guardar}>
            <SiONo
              activo={carpeta.vista === "calendario"}
              esperando={esperando || oculta}
              nombre="vista"
              valorSi="calendario"
              valorNo="lista"
              campos={
                <>
                  <input type="hidden" name="carpetaId" value={carpeta.id} />
                  <input type="hidden" name="nombre" value={carpeta.nombre} />
                  <input
                    type="hidden"
                    name="visible"
                    value={carpeta.visible ? "si" : "no"}
                  />
                </>
              }
            />
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
        <h4 className={TITULO}>Quién lo lleva, y hasta cuándo</h4>
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

          <button type="submit" disabled={guardandoQuien} className={BOTON}>
            Guardar
          </button>

          {equipo.length === 0 && (
            <span className="text-menudo text-espera">Cargá gente en «Equipo».</span>
          )}
        </form>
      </section>

      {/* ------------------------- El link de la carpeta ----------------- */}
      {!oculta && (
        <section>
          <h4 className={TITULO}>Link de esta carpeta sola</h4>
          <div className="mt-2">
            {token ? (
              <LinkParaCompartir token={token} etiqueta="Solo esta carpeta" />
            ) : (
              <button
                type="button"
                onClick={pedirLink}
                disabled={pidiendo}
                className={BOTON}
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
