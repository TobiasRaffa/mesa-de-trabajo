"use client";

// Lo que se configura de un cliente, todos los días.
//
// **La clave no está acá**: vive en Admin. Es un dato que se pone una vez y
// después se mira el día que alguien no puede entrar, y estando arriba de todo
// empujaba hacia abajo lo que sí se usa seguido —quién lo lleva, cuántos días
// tiene para revisar, si el portal está prendido—.

import { startTransition, useActionState, useEffect } from "react";
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
import { Interruptor } from "@/ui/Interruptor";

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

  /** Manda un sí o un no a la acción de servidor, como lo mandaba el formulario. */
  function poner(accion: (datos: FormData) => void, campo: string, si: boolean) {
    const datos = new FormData();
    datos.set("clienteId", cliente.id);
    datos.set(campo, si ? "si" : "no");
    startTransition(() => accion(datos));
  }

  return (
    <div className="flex flex-col divide-y divide-linea">
      {!apagado && (
        <Renglon titulo="Link del portal">
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
        </Renglon>
      )}

      <Renglon titulo="Quién lo lleva">
        <Responsable
          nivel="cliente"
          id={cliente.id}
          quien={cliente.responsable}
          equipo={equipo}
          alGuardar={alGuardar}
        />
      </Renglon>

      <Renglon titulo="Tiempo de revisión">
        <DiasDeRevision nivel="cliente" id={cliente.id} dias={cliente.dias} alGuardar={alGuardar} />
      </Renglon>

      <Renglon titulo="Teléfono">
        {/* **Se manda a mano y no con `action`.** React vacía todo formulario
            que se manda con `action`, salga bien o mal: con un error, el
            teléfono que se estaba corrigiendo volvía al viejo debajo del
            mensaje que decía qué estaba mal. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const datos = new FormData(e.currentTarget);
            startTransition(() => guardarTel(datos));
          }}
          className="flex gap-2"
        >
          <input type="hidden" name="clienteId" value={cliente.id} />
          <input
            type="tel"
            name="telefono"
            defaultValue={cliente.telefono}
            aria-label="Teléfono del cliente"
            className="h-8 w-44 border border-linea bg-lienzo px-2 text-menudo
                       focus:border-acento focus:outline-none"
          />
          <button
            type="submit"
            disabled={guardandoTel}
            className="h-8 rounded-full border-2 border-tinta px-3 text-menudo font-bold
                       tracking-tight text-tinta transition-colors hover:bg-hueco disabled:opacity-40"
          >
            {guardandoTel ? "…" : "Guardar"}
          </button>
        </form>
      </Renglon>

      <Renglon titulo="Mostrar links a Drive">
        <Interruptor
          encendido={cliente.verEnDrive}
          deshabilitado={cambiandoDrive}
          onCambiar={(si) => poner(verDrive, "verEnDrive", si)}
          etiqueta="Mostrar links a Drive"
        />
      </Renglon>

      <Renglon titulo="Acceso al portal">
        <Interruptor
          encendido={!apagado}
          deshabilitado={esperando}
          onCambiar={(si) => poner(guardar, "habilitado", si)}
          etiqueta="Acceso al portal"
        />
      </Renglon>

      {[estado, estadoLink, estadoDrive, estadoTel]
        .filter((r) => r && !r.ok)
        .map((r, i) => (
          <p key={i} aria-live="polite" className="py-2 text-menudo font-semibold text-alerta">
            {r && !r.ok ? r.motivo : ""}
          </p>
        ))}
    </div>
  );
}

/** Un renglón del panel: el nombre de la opción a la izquierda, el control a la derecha. */
function Renglon({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 first:pt-0">
      <h4 className={TITULO}>{titulo}</h4>
      <div className="flex min-w-0 justify-end">{children}</div>
    </section>
  );
}
