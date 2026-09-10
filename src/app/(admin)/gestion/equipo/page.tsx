// El equipo: quiénes son y a dónde les llegan los avisos.
//
// Es una lista corta y a mano. No hay roles ni permisos todavía; eso llega con
// los usuarios de verdad. Lo que hay es lo que hace falta hoy: un nombre para
// asignarle un trabajo y un correo para avisarle.

import { elEquipo } from "@/lib/equipo";
import { correoConfigurado } from "@/lib/correo";
import { FilaDePersona, SumarPersona } from "@/admin/Equipo";

export const dynamic = "force-dynamic";

export default async function EquipoPagina() {
  const gente = await elEquipo();
  const hayCorreo = correoConfigurado();
  const sinCorreo = gente.filter((p) => !p.correo).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <h1 className="text-grande font-extrabold tracking-tight">El equipo</h1>
        <p className="mt-2 text-normal text-tinta-suave">
          A quién se le puede asignar un trabajo, y a dónde le llegan los avisos.
        </p>
      </header>

      {!hayCorreo && (
        <div className="mt-6 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4">
          <p className="text-normal font-semibold text-espera">
            Los avisos por correo todavía no están prendidos.
          </p>
          <p className="mt-2 text-menudo text-espera">
            Mientras tanto todo queda anotado en la bandeja del tablero, que es donde se
            ve igual. Para prenderlos hacen falta dos datos de una cuenta de correo, y se
            configuran una sola vez.
          </p>
        </div>
      )}

      {hayCorreo && sinCorreo > 0 && (
        <p className="mt-6 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-menudo text-espera">
          {sinCorreo} {sinCorreo === 1 ? "persona no tiene" : "personas no tienen"} correo
          cargado: a {sinCorreo === 1 ? "esa persona" : "esas personas"} no le llega nada.
        </p>
      )}

      {gente.length === 0 ? (
        <p className="mt-8 border-l-4 border-linea bg-hueco/50 px-4 py-3 text-normal text-tinta-suave">
          Todavía no hay nadie cargado. Sumá a quien lleve los trabajos.
        </p>
      ) : (
        <ul className="mt-8 border-t border-linea">
          {gente.map((persona) => (
            <FilaDePersona key={persona.id} persona={persona} />
          ))}
        </ul>
      )}

      <SumarPersona />
    </main>
  );
}
