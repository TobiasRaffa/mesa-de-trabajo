// El calendario de una carpeta: cuándo sale cada pieza.
//
// Es la pantalla que le faltaba al calendario del portal. Drive no sabe cuándo
// sale publicado un archivo —tiene fecha de subida, no de publicación— y no se
// puede deducir del nombre sin inventar. Lo pone la agencia acá, y el cliente
// ve exactamente eso.

import Link from "next/link";
import { carpetaParaFechar } from "@/admin/datos/carpetas";
import { ArmarCalendario } from "@/admin/ArmarCalendario";
import { HistoriaDePiezas } from "@/admin/HistoriaDePiezas";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";

export const dynamic = "force-dynamic";

export default async function Calendario({
  params,
}: PageProps<"/gestion/cliente/[clienteId]/carpeta/[carpetaId]">) {
  const { clienteId, carpetaId } = await params;

  let datos;
  try {
    datos = await carpetaParaFechar(clienteId, carpetaId);
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  const enCalendario = datos.carpeta.vista === "calendario";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <Link
          href={`/gestion/cliente/${clienteId}`}
          className="text-micro font-extrabold uppercase tracking-widest text-apagado
                     transition-colors hover:text-tinta"
        >
          ← {datos.cliente.nombre}
        </Link>
        <h1 className="mt-2 text-grande font-extrabold tracking-tight">
          {datos.carpeta.nombre}
        </h1>
      </header>

      {!enCalendario ? (
        <p className="mt-8 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-normal text-espera">
          Esta carpeta está marcada como <strong>lista</strong>, así que el cliente no ve
          un calendario. Podés ponerle fechas igual —quedan guardadas— pero para que las
          vea hay que pasarla a calendario desde la pantalla del cliente.
        </p>
      ) : datos.piezas.length === 0 ? (
        <p className="mt-8 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-normal text-espera">
          No hay archivos en esta carpeta todavía.
        </p>
      ) : null}

      {enCalendario && datos.piezas.length > 0 && (
        <ArmarCalendario carpetaId={carpetaId} piezas={datos.piezas} />
      )}

      <HistoriaDePiezas piezas={datos.historia} />
    </main>
  );
}
