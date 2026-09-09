// La portada de gestión: los clientes.
//
// La lista **se descubre**, no se carga: son las carpetas que alguien le
// compartió al robot desde Drive. Compartir es el único trámite; a partir de
// ahí el cliente aparece solo, con su link ya generado.

import { panelDeClientes } from "@/admin/datos/carpetas";
import { FilaDeCliente } from "@/admin/FilaDeCliente";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";

export const dynamic = "force-dynamic";

export default async function Clientes() {
  let clientes;
  try {
    clientes = await panelDeClientes();
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  const conAcceso = clientes.filter((c) => c.habilitado).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <h1 className="text-grande font-extrabold tracking-tight">Clientes</h1>
        <p className="mt-2 text-normal text-tinta-suave">
          {clientes.length === 0
            ? "Todavía no hay ninguna carpeta compartida con el robot."
            : `${conAcceso} de ${clientes.length} con acceso al portal.`}
        </p>
      </header>

      {clientes.length === 0 ? (
        <div className="mt-8 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4">
          <p className="text-normal font-semibold text-espera">
            Para que aparezca un cliente, compartile su carpeta al robot desde Drive.
          </p>
          <p className="mt-2 text-menudo text-espera">
            Clic derecho en la carpeta → Compartir → pegar la dirección del robot →
            permiso de Editor.
          </p>
        </div>
      ) : (
        <ul className="mt-6 border-t border-linea">
          {clientes.map((cliente) => (
            <FilaDeCliente key={cliente.id} cliente={cliente} />
          ))}
        </ul>
      )}

      <section className="mt-10 border-l-4 border-linea bg-hueco/50 px-5 py-4">
        <h2 className="text-guia font-bold tracking-tight">Cómo se agrega un cliente</h2>
        <p className="mt-2 max-w-2xl text-normal text-tinta-suave">
          Se le comparte su carpeta al robot desde Drive y listo: aparece acá solo, con
          acceso dado y su link generado. Sacarle el acceso es lo que hay que hacer a
          propósito.
        </p>
        <p className="mt-2 max-w-2xl text-menudo text-apagado">
          <strong>Quitar acceso</strong> apaga el portal de ese cliente sin tocar Drive:
          el robot sigue viendo la carpeta pero no la sirve. Para cortar de raíz, dejá de
          compartirle la carpeta en Drive.
        </p>
      </section>
    </main>
  );
}
