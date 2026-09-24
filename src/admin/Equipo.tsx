"use client";

// Quién es del equipo, y a qué parte entra cada uno.
//
// **Dar de alta es un nombre, un correo y un rol.** No se pide contraseña: la
// elige esa persona la primera vez que entra. Nunca pasa por acá, así que
// quien da de alta no puede saberla ni por accidente.
//
// Los campos no se pueden escribir de una: hay que apretar **Editar**. Una
// lista de campos abiertos invita a cambiar algo sin querer al pasar el mouse,
// y acá lo que se cambia es a dónde le llegan los avisos a alguien y a qué
// partes de la aplicación entra.
//
// **Una ficha, un «Guardar».** Eran dos formularios en la misma ficha —uno
// para el nombre y el correo, otro para el rol y los clientes— con un botón
// cada uno. Nadie mira una ficha y ve dos formularios: se cambiaba el nombre y
// de paso el rol, se apretaba el «Guardar» de arriba, y al cerrar el rol se
// perdía sin que nada lo dijera. Ahora se manda todo junto.
//
// Cada fila sigue siendo un formulario suelto: se guarda una persona sin tocar
// las demás, y un error de una no borra lo que se estaba escribiendo en otra.

import { startTransition, useActionState, useEffect, useState } from "react";
import {
  darDeAlta,
  editarDelEquipo,
  generarCodigoDeAlta,
  quitarDelEquipo,
  reiniciarClaveDePersona,
} from "@/app/(admin)/gestion/acciones";
import { Copiar } from "@/ui/Copiar";
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
  type Alcance,
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

/**
 * Manda el formulario a la acción sin que React lo vacíe.
 *
 * **Con `<form action>`, React devuelve cada campo a su valor de entrada
 * antes de mandar, salga bien o mal.** Con un error del servidor, la ficha
 * quedaba a medias: el correo y los clientes tildados volvían a lo de antes y
 * el rol, que se sigue en pantalla, quedaba en lo nuevo. Corregir el correo y
 * guardar de nuevo grababa esa mezcla, un alcance que nadie eligió. Mandado a
 * mano, lo escrito queda tal cual; cuando sale bien, la ficha se cierra igual.
 */
function sinVaciar(accion: (datos: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => accion(datos));
  };
}

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
  /** Se tocó «Quitar» y falta confirmar. */
  const [porQuitar, setPorQuitar] = useState(false);
  /** Se guardó recién. Se apaga solo. */
  const [guardado, setGuardado] = useState(false);
  /** La última respuesta que esta fila ya atendió. */
  const [atendida, setAtendida] = useState(estado);

  // **Guardar cierra la ficha y lo dice.** Salía bien y no pasaba nada
  // visible: el formulario quedaba abierto, con los mismos valores y sin un
  // cartel, así que lo primero que hacía cualquiera era apretar Guardar otra
  // vez para ver si había prendido.
  //
  // Se ajusta acá y no en un efecto: React prefiere el ajuste durante el
  // render cuando lo que cambia depende de algo que ya llegó, y así no hay un
  // dibujo intermedio con la ficha abierta después de haber guardado.
  if (estado !== atendida) {
    setAtendida(estado);
    if (estado?.ok) {
      setEditando(false);
      setGuardado(true);
    }
  }

  // Lo único que hace falta que pase después: apagar el cartel.
  useEffect(() => {
    if (!guardado) return;
    const t = setTimeout(() => setGuardado(false), 2500);
    return () => clearTimeout(t);
  }, [guardado]);

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
            {/* **Sin correo no entra nunca**, así que no es un dato que falte:
                es una cuenta que no se puede usar. Se lee en rojo. */}
            {persona.correo || (
              <span className="font-semibold text-alerta">sin correo: no puede entrar</span>
            )}
            {persona.enDrive && ` · en Drive: ${persona.enDrive}`}
            {persona.avisaDeTodo && " · recibe todos los avisos"}
          </p>

          {/* **Solo lo que no dice el rol.** Se escribían siempre las dos
              líneas —«Entra a: …» y «Clientes: todos»— y decían exactamente lo
              mismo que la etiqueta del rol que está tres centímetros arriba.
              Lo que hay que ver de un vistazo es dónde alguien se aparta de su
              rol; el detalle completo está al abrir «Editar». */}
          {persona.sueltas.length > 0 && (
            <p className="mt-0.5 text-menudo text-apagado">
              Entra además a: {persona.sueltas.map((s) => NOMBRE_DE_SECCION[s]).join(", ")}
            </p>
          )}
          {persona.clientes !== "todos" && (
            <p className="mt-0.5 text-menudo text-apagado">
              Clientes: {comoSeLee(persona.clientes, clientes)}
            </p>
          )}
          {suyas.length === 0 && (
            <p className={`${MARCA} text-alerta`}>sin ninguna sección: entra y no ve nada</p>
          )}

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
          {guardado && (
            <p aria-live="polite" className={`${MARCA} text-acento`}>
              guardado
            </p>
          )}
        </div>

        {/* **Reiniciar está donde se lee el problema.** Vivía adentro de
            «Editar», así que atender un «no puedo entrar» costaba abrir la
            ficha, encontrar el botón entre los otros cinco y volver a cerrar,
            mientras la marca que lo pedía estaba acá afuera. */}
        {pidioOtraClave && tieneClave && (
          <Contrasena persona={persona} tieneClave={tieneClave} pidioOtraClave />
        )}
        <button type="button" onClick={() => setEditando(true)} className={BOTON}>
          Editar
        </button>
      </li>
    );
  }

  return (
    <li className="border-b border-linea px-4 py-4">
      <form onSubmit={sinVaciar(guardar)}>
        <input type="hidden" name="id" value={persona.id} />

        <div className="flex flex-wrap items-center gap-2">
          <input
            name="nombre"
            defaultValue={persona.nombre}
            aria-label="Nombre"
            required
            minLength={2}
            className={CAMPO}
          />
          <input
            name="correo"
            type="email"
            defaultValue={persona.correo}
            placeholder="correo"
            aria-label="Correo"
            required
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
        </div>

        <CamposDeAcceso persona={persona} clientes={clientes} />

        {estado && !estado.ok && (
          <p aria-live="polite" className="mt-4 text-menudo font-semibold text-alerta">
            {estado.motivo}
          </p>
        )}

        {/* Los botones al pie, después de todo lo que hay que decidir. */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-linea pt-4">
          <button type="submit" disabled={guardando} className={BOTON}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={() => setEditando(false)} className={BOTON}>
            Cancelar
          </button>
        </div>
      </form>

      {/* Fuera del formulario: son sus propias acciones, y un `<form>` no se
          puede meter adentro de otro. */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Contrasena persona={persona} tieneClave={tieneClave} pidioOtraClave={pidioOtraClave} />

        {/* **Quitar pregunta antes.** Era un botón suelto: un clic y la persona
            se iba del equipo, sin confirmar y sin forma de deshacerlo desde la
            pantalla. Todo lo demás que no tiene vuelta atrás en esta
            aplicación pregunta primero —renombrar en Drive, unir dos
            trabajos—; esto no. */}
        {porQuitar ? (
          <form action={quitar} className="flex items-center gap-2">
            <input type="hidden" name="id" value={persona.id} />
            <span className="text-menudo font-semibold text-alerta">
              ¿Sacar a {persona.nombre} del equipo?
            </span>
            <button
              type="submit"
              disabled={quitando}
              className="min-h-toque px-3 text-menudo font-bold text-alerta underline
                         underline-offset-2 disabled:opacity-40"
            >
              {quitando ? "…" : "Sí, sacar"}
            </button>
            <button
              type="button"
              onClick={() => setPorQuitar(false)}
              className="min-h-toque px-3 text-menudo font-semibold text-apagado underline underline-offset-2"
            >
              No
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setPorQuitar(true)}
            className="min-h-toque px-3 text-menudo font-semibold text-apagado underline
                       underline-offset-2 transition-colors hover:text-alerta"
          >
            Quitar del equipo
          </button>
        )}
      </div>

      {estadoQuitar && !estadoQuitar.ok && (
        <p aria-live="polite" className="mt-2 text-menudo font-semibold text-alerta">
          {estadoQuitar.motivo}
        </p>
      )}
    </li>
  );
}

/**
 * A qué clientes llega alguien.
 *
 * **Está acá y no adentro de un formulario porque lo usan los dos.** Se
 * elegía solo al cambiarle los accesos a alguien que ya estaba; al dar de alta
 * no se preguntaba, y el alta ponía «todos» por omisión. O sea que toda persona
 * nueva nacía viendo la carpeta de todos los clientes de la agencia, y acotarla
 * quedaba como un segundo paso que alguien tenía que acordarse de hacer. Para
 * un rol acotado —Facturación, pongamos— eso deja el alcance abierto justo
 * donde la sección se cerró.
 *
 * Se decide una vez, junto con el rol, que es cuando se está pensando en qué
 * va a hacer esa persona.
 */
function ElegirClientes({
  clientes,
  elegidos,
}: {
  clientes: ClienteParaElegir[];
  /** Lo que ya tiene, o `"todos"` para alguien nuevo. */
  elegidos: Alcance;
}) {
  const [todos, setTodos] = useState(elegidos === "todos");

  // **Son dos cosas distintas:** el rol dice a qué *partes* de la aplicación
  // entra; esto, a *cuáles* clientes. Quien lleva una sola cuenta no tiene por
  // qué abrir el árbol y encontrarse con las otras ocho.
  return (
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
                      defaultChecked={elegidos !== "todos" && elegidos.includes(c.id)}
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
  );
}

/**
 * A qué partes entra: el rol, y lo que se le da aparte.
 *
 * **Lo que da el rol se muestra tildado y no se puede destildar.** Las sueltas
 * suman y nunca restan: para quitarle algo a alguien se le cambia el rol, que
 * es la decisión que de verdad se está tomando. Una casilla que parece que
 * quita y no quita es peor que no tenerla.
 *
 * No tiene formulario propio: son campos de la ficha, y se guardan con ella.
 */
function CamposDeAcceso({
  persona,
  clientes,
}: {
  persona: Persona;
  clientes: ClienteParaElegir[];
}) {
  const [rol, setRol] = useState<Rol>(persona.rol);

  return (
    <div className="mt-4 border-t border-linea pt-4">
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

      <ElegirClientes clientes={clientes} elegidos={persona.clientes} />
    </div>
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

  // **Un cliente que ya no existe no se muestra por su identificador.** Se
  // leía «Clientes: 1PiLqYLMry9…», que no le dice nada a nadie; y si era el
  // único, la persona no llega a ningún cliente y eso es lo que hay que ver.
  const nombres = alcance
    .map((id) => clientes.find((c) => c.id === id)?.nombre)
    .filter((n): n is string => Boolean(n));
  const perdidos = alcance.length - nombres.length;
  const yaNo = perdidos === 1 ? "uno que ya no existe" : `${perdidos} que ya no existen`;
  if (nombres.length === 0) return `ninguno (${perdidos === 1 ? "el que tenía" : "los que tenía"} ya no existe${perdidos === 1 ? "" : "n"})`;

  const lista =
    nombres.length <= 3
      ? nombres.join(", ")
      : `${nombres.slice(0, 3).join(", ")} y ${nombres.length - 3} más`;
  return perdidos > 0 ? `${lista}, y ${yaNo}` : lista;
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
          {/* **El código sale en la fila, que ahora sí se ve.** Decía «el que
              aparece en su fila» mientras quien acababa de reiniciar estaba en
              la ficha abierta, que tapa justo esa fila. Al recargar, la fila
              vuelve sin contraseña y con su código nuevo. */}
          {estado.ok
            ? "Lista. En su fila aparece el código de alta nuevo: pasáselo."
            : estado.motivo}
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
      <p className="mt-1 flex flex-wrap items-center gap-2 text-menudo">
        <span className="text-micro font-extrabold uppercase tracking-wider text-apagado">
          código de alta
        </span>
        <span className="cifras bg-hueco px-2 py-0.5 font-bold tracking-wide">{codigo}</span>
        {/* Se dicta o se pega en un chat: seleccionarlo a mano en una fila
            apretada es de las cosas que más se erran. */}
        <Copiar texto={codigo} />
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

export function SumarPersona({ clientes }: { clientes: ClienteParaElegir[] }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, sumar, sumando] = useActionState(darDeAlta, null);
  // El rol se mira mientras se elige: con «Personalizado» aparecen las
  // secciones para tildar acá mismo.
  const [rol, setRol] = useState<Rol>("diseno");

  /** La última respuesta que este panel ya atendió. */
  const [atendida, setAtendida] = useState(estado);

  // **Salió bien: se cierra el panel.** Quedaba abierto con los campos
  // escritos, sin cartel, tapando justo la fila nueva y su código de alta, que
  // es lo que hay que copiar para terminar el trámite.
  if (estado !== atendida) {
    setAtendida(estado);
    if (estado?.ok) setAbierto(false);
  }

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

      <form onSubmit={sinVaciar(sumar)} className="mt-3 flex flex-col gap-3">
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

        {/* **El alcance se elige acá, junto con el rol.** No se preguntaba, y
            el alta ponía «todos»: toda persona nueva nacía viendo la carpeta
            de todos los clientes, y acotarla quedaba como un segundo paso que
            había que acordarse de hacer desde su fila. */}
        <ElegirClientes clientes={clientes} elegidos="todos" />

        {/* **El botón al pie y el error justo encima.** «Dar de alta» estaba en
            la primera fila, o sea antes de la mitad de lo que hay que decidir,
            y el error se dibujaba después del `</form>`: se apretaba un botón
            arriba y la respuesta aparecía fuera de la pantalla. */}
        {estado && !estado.ok && (
          <p aria-live="polite" className="text-menudo font-semibold text-alerta">
            {estado.motivo}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-linea pt-4">
          <button type="submit" disabled={sumando} className={BOTON}>
            {sumando ? "Dando de alta…" : "Dar de alta"}
          </button>
          <button type="button" onClick={() => setAbierto(false)} className={BOTON}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
