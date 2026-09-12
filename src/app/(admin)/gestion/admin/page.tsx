// Lo que se configura una vez y después casi no se toca.
//
// Dos cosas que no son trabajo de todos los días y que antes estaban repartidas:
// las claves con las que entran los clientes —que vivían arriba de todo en la
// ficha de cada cliente, empujando hacia abajo lo que sí se usa a diario— y el
// equipo, que tenía su propia sección al lado de «Clientes» sin merecer ese
// peso.
//
// Juntas y abajo del todo en la barra: se las busca cuando se las necesita, y
// mientras tanto no ocupan lugar.

import { todosLosClientes } from "@/lib/clientes";
import { ClavesDeClientes } from "@/admin/ClavesDeClientes";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { FilaDePersona, SumarPersona } from "@/admin/Equipo";
import { correoConfigurado } from "@/lib/correo";
import { elEquipo } from "@/lib/equipo";

export const dynamic = "force-dynamic";

export default async function Admin() {
  let clientes;
  let gente;
  try {
    [clientes, gente] = await Promise.all([todosLosClientes(), elEquipo()]);
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  const hayCorreo = correoConfigurado();
  const sinCorreo = gente.filter((p) => !p.correo).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <h1 className="text-grande font-extrabold tracking-tight">Admin</h1>
        <p className="mt-1 text-menudo text-apagado">
          Lo que se configura una vez: las claves de los clientes y quiénes son
          del equipo.
        </p>
      </header>

      {/* ------------------------- Claves de los clientes ----------------- */}
      <section className="mt-10">
        <h2 className="text-guia font-extrabold tracking-tight">
          Claves de los clientes
        </h2>
        <p className="mt-1 text-menudo text-apagado">
          Es la palabra que el cliente escribe después de abrir su link. Se la
          pasás por donde le escribís siempre, nunca dentro del mismo mensaje que
          el link: si van juntos, alcanza con que ese mensaje se reenvíe.
          Para verla o cambiarla hace falta la contraseña del equipo.
        </p>
        {/* Solo se manda **si tiene** clave, no cuál. El texto lo pide la
            pantalla aparte, con la contraseña del equipo. */}
        <ClavesDeClientes
          clientes={clientes.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            tieneClave: Boolean(c.tag),
          }))}
        />
      </section>

      {/* -------------------------------- El equipo ----------------------- */}
      <section className="mt-14">
        <h2 className="text-guia font-extrabold tracking-tight">El equipo</h2>
        <p className="mt-1 text-menudo text-apagado">
          Un nombre para poder asignarle un trabajo y un correo para poder
          avisarle.
        </p>

        {!hayCorreo && (
          <p className="mt-4 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-normal font-semibold text-espera">
            Los avisos por correo todavía no están prendidos.
          </p>
        )}

        {hayCorreo && sinCorreo > 0 && (
          <p className="mt-4 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-menudo font-semibold text-espera">
            {sinCorreo} sin correo: no les llega nada.
          </p>
        )}

        {gente.length === 0 ? (
          <p className="mt-6 text-normal text-apagado">Todavía no hay nadie.</p>
        ) : (
          <ul className="mt-6 border-t border-linea">
            {gente.map((persona) => (
              <FilaDePersona key={persona.id} persona={persona} />
            ))}
          </ul>
        )}

        <SumarPersona />
      </section>
    </main>
  );
}
