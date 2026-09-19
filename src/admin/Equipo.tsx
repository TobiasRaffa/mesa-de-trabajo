"use client";

// Quién es del equipo, y a qué parte entra cada uno.
//
// **Dar de alta es un correo y un rol.** No se pide nombre ni contraseña: el
// nombre sale del correo y lo corrige esa persona cuando entra, y la
// contraseña la elige ella la primera vez. Nunca pasa por acá, así que quien
// da de alta no puede saberla ni por accidente.
//
// Los campos no se pueden escribir de una: hay que apretar **Editar**. Una
// lista de campos abiertos invita a cambiar algo sin querer al pasar el mouse,
// y acá lo que se cambia es a dónde le llegan los avisos a alguien y a qué
// partes de la aplicación entra.
//
// Cada fila es un formulario suelto: se guarda una persona sin tocar las
// demás, y un error de una no borra lo que se estaba escribiendo en otra.

import { useActionState, useState } from "react";
import {
  cambiarAccesos,
  darDeAlta,
  editarDelEquipo,
  generarCodigoDeAlta,
  quitarDelEquipo,
  reiniciarClaveDePersona,
} from "@/app/(admin)/gestion/acciones";
import type { Persona } from "@/lib/equipo";
import {
  laDaElRol,
  NOMBRE_DE_ROL,
  NOMBRE_DE_SECCION,
  QUE_HAY_EN,
  ROL_PERSONALIZADO,
  ROLES,
  SECCIONES,
  seccionesDe,
  type Rol,
} from "@/dominio/roles";

/** Un cliente, como lo necesita esta pantalla: para nombrarlo y tildarlo. */
export type ClienteParaElegir = { id: string; nombre: string };

const CAMPO =
  "min-w-0 flex-1 border border-linea bg-lienzo px-3 py-2 text-normal transition-colors " +
  "placeholder:text-apagado focus:border-acento focus:outline-none";

const BOTON =
  "shrink-0 min-h-toque border-2 border-tinta px-4 text-normal font-bold tracking-tight " +
  "text-tinta transition-colors hover:bg-hueco disabled:opacity-40";

const MARCA = "mt-1 text-micro font-extrabold uppercase tracking-wider";

export function FilaDePersona({
  persona,
  tieneClave,
  codigoDeAlta,
  pidioOtraClave,
  clientes,
}: {
  persona: Persona;
  /** Si ya eligió su contraseña. Sin ella existe en la lista pero no entró nunca. */
  tieneClave: boolean;
  /**
   * Con qué entra la primera vez, ya legible. `null` si tiene contraseña —no
   * hace falta— o si se dio de alta antes de que existieran los códigos.
   */
  codigoDeAlta: string | null;
  /** Dijo que no puede entrar y está esperando que se la reinicien. */
  pidioOtraClave: boolean;
  /** Todos los que hay, para poder elegir a cuáles llega. */
  clientes: ClienteParaElegir[];
}) {
  const [editando, setEditando] = useState(false);
  const [estado, guardar, guardando] = useActionState(editarDelEquipo, null);
  const [estadoQuitar, quitar, quitando] = useActionState(quitarDelEquipo, null);

  const suyas = seccionesDe(persona.rol, persona.sueltas);

  if (!editando) {
    return (
      <li className="flex flex-wrap items-center gap-3 border-b border-linea px-4 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold tracking-tight">
            {persona.nombre}
            <span className="ml-2 border border-linea px-1.5 py-0.5 text-micro font-extrabold uppercase tracking-wider text-apagado">
              {NOMBRE_DE_ROL[persona.rol]}
            </span>
          </p>
          <p className="mt-0.5 text-menudo text-apagado">
            {persona.correo || "sin correo"}
            {persona.enDrive && ` · en Drive: ${persona.enDrive}`}
            {persona.avisaDeTodo && " · recibe todos los avisos"}
          </p>
          {/* Qué ve en concreto. El rol es un nombre; esto es lo que el nombre
              quiere decir, que es lo que hay que poder mirar de un vistazo. */}
          <p className="mt-0.5 text-menudo text-apagado">
            Entra a: {suyas.map((s) => NOMBRE_DE_SECCION[s]).join(", ")}
          </p>
          <p className="mt-0.5 text-menudo text-apagado">
            Clientes: {comoSeLee(persona.clientes, clientes)}
          </p>

          {/* **Todavía no eligió contraseña.** Existe en la lista, se le asigna
              trabajo y le llegan los avisos, pero nunca entró. Decirlo acá
              evita el «no me deja entrar» de mañana, y de paso se ve si una
              cuenta quedó abierta sin que la reclame su dueña. */}
          {!tieneClave && (
            <p className={`${MARCA} text-espera`}>
              todavía no entró: elige su contraseña la primera vez
            </p>
          )}
          {!tieneClave && <CodigoDeAlta persona={persona} codigo={codigoDeAlta} />}
          {pidioOtraClave && (
            <p className={`${MARCA} text-alerta`}>
              pidió que le reinicien la contraseña
            </p>
          )}
        </div>
        <button type="button" onClick={() => setEditando(true)} className={BOTON}>
          Editar
        </button>
      </li>
    );
  }

  return (
    <li className="border-b border-linea px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <form action={guardar} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={persona.id} />
          <input
            name="nombre"
            defaultValue={persona.nombre}
            aria-label="Nombre"
            className={CAMPO}
          />
          <input
            name="correo"
            type="email"
            defaultValue={persona.correo}
            placeholder="correo"
            aria-label="Correo"
            className={CAMPO}
          />
          {/* Cómo la muestra Google cuando comenta encima de un archivo. Es lo
              que hace que sus notas en Drive no entren a la lista de cambios
              del cliente. Vacío se usa el nombre de acá al lado. */}
          <input
            name="enDrive"
            defaultValue={persona.enDrive ?? ""}
            placeholder="cómo aparece en Drive"
            aria-label="Cómo aparece en Drive"
            className={CAMPO}
          />
          <label className="flex items-center gap-2 text-menudo font-semibold">
            <input
              type="checkbox"
              name="avisaDeTodo"
              value="si"
              defaultChecked={persona.avisaDeTodo}
              className="h-4 w-4 accent-[var(--color-acento)]"
            />
            Recibe todo
          </label>
          <button type="submit" disabled={guardando} className={BOTON}>
            Guardar
          </button>
        </form>

        <button type="button" onClick={() => setEditando(false)} className={BOTON}>
          Cancelar
        </button>

        <Contrasena persona={persona} tieneClave={tieneClave} pidioOtraClave={pidioOtraClave} />

        <form action={quitar}>
          <input type="hidden" name="id" value={persona.id} />
          <button
            type="submit"
            disabled={quitando}
            className="min-h-toque px-3 text-menudo font-semibold text-apagado underline
                       underline-offset-2 transition-colors hover:text-alerta disabled:opacity-40"
          >
            Quitar
          </button>
        </form>
      </div>

      <Accesos persona={persona} clientes={clientes} />

      {[estado, estadoQuitar]
        .filter((r) => r && !r.ok)
        .map((r, i) => (
          <p key={i} aria-live="polite" className="mt-2 text-menudo font-semibold text-alerta">
            {r && !r.ok ? r.motivo : ""}
          </p>
        ))}
    </li>
  );
}

/**
 * A qué partes entra: el rol, y lo que se le da aparte.
 *
 * **Lo que da el rol se muestra tildado y no se puede destildar.** Las sueltas
 * suman y nunca restan: para quitarle algo a alguien se le cambia el rol, que
 * es la decisión que de verdad se está tomando. Una casilla que parece que
 * quita y no quita es peor que no tenerla.
 */
function Accesos({
  persona,
  clientes,
}: {
  persona: Persona;
  clientes: ClienteParaElegir[];
}) {
  const [estado, guardar, guardando] = useActionState(cambiarAccesos, null);
  const [rol, setRol] = useState<Rol>(persona.rol);
  const [todos, setTodos] = useState(persona.clientes === "todos");

  return (
    <form action={guardar} className="mt-4 border-t border-linea pt-4">
      <input type="hidden" name="id" value={persona.id} />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-menudo font-semibold">
          Rol
          <select
            name="rol"
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            className="border border-linea bg-lienzo px-2 py-2 text-normal"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {NOMBRE_DE_ROL[r]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={guardando} className={BOTON}>
          {guardando ? "…" : "Guardar accesos"}
        </button>
        {rol === ROL_PERSONALIZADO && (
          <span className="text-menudo text-apagado">
            Se tilda una por una, y es solo de esta persona.
          </span>
        )}
      </div>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {SECCIONES.map((seccion) => {
          const delRol = laDaElRol(rol, seccion);
          return (
            <li key={seccion}>
              <label className="flex items-start gap-2 text-menudo">
                {/* La que da el rol se dibuja aparte: puesta, apagada y **sin
                    nombre**, así no viaja como suelta. Guardarla también como
                    suelta dejaría la marca pegada el día que se le cambie el
                    rol, y alguien seguiría entrando a una sección que creímos
                    haberle sacado. La `key` distinta obliga a rehacer el campo
                    al cambiar el rol, en vez de reusar el de antes. */}
                {delRol ? (
                  <input
                    key="del-rol"
                    type="checkbox"
                    checked
                    readOnly
                    disabled
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-acento)]"
                  />
                ) : (
                  <input
                    key="suelta"
                    type="checkbox"
                    name="sueltas"
                    value={seccion}
                    defaultChecked={persona.sueltas.includes(seccion)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-acento)]"
                  />
                )}
                <span className="min-w-0">
                  <span className="font-semibold">{NOMBRE_DE_SECCION[seccion]}</span>
                  {delRol && (
                    <span className="ml-1 text-micro uppercase tracking-wider text-apagado">
                      la da el rol
                    </span>
                  )}
                  <span className="block text-micro text-apagado">{QUE_HAY_EN[seccion]}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {/* **A qué clientes llega, aparte del rol.** Son dos cosas distintas: el
          rol dice a qué *partes* de la aplicación entra, esto a *cuáles*
          clientes. Quien lleva una sola cuenta no tiene por qué abrir el árbol
          y encontrarse con las otras ocho. */}
      <fieldset className="mt-4 border-t border-linea pt-4">
        <legend className="text-micro font-extrabold uppercase tracking-widest text-apagado">
          Clientes
        </legend>

        <label className="mt-2 flex items-center gap-2 text-menudo font-semibold">
          <input
            type="radio"
            name="alcance"
            value="todos"
            checked={todos}
            onChange={() => setTodos(true)}
            className="h-4 w-4 accent-[var(--color-acento)]"
          />
          Todos
          <span className="font-normal text-apagado">
            — también los que se den de alta más adelante
          </span>
        </label>

        <label className="mt-1 flex items-center gap-2 text-menudo font-semibold">
          <input
            type="radio"
            name="alcance"
            value="estos"
            checked={!todos}
            onChange={() => setTodos(false)}
            className="h-4 w-4 accent-[var(--color-acento)]"
          />
          Solo estos
        </label>

        {!todos && (
          <ul className="mt-2 grid gap-1.5 pl-6 sm:grid-cols-2">
            {clientes.length === 0 ? (
              <li className="text-menudo text-apagado">Todavía no hay clientes.</li>
            ) : (
              clientes.map((c) => (
                <li key={c.id}>
                  <label className="flex items-center gap-2 text-menudo">
                    <input
                      type="checkbox"
                      name="cliente"
                      value={c.id}
                      defaultChecked={
                        persona.clientes !== "todos" && persona.clientes.includes(c.id)
                      }
                      className="h-4 w-4 shrink-0 accent-[var(--color-acento)]"
                    />
                    <span className="min-w-0 truncate">{c.nombre}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        )}
      </fieldset>

      {estado && !estado.ok && (
        <p aria-live="polite" className="mt-2 text-menudo font-semibold text-alerta">
          {estado.motivo}
        </p>
      )}
    </form>
  );
}

/**
 * A qué clientes llega, en palabras.
 *
 * Se nombran hasta tres y después se cuenta: una fila con once nombres pegados
 * deja de leerse, y lo que hay que ver de un vistazo es si son todos o algunos.
 */
function comoSeLee(alcance: Persona["clientes"], clientes: ClienteParaElegir[]): string {
  if (alcance === "todos") return "todos";
  if (alcance.length === 0) return "ninguno";

  const nombres = alcance.map((id) => clientes.find((c) => c.id === id)?.nombre ?? id);
  return nombres.length <= 3
    ? nombres.join(", ")
    : `${nombres.slice(0, 3).join(", ")} y ${nombres.length - 3} más`;
}

/**
 * Reiniciarle la contraseña a alguien.
 *
 * **No hay forma de ponerle una.** Antes sí, y era la misma cosa que decir que
 * cualquiera de Admin podía entrar como cualquiera. Esto le saca la que tenía:
 * queda como recién dada de alta y elige una nueva la próxima vez que entre.
 * Se le avisa por donde se le habla siempre; acá no hay correo que mandar.
 */
function Contrasena({
  persona,
  tieneClave,
  pidioOtraClave,
}: {
  persona: Persona;
  tieneClave: boolean;
  pidioOtraClave: boolean;
}) {
  const [estado, reiniciar, yendo] = useActionState(reiniciarClaveDePersona, null);

  if (!tieneClave) {
    return (
      <span className="text-menudo font-semibold text-espera">
        todavía no eligió su contraseña
      </span>
    );
  }

  return (
    <form action={reiniciar} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={persona.id} />
      <button
        type="submit"
        disabled={yendo}
        className={pidioOtraClave ? `${BOTON} border-alerta text-alerta` : BOTON}
      >
        {yendo ? "…" : "Reiniciar contraseña"}
      </button>
      {estado && (
        <span
          aria-live="polite"
          className={`text-menudo font-semibold ${estado.ok ? "text-acento" : "text-alerta"}`}
        >
          {estado.ok ? "Lista: elige una nueva con el código de alta que aparece en su fila." : estado.motivo}
        </span>
      )}
    </form>
  );
}

/**
 * El código con el que alguien entra la primera vez.
 *
 * Se muestra en la fila, y no escondido detrás de «Editar»: es lo primero que
 * quien administra necesita después de dar de alta a alguien. Si la persona
 * es de antes de que hubiera códigos, acá está el botón para darle uno.
 */
function CodigoDeAlta({ persona, codigo }: { persona: Persona; codigo: string | null }) {
  const [estado, generar, generando] = useActionState(generarCodigoDeAlta, null);

  if (codigo) {
    return (
      <p className="mt-1 flex flex-wrap items-baseline gap-2 text-menudo">
        <span className="text-micro font-extrabold uppercase tracking-wider text-apagado">
          código de alta
        </span>
        <span className="cifras bg-hueco px-2 py-0.5 font-bold tracking-wide">{codigo}</span>
        <span className="text-apagado">lo escribe con su correo la primera vez</span>
      </p>
    );
  }

  return (
    <form action={generar} className="mt-1 flex flex-wrap items-center gap-2 text-menudo">
      <input type="hidden" name="id" value={persona.id} />
      <span className="text-apagado">Sin código de alta: no puede elegir su contraseña.</span>
      <button
        type="submit"
        disabled={generando}
        className="font-semibold text-acento underline underline-offset-2 disabled:opacity-40"
      >
        {generando ? "…" : "Generar código"}
      </button>
      {estado && !estado.ok && <span className="font-semibold text-alerta">{estado.motivo}</span>}
    </form>
  );
}

export function SumarPersona() {
  const [abierto, setAbierto] = useState(false);
  const [estado, sumar, sumando] = useActionState(darDeAlta, null);
  // El rol se mira mientras se elige: con «Personalizado» aparecen las
  // secciones para tildar acá mismo.
  const [rol, setRol] = useState<Rol>("diseno");

  if (!abierto) {
    return (
      <div className="mt-8 border-t-2 border-tinta pt-6">
        <button type="button" onClick={() => setAbierto(true)} className={BOTON}>
          Dar de alta a alguien
        </button>
      </div>
    );
  }

  return (
    <section className="mt-8 border-t-2 border-tinta pt-6">
      <p className="text-menudo text-apagado">
        Su nombre, su correo y qué rol tiene. Al darla de alta aparece su código
        de alta en la lista: se lo pasás, y con el correo y ese código elige su
        contraseña la primera vez que entra. No la sabe nadie más.
      </p>

      <form action={sumar} className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* **El nombre se escribe acá.** Se sacaba del correo y se
              corregía después; con eso la lista mostraba «nari» hasta que
              alguien se acordara de editarla. */}
          <input
            name="nombre"
            placeholder="nombre"
            aria-label="Nombre"
            required
            minLength={2}
            autoFocus
            className={CAMPO}
          />
          <input
            name="correo"
            type="email"
            placeholder="correo"
            aria-label="Correo"
            required
            className={CAMPO}
          />
          <select
            name="rol"
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            aria-label="Rol"
            className="border border-linea bg-lienzo px-2 py-2 text-normal"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {NOMBRE_DE_ROL[r]}
              </option>
            ))}
          </select>
          <button type="submit" disabled={sumando} className={BOTON}>
            Dar de alta
          </button>
          <button type="button" onClick={() => setAbierto(false)} className={BOTON}>
            Cancelar
          </button>
        </div>

        {/* **Personalizado: las secciones se eligen acá, para esta persona.**
            No es un molde compartido: lo que se tilde queda en su ficha y se
            cambia desde su fila, sin tocar a nadie más. Con los otros roles
            no hace falta elegir nada: el rol ya dice qué ve. */}
        {rol === ROL_PERSONALIZADO && (
          <fieldset className="border-l-4 border-acento bg-acento-tenue/30 py-3 pl-4 pr-3">
            <legend className="sr-only">Secciones a las que entra</legend>
            <p className="text-menudo font-semibold">
              A qué partes entra. Es solo para esta persona: se cambia después
              desde su fila.
            </p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {SECCIONES.map((seccion) => (
                <li key={seccion}>
                  <label className="flex items-start gap-2 text-menudo">
                    <input
                      type="checkbox"
                      name="sueltas"
                      value={seccion}
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-acento)]"
                    />
                    <span className="min-w-0">
                      <span className="font-semibold">{NOMBRE_DE_SECCION[seccion]}</span>
                      <span className="block text-micro text-apagado">{QUE_HAY_EN[seccion]}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </form>

      {estado && !estado.ok && (
        <p aria-live="polite" className="mt-2 text-menudo font-semibold text-alerta">
          {estado.motivo}
        </p>
      )}
    </section>
  );
}
