// Todas las conversaciones, en una sola pantalla.
//
// Existe para contestar de un vistazo la pregunta que la agencia se hace todo
// el día: **¿dónde me están esperando?**. Arriba lo que falta leer.

import { todasLasConversaciones } from "@/admin/datos/chats";
import { EncabezadoDePagina, PANTALLA } from "@/admin/EncabezadoDePagina";
import { ChatDeCliente } from "@/admin/ChatDeCliente";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { comoMePresentoEnElChat } from "@/lib/sesion";

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

export default async function Chats({ searchParams }: PageProps<"/gestion/chats">) {
  let chats;
  const firma = await comoMePresentoEnElChat();
  // Con qué cliente llegar ya abierto: es lo que manda el globo de mensajes.
  const { abrir } = await searchParams;
  const abrirDeEntrada = typeof abrir === "string" ? abrir : null;
  try {
    chats = await todasLasConversaciones();
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  return (
    <main className={PANTALLA}>
      <EncabezadoDePagina titulo="Conversaciones" />

      {chats.length === 0 ? (
        <p className="mt-8 text-normal text-apagado">
          No hay clientes con acceso al portal.
        </p>
      ) : (
        <ul className="mt-6 border-t border-linea">
          {chats.map((chat) => (
            <li
              key={chat.clienteId}
              className={`flex flex-wrap items-center justify-between gap-4 border-b border-linea px-4 py-4 ${
                chat.sinLeer > 0 ? "bg-acento-tenue/30" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-guia font-bold tracking-tight">{chat.cliente}</h2>
                  {chat.sinLeer > 0 && (
                    <span className="bg-acento px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider text-white">
                      {chat.sinLeer} sin leer
                    </span>
                  )}
                  <span className="cifras text-menudo text-apagado">
                    {enPalabras(chat.ultimo?.cuando)}
                  </span>
                </div>

                <p className="mt-1 truncate text-menudo text-tinta-suave">
                  {chat.ultimo ? (
                    <>
                      <span className="font-bold">
                        {chat.ultimo.de === "cliente" ? "Cliente" : "Equipo"}:
                      </span>{" "}
                      {chat.ultimo.texto}
                    </>
                  ) : (
                    <span className="text-apagado">Sin mensajes</span>
                  )}
                </p>
              </div>

              <ChatDeCliente
                clienteId={chat.clienteId}
                nombre={chat.cliente}
                sinLeer={chat.sinLeer}
                firma={firma}
                abrirDeEntrada={chat.clienteId === abrirDeEntrada}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
