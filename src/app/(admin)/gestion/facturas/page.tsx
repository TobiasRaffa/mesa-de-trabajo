// Las facturas, del lado de la agencia.
//
// Es la otra mitad de una regla que ya existía a medias: «Facturas» estaba
// marcada como carpeta reservada y el cliente no la veía —bien—, pero la
// agencia tampoco tenía dónde mirarla, así que en la práctica esa carpeta de
// Drive no existía para la aplicación. Ahora existe, de un solo lado.
//
// Va abajo del todo en la barra, con Admin: no es trabajo de todos los días.

import Link from "next/link";
import { EncabezadoDePagina, PANTALLA } from "@/admin/EncabezadoDePagina";
import { lasFacturas } from "@/admin/datos/facturas";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { IconoDrive } from "@/ui/Icono";

export const dynamic = "force-dynamic";

const fecha = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function enPalabras(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : fecha.format(d);
}

export default async function Facturas() {
  let clientes;
  try {
    clientes = await lasFacturas();
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  const conAlguna = clientes.filter((c) => c.facturas.length > 0);

  return (
    <main className={PANTALLA}>
      <EncabezadoDePagina
        titulo="Facturas"
        bajada="Lo que hay en la carpeta «Facturas» de cada cliente, en Drive. El cliente no las ve: su portal las tiene negadas, no solo escondidas."
      />

      {conAlguna.length === 0 && (
        <p className="mt-8 text-normal text-apagado">
          Todavía no hay ninguna factura. Aparecen solas cuando subís archivos a
          una carpeta llamada «Facturas» adentro de la carpeta de un cliente.
        </p>
      )}

      <ul className="mt-8 flex flex-col gap-10">
        {clientes.map((c) => (
          <li key={c.clienteId}>
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-tinta pb-2">
              <h2 className="text-guia font-extrabold tracking-tight">{c.cliente}</h2>
              {c.enlaceDrive && (
                <a
                  href={c.enlaceDrive}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-micro font-extrabold
                             uppercase tracking-wider text-apagado transition-colors hover:text-tinta"
                >
                  <IconoDrive />
                  Abrir en Drive
                </a>
              )}
            </div>

            {c.fallo ? (
              <p className="mt-3 border-l-4 border-alerta bg-alerta-tenue px-4 py-3 text-menudo font-semibold text-alerta">
                No pude leer Drive para este cliente. No quiere decir que no tenga
                facturas: quiere decir que no sé.
              </p>
            ) : c.carpetaId === null ? (
              <p className="mt-3 text-menudo text-apagado">
                No tiene carpeta «Facturas» en Drive.
              </p>
            ) : c.facturas.length === 0 ? (
              <p className="mt-3 text-menudo text-apagado">
                La carpeta está, pero no tiene nada adentro.
              </p>
            ) : (
              <ul className="mt-2">
                {c.facturas.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-linea py-3"
                  >
                    <span className="min-w-0 flex-1 font-bold tracking-tight">
                      {f.nombre}
                    </span>
                    <span className="cifras shrink-0 text-menudo text-apagado">
                      {enPalabras(f.modificado)}
                    </span>
                    {/* Pasa por nuestro servidor, como todo lo demás: así el
                        permiso vive en un solo lugar y nadie necesita tener
                        acceso a la carpeta de Drive para bajarse algo. */}
                    <Link
                      href={`/api/archivo/${f.id}`}
                      className="shrink-0 text-micro font-extrabold uppercase tracking-wider
                                 text-acento underline underline-offset-4"
                    >
                      Descargar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
