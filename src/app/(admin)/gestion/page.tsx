// La portada de gestión: los clientes, como un árbol que se abre.
//
// La lista **se descubre**, no se carga: son las carpetas que alguien le
// compartió al robot desde Drive. Compartir es el único trámite; a partir de
// ahí el cliente aparece solo, con su link ya generado.

import { panelDeClientes } from "@/admin/datos/carpetas";
import { EncabezadoDePagina, PANTALLA } from "@/admin/EncabezadoDePagina";
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
  const sinClave = clientes.filter((c) => c.habilitado && !c.tieneClave).length;

  return (
    <main className={PANTALLA}>
      <EncabezadoDePagina titulo="Clientes" />

      {sinClave > 0 && (
        <p className="mt-6 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-normal font-semibold text-espera">
          {sinClave === 1 ? "Un cliente" : `${sinClave} clientes`} sin clave: su link no
          deja entrar.
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
          <ArbolDeClientes clientes={clientes} equipo={equipo} />
        </div>
      )}

    </main>
  );
}
