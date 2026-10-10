"use client";

// La pantalla de entrada del equipo.
//
// **El correo y la contraseña, juntos y en una sola pantalla.** Se preguntaban
// en dos pasos: primero el correo, un viaje al servidor, y recién después la
// contraseña. El argumento era bueno —quien entra por primera vez no tiene una
// contraseña que escribir, tiene que **elegir** una, con el campo repetido— y
// el precio estaba mal repartido: ese caso le pasa a cada persona **una sola
// vez en la vida**, y el paso extra lo pagaban las otras quinientas veces que
// entra. Dos pantallas, dos clics y una espera, todos los días.
//
// Además, dos campos separados por un viaje al servidor es algo que ningún
// administrador de contraseñas sabe completar: hay que escribir el correo a
// mano aunque esté guardado.
//
// Ahora se escriben los dos y el servidor decide: si es la primera vez,
// contesta `primeraVez` y **esta misma pantalla** se abre en el formulario de
// estreno, con el correo ya puesto. No cuenta nada que no contara antes: esa
// respuesta sale solo para alguien que existe y todavía no eligió contraseña,
// que es justo lo que contestaba el paso que se fue. Un correo desconocido
// recibe el mismo «no es» que una contraseña equivocada.

import { useActionState, useEffect, useRef, useState } from "react";
import { entrar, olvide, restablecer } from "@/app/(admin)/gestion/entrar/acciones";
import { LARGO_MINIMO_DE_CLAVE } from "@/dominio/claves";
import { Boton } from "@/ui/Boton";
import { Marca } from "@/ui/Marca";

const CAMPO =
  "w-full border-2 border-tinta bg-lienzo px-3 py-2.5 text-normal transition-colors " +
  "placeholder:text-apagado focus:border-acento focus:outline-none focus:ring-4 " +
  "focus:ring-acento-tenue";

const ETIQUETA = "text-micro font-extrabold uppercase tracking-widest text-apagado";


/** Correo, contraseña, entrar. La primera vez, el código de alta y la contraseña nueva. */
export function Entrar({ volver }: {
  /** A dónde ir después de entrar: de dónde lo echó la puerta. */
  volver: string;
}) {
  const [estado, mandar, yendo] = useActionState(entrar, null);
  const [pedido, pedir, pidiendo] = useActionState(olvide, null);

  // Lo que se escribió, para no perderlo al pasar al estreno y para que
  // «olvidé mi contraseña» sepa de quién habla sin pedirlo de nuevo.
  const [correo, setCorreo] = useState("");

  const primeraVez = Boolean(estado && !estado.ok && estado.primeraVez);

  // **Al errar, el cursor vuelve solo a la contraseña.** Es el único campo que
  // se vacía, y sin esto hay que ir a buscarlo con el mouse para escribir de
  // nuevo lo mismo que se acaba de escribir mal: un viaje de ida y vuelta por
  // la pantalla en el momento en que uno ya está molesto.
  const laClave = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (estado && !estado.ok && !estado.primeraVez) laClave.current?.focus();
  }, [estado]);

  if (primeraVez) return <Estreno correo={correo} volver={volver} />;

  return (
    <Marco titulo="Entrar">

      <form action={mandar} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="volver" value={volver} />

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETA}>Tu correo</span>
          <input
            name="correo"
            type="email"
            autoComplete="username"
            autoFocus
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className={CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETA}>Tu contraseña</span>
          <input
            ref={laClave}
            name="clave"
            type="password"
            autoComplete="current-password"
            required
            className={CAMPO}
          />
        </label>

        <Boton type="submit" ancho disabled={yendo}>
          {yendo ? "Entrando…" : "Entrar"}
        </Boton>

        <Aviso de={estado && !estado.ok ? estado.motivo : null} />
      </form>

      {/* **Olvidé mi contraseña.** Manda un link de un solo uso al correo, que
          sirve para elegir una contraseña nueva. El pedido también queda anotado
          en Admin por si el correo no llega. */}
      {pedido?.ok ? (
        <p className="mt-6 border-l-4 border-acento bg-acento-tenue px-3 py-2 text-menudo font-semibold text-tinta">
          {pedido.motivo}
        </p>
      ) : (
        <form action={pedir} className="mt-6 flex flex-col gap-2">
          <input type="hidden" name="correo" value={correo} />
          <Boton variante="sutil" tamano="chico" type="submit" disabled={pidiendo} className="self-start">
            {pidiendo ? "…" : "Olvidé mi contraseña"}
          </Boton>
          <Aviso de={pedido && !pedido.ok ? pedido.motivo : null} />
        </form>
      )}
    </Marco>
  );
}

/** Quien entra por primera vez: elige su contraseña y cómo se llama. */
function Estreno({ correo, volver }: { correo: string; volver: string }) {
  const [estado, mandar, yendo] = useActionState(entrar, null);

  return (
    <Marco titulo="Primera vez">

      <p className="mt-6 border-t border-linea pt-4 font-bold tracking-tight">
        {correo}
      </p>

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
            className={CAMPO}
          />
        </label>

        {/* **El código de alta.** Sin él, saber el correo de alguien alcanzaba
            para quedarse con su cuenta antes de que entrara por primera vez. */}
        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETA}>Código de alta</span>
          <input
            name="codigo"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            required
            className={`${CAMPO} cifras uppercase tracking-widest`}
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

        <Boton type="submit" ancho disabled={yendo}>
          {yendo ? "Entrando…" : "Guardarla y entrar"}
        </Boton>

        <Aviso de={estado && !estado.ok ? estado.motivo : null} />
      </form>
    </Marco>
  );
}


/**
 * Elegir la contraseña nueva desde el link que llegó por correo.
 *
 * Solo pide la contraseña y su repetición: el link ya dice quién es. Si el link
 * no sirve, lo dice y ofrece volver a pedir uno.
 */
export function Restablecer({ token }: { token: string }) {
  const [estado, mandar, yendo] = useActionState(restablecer, null);

  if (!token) {
    return (
      <Marco titulo="Restablecer">
        <p className="mt-6 font-semibold">
          Este link está incompleto. Abrilo desde el correo que te llegó.
        </p>
        <a href="/gestion/entrar" className="mt-6 font-bold underline">
          Volver a entrar
        </a>
      </Marco>
    );
  }

  return (
    <Marco titulo="Contraseña nueva">
      <form action={mandar} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="t" value={token} />

        <label className="flex flex-col gap-1.5">
          <span className={ETIQUETA}>Tu contraseña nueva</span>
          <input
            name="clave"
            type="password"
            autoComplete="new-password"
            autoFocus
            minLength={LARGO_MINIMO_DE_CLAVE}
            required
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

        <Boton type="submit" ancho disabled={yendo}>
          {yendo ? "Guardando…" : "Guardarla y entrar"}
        </Boton>

        <Aviso de={estado && !estado.ok ? estado.motivo : null} />
      </form>

      {estado && !estado.ok && estado.motivo.startsWith("Este link ya no sirve") ? (
        <a href="/gestion/entrar" className="mt-6 font-bold underline">
          Volver a entrar y pedir otro link
        </a>
      ) : null}
    </Marco>
  );
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Marca />
      <h1 className="mt-8 text-grande font-extrabold leading-none tracking-tighter">
        {titulo}
      </h1>
      {children}
    </main>
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
