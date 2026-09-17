"use client";

// La pantalla de entrada del equipo.
//
// **Primero el correo, después lo que corresponda.** Un solo formulario con
// los dos campos parecía más simple y no alcanzaba: quien entra por primera
// vez no tiene una contraseña que escribir, tiene que **elegir** una, y eso es
// otra pantalla —con el campo repetido, para que un dedo de más no quede
// guardado para siempre—. Preguntar el correo primero es lo que permite
// mostrarle a cada uno la que le toca.
//
// Preguntar por un correo no cuenta si existe: uno que no está cargado pide la
// contraseña igual que uno cargado, y después no entra, con el mismo texto.

import { useActionState, useState } from "react";
import { entrar, mirarCorreo, olvide } from "@/app/(admin)/gestion/entrar/acciones";
import { LARGO_MINIMO_DE_CLAVE } from "@/dominio/claves";

const CAMPO =
  "w-full border-2 border-tinta bg-lienzo px-3 py-2.5 text-normal transition-colors " +
  "placeholder:text-apagado focus:border-acento focus:outline-none focus:ring-4 " +
  "focus:ring-acento-tenue";

const ETIQUETA = "text-micro font-extrabold uppercase tracking-widest text-apagado";

const BOTON =
  "min-h-toque bg-acento px-5 text-normal font-bold tracking-tight " +
  "text-white transition-colors hover:bg-acento-hover disabled:opacity-40";

const AL_PASO =
  "self-start text-menudo font-semibold text-apagado underline underline-offset-2 " +
  "transition-colors hover:text-tinta disabled:opacity-40";

export function Entrar({
  volver,
  arrancando,
}: {
  /** A dónde ir después de entrar: de dónde lo echó la puerta. */
  volver: string;
  /** Nadie del equipo tiene contraseña todavía: entra con la del equipo. */
  arrancando: boolean;
}) {
  const [vistazo, mirar, mirando] = useActionState(mirarCorreo, null);
  const [pedido, pedir, pidiendo] = useActionState(olvide, null);

  // Volver a escribir el correo. La respuesta anterior no se puede borrar
  // —`useActionState` no se reinicia—, así que se la tapa hasta que llegue otra.
  const [otroCorreo, setOtroCorreo] = useState(false);
  const paso = !otroCorreo && vistazo?.ok ? vistazo : null;

  // **El arranque no puede tapar al primer alta.** Mientras nadie tenga
  // contraseña, esta pantalla arranca pidiendo la llave del equipo, que es lo
  // que hace falta el 99% de las veces que aparece: no hay nadie cargado. Pero
  // la persona a la que acaban de dar de alta también llega acá con «nadie
  // tiene contraseña» —la suya es justo la que viene a elegir—, así que tiene
  // que poder pasarse al camino normal.
  const [conMiCorreo, setConMiCorreo] = useState(false);

  if (arrancando && !conMiCorreo) {
    return <Arranque volver={volver} alCorreo={() => setConMiCorreo(true)} />;
  }

  return (
    <Marco titulo={paso?.primeraVez ? "Primera vez" : "Entrar"}>
      {!paso && (
        <>
          <p className="mt-3 text-normal text-tinta-suave">
            Con tu correo. Lo que hagas queda firmado con tu nombre.
          </p>

          <form action={mirar} onSubmit={() => setOtroCorreo(false)} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={ETIQUETA}>Tu correo</span>
              <input
                name="correo"
                type="email"
                autoComplete="username"
                autoFocus
                required
                defaultValue={vistazo?.ok ? vistazo.correo : ""}
                className={CAMPO}
              />
            </label>

            <button type="submit" disabled={mirando} className={BOTON}>
              {mirando ? "…" : "Seguir"}
            </button>

            <Aviso de={vistazo?.ok === false ? vistazo.motivo : null} />
          </form>
        </>
      )}

      {paso && !paso.primeraVez && (
        <ConContrasena
          correo={paso.correo}
          volver={volver}
          alCambiarDeCorreo={() => setOtroCorreo(true)}
          pedir={pedir}
          pidiendo={pidiendo}
          pedido={pedido}
        />
      )}

      {paso?.primeraVez && (
        <Estreno
          correo={paso.correo}
          volver={volver}
          alCambiarDeCorreo={() => setOtroCorreo(true)}
        />
      )}
    </Marco>
  );
}

/** Quien ya tiene contraseña: la escribe y entra. */
function ConContrasena({
  correo,
  volver,
  alCambiarDeCorreo,
  pedir,
  pidiendo,
  pedido,
}: {
  correo: string;
  volver: string;
  alCambiarDeCorreo: () => void;
  pedir: (formulario: FormData) => void;
  pidiendo: boolean;
  pedido: { ok: boolean; motivo: string } | null;
}) {
  const [estado, mandar, yendo] = useActionState(entrar, null);

  return (
    <>
      <Quien correo={correo} alCambiar={alCambiarDeCorreo} />

      <form action={mandar} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="volver" value={volver} />
        <input type="hidden" name="correo" value={correo} />

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETA}>Tu contraseña</span>
          <input
            name="clave"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            className={CAMPO}
          />
        </label>

        <button type="submit" disabled={yendo} className={BOTON}>
          {yendo ? "Entrando…" : "Entrar"}
        </button>

        <Aviso de={estado && !estado.ok ? estado.motivo : null} />
      </form>

      {/* **Olvidé mi contraseña.** No manda ningún correo ni abre ninguna
          puerta: deja el pedido anotado para que quien administra lo vea y se
          la reinicie. Después entra eligiendo una nueva, que sigue sabiendo
          solo ella. */}
      {pedido?.ok ? (
        <p className="mt-6 border-l-4 border-acento bg-acento-tenue px-3 py-2 text-menudo font-semibold text-tinta">
          {pedido.motivo}
        </p>
      ) : (
        <form action={pedir} className="mt-6 flex flex-col gap-2">
          <input type="hidden" name="correo" value={correo} />
          <button type="submit" disabled={pidiendo} className={AL_PASO}>
            {pidiendo ? "…" : "Olvidé mi contraseña"}
          </button>
          <Aviso de={pedido && !pedido.ok ? pedido.motivo : null} />
        </form>
      )}
    </>
  );
}

/** Quien entra por primera vez: elige su contraseña y cómo se llama. */
function Estreno({
  correo,
  volver,
  alCambiarDeCorreo,
}: {
  correo: string;
  volver: string;
  alCambiarDeCorreo: () => void;
}) {
  const [estado, mandar, yendo] = useActionState(entrar, null);

  return (
    <>
      <p className="mt-3 text-normal text-tinta-suave">
        Elegí tu contraseña. No la sabe nadie más, ni quien te dio de alta: si
        alguna vez la perdés, se reinicia y elegís otra.
      </p>

      <Quien correo={correo} alCambiar={alCambiarDeCorreo} />

      <form action={mandar} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="volver" value={volver} />
        <input type="hidden" name="correo" value={correo} />

        {/* Con este nombre queda firmado todo lo que haga. Viene sacado del
            correo, y acá lo escribe como quiere que la llamen. */}
        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETA}>Cómo te llamás</span>
          <input
            name="nombre"
            autoComplete="name"
            autoFocus
            minLength={2}
            maxLength={60}
            placeholder="Con este nombre queda firmado lo que hagas"
            className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETA}>Tu contraseña nueva</span>
          <input
            name="clave"
            type="password"
            autoComplete="new-password"
            minLength={LARGO_MINIMO_DE_CLAVE}
            required
            placeholder={`${LARGO_MINIMO_DE_CLAVE} caracteres o más`}
            className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETA}>Repetila</span>
          <input
            name="repetida"
            type="password"
            autoComplete="new-password"
            minLength={LARGO_MINIMO_DE_CLAVE}
            required
            className={CAMPO}
          />
        </label>

        <button type="submit" disabled={yendo} className={BOTON}>
          {yendo ? "Entrando…" : "Guardarla y entrar"}
        </button>

        <Aviso de={estado && !estado.ok ? estado.motivo : null} />
      </form>
    </>
  );
}

/**
 * El arranque: nadie tiene contraseña todavía.
 *
 * Un solo campo, la llave del equipo, para poder entrar a dar de alta a la
 * primera persona. Este camino se cierra solo en cuanto alguien tiene la suya.
 */
function Arranque({ volver, alCorreo }: { volver: string; alCorreo: () => void }) {
  const [estado, mandar, yendo] = useActionState(entrar, null);

  return (
    <Marco titulo="Primera vez">
      <p className="mt-3 text-normal text-tinta-suave">
        Todavía nadie del equipo tiene contraseña. Entrá con la clave del equipo y
        dá de alta a la primera persona en <span className="font-bold">Admin → El equipo</span>.
        Desde que haya una, cada una entra con la suya.
      </p>

      <form action={mandar} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="volver" value={volver} />

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETA}>Clave del equipo</span>
          <input
            name="clave"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            className={CAMPO}
          />
        </label>

        <button type="submit" disabled={yendo} className={BOTON}>
          {yendo ? "Entrando…" : "Entrar"}
        </button>

        <Aviso de={estado && !estado.ok ? estado.motivo : null} />
      </form>

      <button type="button" onClick={alCorreo} className={`${AL_PASO} mt-6`}>
        Ya me dieron de alta: entrar con mi correo
      </button>
    </Marco>
  );
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <p className={ETIQUETA}>Mesa de trabajo</p>
      <h1 className="mt-2 text-grande font-extrabold leading-none tracking-tighter">
        {titulo}
      </h1>
      {children}
    </main>
  );
}

/** El correo con el que se sigue, y cómo cambiarlo sin recargar nada. */
function Quien({ correo, alCambiar }: { correo: string; alCambiar: () => void }) {
  return (
    <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-linea pt-4">
      <span className="min-w-0 truncate font-bold tracking-tight">{correo}</span>
      <button type="button" onClick={alCambiar} className={AL_PASO}>
        No soy yo
      </button>
    </p>
  );
}

/** Lo que dijo el servidor, donde se aprieta el botón. */
function Aviso({ de }: { de: string | null }) {
  if (!de) return null;
  return (
    <p
      role="alert"
      className="border-l-4 border-alerta bg-alerta-tenue px-3 py-2 text-menudo font-semibold text-alerta"
    >
      {de}
    </p>
  );
}
