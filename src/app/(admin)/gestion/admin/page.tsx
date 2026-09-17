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
import { Plegable } from "@/admin/Plegable";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { FilaDePersona, SumarPersona } from "@/admin/Equipo";
import { correoConfigurado } from "@/lib/correo";
import { elEquipo } from "@/lib/equipo";
import { tieneClave } from "@/lib/claves";
import { quienesNoPuedenEntrar } from "@/lib/olvidos";

export const dynamic = "force-dynamic";

export default async function Admin() {
  let clientes;
  let gente;
  try {
    [clientes, gente] = await Promise.all([todosLosClientes(), elEquipo()]);
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  // Quiénes ya eligieron su contraseña. Sin ella una persona existe en la
  // lista —se le asigna trabajo, le llegan los avisos— pero nunca entró, y eso
  // hay que poder verlo acá mismo.
  const conClave = new Set(
    (await Promise.all(gente.map(async (p) => ((await tieneClave(p.id)) ? p.id : null))))
      .filter((id): id is string => id !== null)
  );

  // **Quiénes dicen que no pueden entrar.** No hay correo de recuperación: el
  // pedido aparece acá y se contesta reiniciándole la contraseña, para que
  // elija una nueva. Es la única forma que hay, así que tiene que verse antes
  // de abrir nada.
  const esperando = await quienesNoPuedenEntrar();

  const hayCorreo = correoConfigurado();
  const sinCorreo = gente.filter((p) => !p.correo).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <h1 className="text-grande font-extrabold tracking-tight">Admin</h1>
        <p className="mt-1 text-menudo text-apagado">
          Lo que se configura una vez: las claves de los clientes, quiénes son
          del equipo y a qué parte entra cada uno.
        </p>
      </header>

      {/* ------------------------- Claves de los clientes ----------------- */}
      <div className="mt-10 border-t border-linea pt-5">
      <Plegable
        titulo="Claves de los clientes"
        recuerdo="admin-claves"
        resumen={`${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`}
      >
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
      </Plegable>
      </div>

      {/* -------------------------------- El equipo ----------------------- */}
      <div className="mt-8 border-t border-linea pt-5">
      <Plegable
        titulo="El equipo"
        recuerdo="admin-equipo"
        resumen={`${gente.length} ${gente.length === 1 ? "persona" : "personas"}`}
      >
        <p className="mt-1 text-menudo text-apagado">
          Esta lista es la lista de usuarios: quien está acá con un correo y un
          rol puede entrar, y quien no está no entra. La contraseña la elige cada
          una la primera vez, y no la sabe nadie más.
        </p>

        {Object.keys(esperando).length > 0 && (
          <div className="mt-4 border-l-4 border-alerta bg-alerta-tenue px-5 py-4">
            <p className="text-normal font-semibold text-alerta">
              {Object.keys(esperando).length === 1
                ? "Alguien no puede entrar y pidió que le reinicien la contraseña."
                : `${Object.keys(esperando).length} personas pidieron que les reinicien la contraseña.`}
            </p>
            <p className="mt-1 text-menudo text-alerta">
              Están marcadas en la lista. Entrá a «Editar» y tocá «Reiniciar
              contraseña»: eligen una nueva la próxima vez que entren.
            </p>
          </div>
        )}

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
              <FilaDePersona
                key={persona.id}
                persona={persona}
                tieneClave={conClave.has(persona.id)}
                pidioOtraClave={Boolean(esperando[persona.id])}
              />
            ))}
          </ul>
        )}

        <SumarPersona />
      </Plegable>
      </div>
    </main>
  );
}
