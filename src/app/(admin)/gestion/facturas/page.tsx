// Las facturas, del lado de la agencia.
//
// Es la otra mitad de una regla que ya existía a medias: «Facturas» estaba
// marcada como carpeta reservada y el cliente no la veía —bien—, pero la
// agencia tampoco tenía dónde mirarla, así que en la práctica esa carpeta de
// Drive no existía para la aplicación. Ahora existe, de un solo lado.
//
// Va abajo del todo en la barra, con Admin: no es trabajo de todos los días.
//
// **Se dibujan los clientes que tienen algo.** Se recorría la lista entera:
// con diez clientes y ninguna factura, la pantalla decía cuatro veces lo mismo
// —la bajada, el cartel global, y después un encabezado por cliente con su
// «No tiene carpeta «Facturas» en Drive.» debajo—. Los que no tienen nada se
// cuentan en una línea al pie, que es todo lo que hay que saber de ellos.

import { EncabezadoDePagina, PANTALLA } from "@/admin/EncabezadoDePagina";
import { lasFacturas } from "@/admin/datos/facturas";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { IconoDrive } from "@/ui/Icono";
import { enPalabrasConAnio } from "@/dominio/tiempo";

export const dynamic = "force-dynamic";

const enPalabras = (iso: string | undefined) => (iso ? enPalabrasConAnio(iso) : "");

const A_DRIVE =
  "inline-flex items-center gap-1.5 text-micro font-extrabold uppercase tracking-wider " +
  "text-apagado transition-colors hover:text-tinta";

export default async function Facturas() {
  let clientes;
  try {
    clientes = await lasFacturas();
  } catch (error) {
    return <ErrorDeDrive error={error} titulo="Facturas" />;
  }

  // Los que tienen algo que mirar, y los que Drive no contestó: un fallo no es
  // lo mismo que no tener facturas, así que se muestra igual.
  const conAlgo = clientes.filter((c) => c.facturas.length > 0 || c.fallo);
  const sinNada = clientes.filter((c) => c.facturas.length === 0 && !c.fallo);

  return (
    <main className={PANTALLA}>
      <EncabezadoDePagina
        titulo="Facturas"
        bajada="Lo que hay en la carpeta «Facturas» de cada cliente, en Drive. El cliente no las ve."
      />

      {conAlgo.length === 0 ? (
        <div className="mt-8">
          <p className="text-normal text-apagado">
            Todavía no hay ninguna factura. Aparecen solas cuando subís archivos
            a una carpeta llamada «Facturas» adentro de la carpeta de un
            cliente.
          </p>
          {/* Sin esto, la pantalla decía que falta algo y no daba a dónde ir a
              hacerlo: la carpeta se crea en Drive, no acá. */}
          <ul className="mt-4 flex flex-col gap-1">
            {sinNada.map((c) => (
              <li key={c.clienteId} className="flex flex-wrap items-baseline gap-3">
                <span className="font-bold tracking-tight">{c.cliente}</span>
                {c.carpetaDelCliente && (
                  <a
                    href={c.carpetaDelCliente}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={A_DRIVE}
                  >
                    <IconoDrive />
                    Abrir la carpeta en Drive
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <ul className="mt-8 flex flex-col gap-10">
            {conAlgo.map((c) => (
              <li key={c.clienteId}>
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-tinta pb-2">
                  <h2 className="text-guia font-extrabold tracking-tight">{c.cliente}</h2>
                  {(c.enlaceDrive ?? c.carpetaDelCliente) && (
                    <a
                      href={c.enlaceDrive ?? c.carpetaDelCliente}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={A_DRIVE}
                    >
                      <IconoDrive />
                      Abrir en Drive
                    </a>
                  )}
                </div>

                {c.fallo ? (
                  <p className="mt-3 border-l-4 border-alerta bg-alerta-tenue px-4 py-3 text-menudo font-semibold text-alerta">
                    No pude leer Drive para este cliente. No quiere decir que no
                    tenga facturas: quiere decir que no sé.
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
                        {/* **Un `<a download>`, no un `<Link>`.** Next se trae
                            de antemano lo que enlaza un `<Link>` apenas entra
                            en pantalla: con doce facturas a la vista, se
                            bajaban las doce de Drive sin que nadie tocara
                            nada. Pasa por nuestro servidor igual, que es lo
                            que hace que el permiso viva en un solo lugar. */}
                        <a
                          href={`/api/archivo/${f.id}`}
                          download
                          className="shrink-0 text-micro font-extrabold uppercase tracking-wider
                                     text-acento underline underline-offset-4"
                        >
                          Descargar
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {sinNada.length > 0 && (
            <p className="mt-10 border-t border-linea pt-4 text-menudo text-apagado">
              {sinNada.length === 1
                ? `${sinNada[0].cliente} no tiene facturas en Drive.`
                : `Otros ${sinNada.length} clientes no tienen facturas en Drive.`}
            </p>
          )}
        </>
      )}
    </main>
  );
}
