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
      </header>

      {!hayCorreo && (
        <div className="mt-6 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4">
          <p className="text-normal font-semibold text-espera">
            Los avisos por correo todavía no están prendidos.
          </p>
        </div>
      )}

      {hayCorreo && sinCorreo > 0 && (
        <p className="mt-6 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-menudo font-semibold text-espera">
          {sinCorreo} sin correo: no les llega nada.
        </p>
      )}

      {gente.length === 0 ? (
        <p className="mt-8 text-normal text-apagado">Todavía no hay nadie.</p>
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
