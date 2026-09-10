// La portada de gestión: los clientes, como un árbol que se abre.
//
// La lista **se descubre**, no se carga: son las carpetas que alguien le
// compartió al robot desde Drive. Compartir es el único trámite; a partir de
// ahí el cliente aparece solo, con su link ya generado.

import { panelDeClientes } from "@/admin/datos/carpetas";
import { ArbolDeClientes } from "@/admin/ArbolDeClientes";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { elEquipo } from "@/lib/equipo";

export const dynamic = "force-dynamic";

export default async function Clientes() {
  let clientes;
  try {
    clientes = await panelDeClientes();
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  const equipo = await elEquipo();
  const conAcceso = clientes.filter((c) => c.habilitado).length;
  const sinClave = clientes.filter((c) => c.habilitado && !c.tag.trim()).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <h1 className="text-grande font-extrabold tracking-tight">Clientes</h1>
        <p className="mt-2 text-normal text-tinta-suave">
          {clientes.length === 0
            ? "Todavía no hay ninguna carpeta compartida con el robot."
            : `${conAcceso} de ${clientes.length} con acceso al portal.`}
        </p>
      </header>

      {sinClave > 0 && (
        <p className="mt-6 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-normal text-espera">
          {sinClave === 1 ? "Hay un cliente" : `Hay ${sinClave} clientes`} sin clave.
          Su link no deja entrar a nadie hasta que se la pongas, en Configuración.
        </p>
      )}

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
        <div className="mt-6">
          <p className="mb-2 text-menudo text-apagado">
            Tocá la flecha para ver qué hay adentro. <strong>Configuración</strong> abre
            lo que se puede cambiar.
          </p>
          <ArbolDeClientes clientes={clientes} equipo={equipo} />
        </div>
      )}

      <section className="mt-10 border-l-4 border-linea bg-hueco/50 px-5 py-4">
        <h2 className="text-guia font-bold tracking-tight">Cómo se agrega un cliente</h2>
        <p className="mt-2 max-w-2xl text-normal text-tinta-suave">
          Se le comparte su carpeta al robot desde Drive y listo: aparece acá solo, con
          acceso dado y su link generado. Después le ponés la clave y ya puede entrar.
        </p>
      </section>
    </main>
  );
}
