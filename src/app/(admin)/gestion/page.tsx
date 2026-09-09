// La app de gestión: lo que configura la agencia.
//
// Por ahora hace una sola cosa, que es la que hacía falta primero: decidir qué
// carpetas ve el cliente y cuáles se miran como calendario. Todo lo demás
// —clientes, plazos, facturación, roles— se agrega acá cuando exista la base
// de datos.

import Link from "next/link";
import { carpetasDelCliente } from "@/admin/datos/carpetas";
import { FilaDeCarpeta } from "@/admin/FilaDeCarpeta";

export const dynamic = "force-dynamic";

export default async function Gestion() {
  let datos;
  try {
    datos = await carpetasDelCliente();
  } catch (error) {
    // Acá sí se muestra el detalle: esta pantalla la ve la agencia, y es
    // justamente quien tiene que enterarse de qué está mal.
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-grande font-extrabold tracking-tight">No pude leer Drive</h1>
        <p className="mt-4 border-l-4 border-alerta bg-alerta-tenue px-4 py-3 font-mono text-menudo text-alerta">
          {error instanceof Error ? error.message : "Error desconocido"}
        </p>
        <p className="mt-4 text-normal text-tinta-suave">
          Suele ser que la carpeta del cliente todavía no está compartida con el robot,
          o que cambió su dirección.
        </p>
      </main>
    );
  }

  const deTrabajo = datos.carpetas.filter((c) => !c.reservada);
  const reservadas = datos.carpetas.filter((c) => c.reservada);
  const visibles = deTrabajo.filter((c) => c.visible).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <p className="text-micro font-extrabold uppercase tracking-widest text-apagado">
          Cliente
        </p>
        <h1 className="mt-1 text-grande font-extrabold tracking-tight">
          {datos.cliente.nombre}
        </h1>
        <p className="mt-2 text-normal text-tinta-suave">
          {visibles} de {deTrabajo.length}{" "}
          {deTrabajo.length === 1 ? "carpeta visible" : "carpetas visibles"} para el
          cliente.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/t/demo"
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
          <Link
            href="/diagnostico"
            className="inline-flex min-h-toque items-center px-5 text-normal font-bold
                       tracking-tight text-apagado underline underline-offset-4 transition-colors hover:text-tinta"
          >
            Diagnóstico
          </Link>
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
            La carpeta del cliente no tiene ninguna carpeta adentro todavía.
          </p>
        ) : (
          <ul className="mt-5 border-t border-linea">
            {deTrabajo.map((carpeta) => (
              <FilaDeCarpeta key={carpeta.id} carpeta={carpeta} />
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

      <section className="mt-12 border-t border-linea pt-6">
        <h2 className="text-guia font-bold tracking-tight">Cómo se marca una vuelta nueva</h2>
        <p className="mt-2 max-w-2xl text-normal text-tinta-suave">
          Con el nombre del archivo, en Drive. Al final del nombre se agrega{" "}
          <code className="bg-hueco px-1.5 py-0.5 font-mono text-menudo">V2</code>, y para
          la siguiente <code className="bg-hueco px-1.5 py-0.5 font-mono text-menudo">V3</code>.
          El original no lleva nada.
        </p>
        <pre className="mt-3 overflow-x-auto bg-tinta px-4 py-3 font-mono text-menudo text-lienzo">
{`9304.jpeg       ← primera versión
9304 V2.jpeg    ← segunda vuelta de la MISMA pieza
9304 V3.jpeg    ← tercera`}
        </pre>
        <p className="mt-3 max-w-2xl text-menudo text-apagado">
          Se juntan en una sola pieza, el cliente ve la última y le aparece el botón para
          compararla con la anterior. La extensión cuenta:{" "}
          <code className="font-mono">9304.jpg</code> y{" "}
          <code className="font-mono">9304.png</code> son dos piezas distintas, no dos
          vueltas.
        </p>
      </section>

      <p className="mt-10 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-menudo text-espera">
        Esta pantalla todavía no pide usuario ni contraseña. Alcanza mientras la
        aplicación corre en tu computadora y no está en internet. Antes de subirla hay
        que ponerle login.
      </p>
    </main>
  );
}
