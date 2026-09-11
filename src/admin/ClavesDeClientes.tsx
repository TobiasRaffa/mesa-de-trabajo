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
// hace falta para saber cuál es.
//
// **Se ven escritas, sin pedir nada.** Durante un tiempo había que volver a
// escribir la contraseña del equipo para verlas: entrar a gestión ya la pide
// una vez, y era la misma, así que lo único que agregaba era fastidio. Quién
// puede ver una clave va a ser cuestión de roles, cuando existan los usuarios.

import { useActionState } from "react";
import { ponerTagDeCliente } from "@/app/(admin)/gestion/acciones";
import { BOTON, CAMPO, ETIQUETA, TITULO } from "@/admin/estilos";

export type ClienteConClave = {
  id: string;
  nombre: string;
  clave: string;
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
  const [estado, guardar, guardando] = useActionState(ponerTagDeCliente, null);

  return (
    <li className="flex flex-col gap-2 border-b border-linea py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={TITULO}>{cliente.nombre}</h3>
        {!cliente.clave && <span className={ETIQUETA}>falta</span>}
        {estado?.ok && (
          <span className="text-micro font-extrabold uppercase tracking-wider text-acento">
            guardada
          </span>
        )}
      </div>

      <form action={guardar} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="clienteId" value={cliente.id} />
        <input
          name="tag"
          type="text"
          // `key` con la clave guardada: si no, después de cambiarla React
          // reusa el campo y sigue mostrando lo que había escrito antes.
          key={cliente.clave}
          defaultValue={cliente.clave}
          autoComplete="off"
          spellCheck={false}
          placeholder="todavía no tiene"
          aria-label={`Clave de ${cliente.nombre}`}
          className={`${CAMPO} min-w-48 flex-1`}
        />
        <button type="submit" disabled={guardando} className={BOTON}>
          {guardando ? "…" : "Guardar"}
        </button>
      </form>

      {estado && !estado.ok && (
        <p aria-live="polite" className="text-menudo font-semibold text-alerta">
          {estado.motivo}
        </p>
      )}
    </li>
  );
}
