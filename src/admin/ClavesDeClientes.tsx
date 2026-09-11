"use client";

// Las claves con las que entran los clientes al portal.
//
// **Por qué viven acá y no en la ficha de cada cliente.** La clave no se toca
// nunca: se pone una vez, al dar de alta, y después se mira el día que alguien
// no puede entrar. Estaba arriba de todo en la configuración del cliente,
// delante de lo que sí se usa todos los días —quién lo lleva, cuántos días
// tiene para revisar, si el portal está prendido—, y lo empujaba hacia abajo.
//
// Juntas también se leen mejor: cuando hace falta una clave, el que la busca
// suele estar al teléfono con el cliente, y tenerlas todas en una lista es más
// rápido que abrir la ficha del cliente y bajar.
//
// De cada cliente se muestra **solo el nombre de la carpeta**. Es lo único que
// hace falta para saber cuál es, y no hay razón para repetir acá el resto.
//
// La clave sigue tapada y sigue pidiendo la contraseña del equipo para verse o
// cambiarse. Entrar a gestión ya la pidió una vez, pero esto es otra cosa: es
// que no quede escrita en pantalla para el que pasa por atrás, ni viaje al
// navegador hasta que alguien la pida.

import { useActionState } from "react";
import { ponerTagDeCliente, verClaveDeCliente } from "@/app/(admin)/gestion/acciones";
import { BOTON, CAMPO, ETIQUETA, TITULO } from "@/admin/estilos";

export type ClienteConClave = {
  id: string;
  nombre: string;
  tieneClave: boolean;
};

export function ClavesDeClientes({ clientes }: { clientes: ClienteConClave[] }) {
  if (clientes.length === 0) {
    return (
      <p className="mt-6 text-normal text-apagado">
        Todavía no hay ningún cliente. Aparecen solos cuando le compartís su
        carpeta de Drive al robot.
      </p>
    );
  }

  return (
    <ul className="mt-6 border-t border-linea">
      {clientes.map((cliente) => (
        <UnaClave key={cliente.id} cliente={cliente} />
      ))}
    </ul>
  );
}

function UnaClave({ cliente }: { cliente: ClienteConClave }) {
  const [estadoVer, verClave, viendo] = useActionState(verClaveDeCliente, null);
  const [estadoTag, guardarTag, guardando] = useActionState(ponerTagDeCliente, null);

  const revelada = estadoVer?.ok ? estadoVer.clave : null;
  const fallo = [estadoVer, estadoTag].find((r) => r && !r.ok);

  return (
    <li className="flex flex-col gap-2 border-b border-linea py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={TITULO}>{cliente.nombre}</h3>
        {!cliente.tieneClave && <span className={ETIQUETA}>falta</span>}
        {estadoTag?.ok && (
          <span className="text-micro font-extrabold uppercase tracking-wider text-acento">
            guardada
          </span>
        )}
      </div>

      {revelada === null ? (
        <form action={verClave} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <input
            name="contrasena"
            type="password"
            autoComplete="off"
            placeholder="contraseña del equipo"
            aria-label={`Contraseña para ver la clave de ${cliente.nombre}`}
            className={`${CAMPO} w-56`}
          />
          <button type="submit" disabled={viendo} className={BOTON}>
            Ver o cambiar
          </button>
        </form>
      ) : (
        <form action={guardarTag} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <input
            name="tag"
            type="text"
            defaultValue={revelada}
            autoComplete="off"
            aria-label={`Clave de ${cliente.nombre}`}
            className={`${CAMPO} min-w-48 flex-1`}
          />
          <input
            name="contrasena"
            type="password"
            autoComplete="off"
            placeholder="contraseña del equipo"
            aria-label="Contraseña del equipo"
            className={`${CAMPO} w-48`}
          />
          <button type="submit" disabled={guardando} className={BOTON}>
            Guardar
          </button>
        </form>
      )}

      {fallo && !fallo.ok && (
        <p aria-live="polite" className="text-menudo font-semibold text-alerta">
          {fallo.motivo}
        </p>
      )}
    </li>
  );
}
