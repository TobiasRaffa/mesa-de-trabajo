// Todas las conversaciones, en una sola pantalla.
//
// Existe para contestar de un vistazo la pregunta que la agencia se hace todo
// el día: **¿dónde me están esperando?**. Arriba lo que falta leer.
//
// **El renglón entero abre la conversación.** El disparador era un botón del
// extremo derecho que decía «Conversación» al lado de un renglón que ya dice
// de qué es: se venía a abrir esa conversación, se tocaba el nombre, no pasaba
// nada, y había que cruzar la pantalla hasta la otra punta. Y el mismo número
// de sin leer aparecía tres veces en el mismo renglón —el fondo teñido, el
// chip y el globo del botón—.

import { todasLasConversaciones } from "@/admin/datos/chats";
import { EncabezadoDePagina, PANTALLA } from "@/admin/EncabezadoDePagina";
import { ChatDeCliente } from "@/admin/ChatDeCliente";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { comoMePresentoEnElChat } from "@/lib/sesion";
import { enPalabrasLaFecha } from "@/dominio/tiempo";

export const dynamic = "force-dynamic";

const enPalabras = (iso: string | undefined) => (iso ? enPalabrasLaFecha(iso) : "");

export default async function Chats({ searchParams }: PageProps<"/gestion/chats">) {
  let chats;
  const firma = await comoMePresentoEnElChat();
  // Con qué cliente llegar ya abierto: es lo que manda el globo de mensajes.
  const { abrir } = await searchParams;
  const abrirDeEntrada = typeof abrir === "string" ? abrir : null;
  try {
    chats = await todasLasConversaciones();
  } catch (error) {
    return <ErrorDeDrive error={error} titulo="Conversaciones" />;
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
              // Una raya al costado en vez del fondo teñido: marca el renglón
              // sin repetir por tercera vez lo que ya dice el chip.
              className={`border-b border-linea ${
                chat.sinLeer > 0 ? "border-l-4 border-l-acento" : ""
              }`}
            >
              <ChatDeCliente
                clienteId={chat.clienteId}
                nombre={chat.cliente}
                sinLeer={chat.sinLeer}
                firma={firma}
                abrirDeEntrada={chat.clienteId === abrirDeEntrada}
                renglon={
                  <div className="px-4 py-4 transition-colors hover:bg-hueco/60">
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
                          <span className="font-bold">{deQuien(chat.ultimo.de)}:</span>{" "}
                          {chat.ultimo.texto}
                        </>
                      ) : (
                        <span className="text-apagado">Sin mensajes</span>
                      )}
                    </p>
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/**
 * Quién dijo lo último.
 *
 * Son tres valores y no dos: además del cliente y del equipo, la aplicación
 * escribe avisos de estado. Un ternario los daba por «Equipo», o sea que un
 * aviso automático quedaba firmado como si lo hubiera escrito alguien.
 */
function deQuien(de: "cliente" | "agencia" | "sistema"): string {
  if (de === "cliente") return "Cliente";
  if (de === "agencia") return "Equipo";
  return "Aviso";
}
