// Las carpetas de un cliente: qué ve y cómo lo ve.

import Link from "next/link";
import { carpetasDelCliente } from "@/admin/datos/carpetas";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { FilaDeCarpeta } from "@/admin/FilaDeCarpeta";

export const dynamic = "force-dynamic";

export default async function CarpetasDeCliente({
  params,
}: PageProps<"/gestion/cliente/[clienteId]">) {
  const { clienteId } = await params;

  let datos;
  try {
    datos = await carpetasDelCliente(clienteId);
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  const deTrabajo = datos.carpetas.filter((c) => !c.reservada);
  const reservadas = datos.carpetas.filter((c) => c.reservada);
  const visibles = deTrabajo.filter((c) => c.visible).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <Link
          href="/gestion"
          className="text-micro font-extrabold uppercase tracking-widest text-apagado
                     transition-colors hover:text-tinta"
        >
          ← Clientes
        </Link>
        <h1 className="mt-2 text-grande font-extrabold tracking-tight">
          {datos.cliente.nombre}
        </h1>
        <p className="mt-2 text-normal text-tinta-suave">
          {visibles} de {deTrabajo.length}{" "}
          {deTrabajo.length === 1 ? "carpeta visible" : "carpetas visibles"} para el
          cliente.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/t/${datos.cliente.token}`}
            className="inline-flex min-h-toque items-center bg-acento px-5 text-normal font-bold
                       tracking-tight text-white transition-colors hover:bg-acento-hover"
          >
            Ver el portal como el cliente
          </Link>
          {datos.cliente.enlaceDrive && (
            <a
              href={datos.cliente.enlaceDrive}
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

      <section className="mt-8">
        <h2 className="text-titulo font-extrabold tracking-tight">Carpetas de trabajo</h2>
        <p className="mt-1 text-menudo text-apagado">
          Aparecen solas al crearlas en Drive. Se muestran por defecto; ocultar es la
          acción deliberada.
        </p>

        {deTrabajo.length === 0 ? (
          <p className="mt-5 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-normal text-espera">
            La carpeta de este cliente no tiene ninguna carpeta adentro todavía.
          </p>
        ) : (
          <ul className="mt-5 border-t border-linea">
            {deTrabajo.map((carpeta) => (
              <FilaDeCarpeta
                key={carpeta.id}
                carpeta={carpeta}
                clienteId={datos.cliente.id}
              />
            ))}
          </ul>
        )}
      </section>

      {reservadas.length > 0 && (
        <section className="mt-10">
          <h2 className="text-titulo font-extrabold tracking-tight">
            Carpetas con nombre reservado
          </h2>
          <p className="mt-1 text-menudo text-apagado">
            No son trabajos y no se configuran. El cliente no las revisa como piezas.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {reservadas.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-hueco/60 px-4 py-3"
              >
                <span className="font-bold">{c.nombre}</span>
                <span className="text-menudo text-apagado">
                  Acá se mueve lo aprobado
                  {c.enlaceDrive && (
                    <>
                      {" · "}
                      <a
                        href={c.enlaceDrive}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-semibold text-tinta underline underline-offset-2"
                      >
                        abrir en Drive
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
