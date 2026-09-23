"use client";

// Las claves con las que entran los clientes al portal.
//
// **Por qué viven acá y no en la ficha de cada cliente.** La clave no se toca
// nunca: se pone una vez, al dar de alta, y después se mira el día que alguien
// no puede entrar. Estaba arriba de todo en la configuración del cliente,
// delante de lo que sí se usa todos los días, y lo empujaba hacia abajo.
//
// Juntas también se buscan mejor: cuando hace falta una clave, el que la busca
// suele estar al teléfono con el cliente.
//
// **La clave no está escrita en la pantalla.** No es que esté tapada con
// puntitos: el texto no sale del servidor hasta que alguien lo pide con la
// contraseña del equipo. Lo que no se manda no queda en la pantalla para el
// que pasa por atrás, ni en la memoria del navegador.
//
// Son dos botones y no uno porque son dos cosas distintas: **ver** es para
// leérsela por teléfono a alguien que no puede entrar, y **cambiar** es dejar
// afuera a quien tenga la vieja. Un solo botón que hiciera las dos obligaría a
// abrir un campo de edición cada vez que solo se quería mirar.

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { ponerTagDeCliente, verClaveDeCliente } from "@/app/(admin)/gestion/acciones";
import { BOTON, CAMPO, ETIQUETA, TITULO } from "@/admin/estilos";

export type ClienteConClave = {
  id: string;
  nombre: string;
  /** Si tiene una puesta. El texto **no** viaja hasta que alguien lo pide. */
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

type Modo = null | "ver" | "cambiar";

type Resultado = { ok: boolean; motivo?: string } | null;

/**
 * El error que corresponde a lo que está abierto, si es nuevo.
 *
 * **Se mostraba el primero que hubiera, y «Ver» iba primero.** Un «Esa
 * contraseña no es la tuya» de antes quedaba pegado y tapaba el motivo real de
 * «Cambiar»: la persona reescribía su contraseña sin enterarse de que lo que
 * fallaba era la clave nueva. Lo que ya estaba al cerrar se da por visto.
 */
export function falloAMostrar(
  modo: Modo,
  ver: Resultado,
  tag: Resultado,
  vistos: { ver: Resultado; tag: Resultado }
): string | null {
  const [actual, visto] =
    modo === "ver" ? [ver, vistos.ver] : modo === "cambiar" ? [tag, vistos.tag] : [null, null];
  if (!actual || actual.ok || actual === visto) return null;
  return actual.motivo ?? null;
}

function UnaClave({ cliente }: { cliente: ClienteConClave }) {
  const [modo, setModo] = useState<Modo>(null);
  const [estadoVer, verClave, viendo] = useActionState(verClaveDeCliente, null);
  const [estadoTag, guardarTag, guardando] = useActionState(ponerTagDeCliente, null);

  // **Lo revelado se olvida al cerrar.** Salía directo del estado de la
  // acción, que sobrevive a cerrar el panel: se apretaba «Cerrar» y después
  // «Ver» otra vez, y la clave aparecía sin pedir la contraseña. Quien se
  // levanta de la silla con la pantalla abierta deja esa puerta abierta.
  const [revelada, setRevelada] = useState<string | null>(null);
  const [atendida, setAtendida] = useState(estadoVer);
  const [vistos, setVistos] = useState<{ ver: Resultado; tag: Resultado }>({
    ver: null,
    tag: null,
  });
  const fallo = falloAMostrar(modo, estadoVer, estadoTag, vistos);

  if (estadoVer !== atendida) {
    setAtendida(estadoVer);
    if (estadoVer?.ok) setRevelada(estadoVer.clave);
  }

  function cerrar() {
    setModo(null);
    setRevelada(null);
    setVistos({ ver: estadoVer, tag: estadoTag });
  }

  // **La clave nueva se manda a mano y no con `action`.** React vacía todo
  // formulario que se manda con `action`, salga bien o mal: con un error, la
  // clave nueva y la contraseña desaparecían debajo del mensaje que decía qué
  // corregir. Se vacía solo cuando se guardó, que es cuando ya no hace falta.
  const formularioTag = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estadoTag?.ok) formularioTag.current?.reset();
  }, [estadoTag]);

  return (
    <li className="flex flex-col gap-2 border-b border-linea py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={`${TITULO} min-w-0 flex-1`}>{cliente.nombre}</h3>

        {/* **Sin clave no entra nadie**, ni con el link correcto. Se dibujaba
            con `ETIQUETA` —gris menudo en mayúsculas—, el mismo estilo que usa
            «heredado» para un detalle sin consecuencia. */}
        {!cliente.tieneClave && (
          <span className={`${ETIQUETA} text-alerta`}>sin clave: no entra nadie</span>
        )}

        {estadoTag?.ok && (
          <span className="text-micro font-extrabold uppercase tracking-wider text-acento">
            guardada
          </span>
        )}

        {modo === null && (
          <>
            <button type="button" onClick={() => setModo("ver")} className={BOTON}>
              Ver
            </button>
            <button type="button" onClick={() => setModo("cambiar")} className={BOTON}>
              Cambiar
            </button>
          </>
        )}

        {modo !== null && (
          <button type="button" onClick={cerrar} className={BOTON}>
            Cerrar
          </button>
        )}
      </div>

      {/* ------------------------------- Ver ----------------------------- */}
      {modo === "ver" &&
        (revelada === null ? (
          <form action={verClave} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="clienteId" value={cliente.id} />
            <input
              name="contrasena"
              type="password"
              autoFocus
              autoComplete="off"
              placeholder="tu contraseña"
              aria-label={`Tu contraseña, para ver la clave de ${cliente.nombre}`}
              className={`${CAMPO} w-56`}
            />
            <button type="submit" disabled={viendo} className={BOTON}>
              {viendo ? "…" : "Mostrar"}
            </button>
          </form>
        ) : (
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-micro font-extrabold uppercase tracking-wider text-apagado">
              La clave es
            </span>
            {/* Con la misma letra que el resto. En letra de máquina de
                escribir se lee como un código y no como lo que es: una palabra
                que alguien va a decir en voz alta por teléfono. */}
            <span className="bg-hueco px-2 py-1 text-guia font-bold tracking-tight">
              {revelada || "(todavía no tiene)"}
            </span>
          </p>
        ))}

      {/* ----------------------------- Cambiar --------------------------- */}
      {modo === "cambiar" && (
        <form
          ref={formularioTag}
          onSubmit={(e) => {
            e.preventDefault();
            const datos = new FormData(e.currentTarget);
            startTransition(() => guardarTag(datos));
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="clienteId" value={cliente.id} />
          <input
            name="tag"
            type="text"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="la clave nueva"
            aria-label={`Clave nueva de ${cliente.nombre}`}
            className={`${CAMPO} min-w-44 flex-1`}
          />
          <input
            name="contrasena"
            type="password"
            autoComplete="off"
            placeholder="tu contraseña"
            aria-label="Tu contraseña"
            className={`${CAMPO} w-48`}
          />
          <button type="submit" disabled={guardando} className={BOTON}>
            {guardando ? "…" : "Guardar"}
          </button>
        </form>
      )}

      {modo === "cambiar" && (
        <p className="text-menudo text-apagado">
          Quien tenga la clave vieja deja de entrar. Avisale al cliente antes.
        </p>
      )}

      {fallo && (
        <p aria-live="polite" className="text-menudo font-semibold text-alerta">
          {fallo}
        </p>
      )}
    </li>
  );
}
