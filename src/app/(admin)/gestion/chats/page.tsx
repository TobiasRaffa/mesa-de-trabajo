// Todas las conversaciones, en una sola pantalla.
//
// Existe para contestar de un vistazo la pregunta que la agencia se hace todo
// el día: **¿dónde me están esperando?**. Arriba va lo que el cliente dijo y
// nadie contestó; después, lo más reciente.

import Link from "next/link";
import { todasLasConversaciones } from "@/admin/datos/chats";
import { ChatDeCarpeta } from "@/admin/ChatDeCarpeta";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";

export const dynamic = "force-dynamic";

const cuando = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function enPalabras(iso: string | undefined): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "" : cuando.format(fecha);
}

export default async function Chats() {
  let chats;
  try {
    chats = await todasLasConversaciones();
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  const esperando = chats.filter((c) => c.esperandoRespuesta);
  const conMensajes = chats.filter((c) => c.mensajes > 0 && !c.esperandoRespuesta);
  const calladas = chats.filter((c) => c.mensajes === 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <h1 className="text-grande font-extrabold tracking-tight">Conversaciones</h1>
        <p className="mt-2 text-normal text-tinta-suave">
          {esperando.length === 0
            ? "No hay nadie esperando respuesta."
            : `${esperando.length} ${
                esperando.length === 1 ? "espera" : "esperan"
              } tu respuesta.`}
        </p>
      </header>

      {esperando.length > 0 && (
        <Grupo titulo="Te están esperando" chats={esperando} destacado />
      )}

      {conMensajes.length > 0 && (
        <Grupo titulo="Con conversación" chats={conMensajes} />
      )}

      {calladas.length > 0 && (
        <section className="mt-10">
          <h2 className="text-titulo font-extrabold tracking-tight">Sin hablar todavía</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {calladas.map((chat) => (
              <li
                key={chat.carpetaId}
                className="flex items-center gap-2 border border-linea bg-lienzo px-3 py-2"
              >
                <span className="text-menudo font-bold">{chat.carpeta}</span>
                <span className="text-micro uppercase tracking-wider text-apagado">
                  {chat.cliente}
                </span>
                <ChatDeCarpeta
                  carpetaId={chat.carpetaId}
                  nombre={`${chat.cliente} · ${chat.carpeta}`}
                  cuantos={0}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {chats.length === 0 && (
        <p className="mt-8 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-normal text-espera">
          No hay carpetas de trabajo en ningún cliente habilitado.
        </p>
      )}
    </main>
  );

  function Grupo({
    titulo,
    chats,
    destacado = false,
  }: {
    titulo: string;
    chats: Awaited<ReturnType<typeof todasLasConversaciones>>;
    destacado?: boolean;
  }) {
    return (
      <section className="mt-8">
        <h2 className="text-titulo font-extrabold tracking-tight">{titulo}</h2>

        <ul className="mt-4 border-t border-linea">
          {chats.map((chat) => (
            <li
              key={chat.carpetaId}
              className={`flex flex-wrap items-start justify-between gap-4 border-b border-linea px-4 py-4 ${
                destacado ? "border-l-4 border-l-acento bg-acento-tenue/30" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link
                    href={`/gestion/cliente/${chat.clienteId}`}
                    className="text-micro font-extrabold uppercase tracking-widest text-apagado
                               transition-colors hover:text-tinta"
                  >
                    {chat.cliente}
                  </Link>
                  <h3 className="text-guia font-bold tracking-tight">{chat.carpeta}</h3>
                  <span className="text-micro text-apagado">
                    {enPalabras(chat.ultimo?.cuando)}
                  </span>
                </div>

                {chat.ultimo && (
                  <p className="mt-1 truncate text-menudo text-tinta-suave">
                    <span className="font-bold">
                      {chat.ultimo.de === "cliente" ? "Cliente" : "Equipo"}:
                    </span>{" "}
                    {chat.ultimo.texto}
                  </p>
                )}
              </div>

              <ChatDeCarpeta
                carpetaId={chat.carpetaId}
                nombre={`${chat.cliente} · ${chat.carpeta}`}
                cuantos={chat.mensajes}
              />
            </li>
          ))}
        </ul>
      </section>
    );
  }
}
