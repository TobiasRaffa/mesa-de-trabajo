// Un cliente solo: sus carpetas y sus mensajes listos.
//
// Es la misma pantalla de Clientes pero mirando a uno, con los mensajes para
// copiar debajo. Usa **el mismo árbol** a propósito: dos formas distintas de
// configurar lo mismo terminan divergiendo, y la que se usa menos queda vieja.

import Link from "next/link";
import { panelDeClientes } from "@/admin/datos/carpetas";
import { carpetasDeCliente } from "@/admin/datos/arbol";
import { ArbolDeClientes } from "@/admin/ArbolDeClientes";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { MensajesListos } from "@/admin/MensajesListos";
import { ChatDeCarpeta } from "@/admin/ChatDeCarpeta";
import { elEquipo } from "@/lib/equipo";

export const dynamic = "force-dynamic";

export default async function UnCliente({
  params,
}: PageProps<"/gestion/cliente/[clienteId]">) {
  const { clienteId } = await params;

  let cliente;
  let carpetas;
  let equipo;
  try {
    const todos = await panelDeClientes();
    cliente = todos.find((c) => c.id === clienteId);
    if (!cliente) throw new Error("No encontre ese cliente.");
    [carpetas, equipo] = await Promise.all([carpetasDeCliente(clienteId), elEquipo()]);
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  // La primera carpeta de trabajo visible: es de la que se suele hablar, y la
  // que se nombra en los mensajes listos.
  const principal = carpetas.find((c) => !c.reservada && c.visible);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <Link
          href="/gestion"
          className="text-micro font-extrabold uppercase tracking-widest text-apagado
                     transition-colors hover:text-tinta"
        >
          &larr; Clientes
        </Link>
        <h1 className="mt-2 text-grande font-extrabold tracking-tight">
          {cliente.nombre}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {/*
            Se abre en una pestana nueva a proposito. Asi esta pantalla queda
            atras -entrar al portal no tenia vuelta- y el portal no lleva
            ningun link de vuelta a administracion: eso seria una puerta de un
            mundo al otro, y la veria tambien el cliente.
          */}
          <a
            href={`/t/${cliente.token}`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-toque items-center bg-acento px-5 text-normal font-bold
                       tracking-tight text-white transition-colors hover:bg-acento-hover"
          >
            Ver el portal como el cliente
          </a>
          {cliente.enlaceDrive && (
            <a
              href={cliente.enlaceDrive}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-toque items-center border-2 border-tinta px-5
                         text-normal font-bold tracking-tight text-tinta transition-colors hover:bg-hueco"
            >
              Abrir la carpeta en Drive
            </a>
          )}
        </div>
      </header>

      <div className="mt-6">
        <ArbolDeClientes clientes={[cliente]} equipo={equipo} />
      </div>

      <MensajesListos
        datos={{
          cliente: cliente.nombre,
          carpeta: principal?.nombre ?? "lo nuevo",
          link: `/t/${cliente.token}`,
          pendientes: principal?.sinRevisar,
        }}
        alLado={
          principal && (
            <ChatDeCarpeta
              carpetaId={principal.id}
              nombre={`${cliente.nombre} - ${principal.nombre}`}
              cuantos={principal.mensajes}
            />
          )
        }
      />
    </main>
  );
}
