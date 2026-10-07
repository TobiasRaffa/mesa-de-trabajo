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

import { todosMisClientes } from "@/admin/datos/clientes";
import { EncabezadoDePagina, PANTALLA } from "@/admin/EncabezadoDePagina";
import { ClavesDeClientes } from "@/admin/ClavesDeClientes";
import { Plegable } from "@/admin/Plegable";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { FilaDePersona, SumarPersona } from "@/admin/Equipo";
import { correoConfigurado } from "@/lib/correo";
import { codigoDeAltaDe, codigoLegible, elEquipo } from "@/lib/equipo";
import { tieneClave } from "@/lib/claves";
import { quienesNoPuedenEntrar } from "@/lib/olvidos";
import { enCastellano } from "@/dominio/texto";

export const dynamic = "force-dynamic";

export default async function Admin() {
  let clientes;
  let gente;
  try {
    [clientes, gente] = await Promise.all([todosMisClientes(), elEquipo()]);
  } catch (error) {
    return <ErrorDeDrive error={error} titulo="Admin" />;
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

  // El código con el que entra cada persona que todavía no tiene contraseña.
  // Se lee acá y no viaja en `Persona`: esta pantalla es de Admin, y es la
  // única que lo muestra.
  const codigos = new Map<string, string | null>(
    await Promise.all(
      gente
        .filter((p) => !conClave.has(p.id))
        .map(async (p): Promise<[string, string | null]> => {
          const codigo = await codigoDeAltaDe(p.id);
          return [p.id, codigo ? codigoLegible(codigo) : null];
        })
    )
  );

  const hayCorreo = correoConfigurado();
  const sinCorreo = gente.filter((p) => !p.correo).length;
  const sinClave = clientes.filter((c) => !c.tag).length;
  const sinEntrar = gente.filter((p) => !conClave.has(p.id)).length;
  const pidieron = Object.keys(esperando).length;
  // Con nombre: «Nari y Tomás pidieron…» se lee y se actúa; «2 personas
  // pidieron…» obliga a recorrer la lista buscando cuáles.
  const quienesPiden = enCastellano(
    gente.filter((p) => esperando[p.id]).map((p) => p.nombre)
  );

  // **El resumen de un plegable existe para no tener que abrirlo.** Decían «1
  // cliente» y «3 personas», que es el largo de la lista: un dato que no
  // decide nada. Lo que decide si hay que abrir es si falta una clave —sin
  // tag el portal de ese cliente no deja pasar a nadie, ni con el link
  // correcto— y si alguien está esperando que le reinicien la suya.
  const resumenDeClaves =
    sinClave > 0 ? `${sinClave} sin clave` : clientes.length === 0 ? "sin clientes" : "todas puestas";

  const resumenDelEquipo =
    [
      pidieron > 0 && `${pidieron} pidió contraseña`,
      sinCorreo > 0 && `${sinCorreo} sin correo`,
      sinEntrar > 0 && `${sinEntrar} todavía no ${sinEntrar === 1 ? "entró" : "entraron"}`,
    ]
      .filter((x): x is string => Boolean(x))
      .join(" · ") || "todo en orden";

  return (
    <main className={PANTALLA}>
      {/* Sin bajada: decía «las claves de los clientes, quiénes son del
          equipo y a qué parte entra cada uno», que son los dos títulos que
          están tres centímetros más abajo, con las mismas palabras. */}
      <EncabezadoDePagina titulo="Admin" />

      {/* ------------------------- Claves de los clientes ----------------- */}
      <div className="mt-10 border-t border-linea pt-5">
      {/* **Cerradas de entrada, siempre.** Se abrían solas y recordaban si
          quedaron abiertas; se pidió que no: Admin se abre a hacer una cosa,
          y los dos títulos con su resumen alcanzan para elegir cuál. */}
      <Plegable
        titulo="Claves de los clientes"
        resumen={resumenDeClaves}
      >
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
        resumen={resumenDelEquipo}
      >

        {/* **Nombradas, y con el botón al lado.** Decía «están marcadas en la
            lista» y mandaba a entrar a «Editar»: dos clics por persona para
            llegar a un botón que ahora está en su propia fila. */}
        {pidieron > 0 && (
          <div className="mt-4 border-l-4 border-alerta bg-alerta-tenue px-5 py-4">
            <p className="text-normal font-semibold text-alerta">
              {pidieron === 1
                ? `${quienesPiden} no puede entrar y pidió que le reinicien la contraseña.`
                : `${quienesPiden} pidieron que les reinicien la contraseña.`}
            </p>
            <p className="mt-1 text-menudo text-alerta">
              En su fila está «Reiniciar contraseña»: eligen una nueva la
              próxima vez que entren.
            </p>
          </div>
        )}

        {!hayCorreo && (
          <p className="mt-4 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-normal font-semibold text-espera">
            Los avisos por correo todavía no están prendidos.
          </p>
        )}

        {/* **Sin correo no entran**, que es bastante peor que «no les llega
            nada»: entrar busca por correo. Y estaba adentro del `hayCorreo`,
            así que con los avisos apagados no se decía nunca. */}
        {sinCorreo > 0 && (
          <p className="mt-4 border-l-4 border-alerta bg-alerta-tenue px-5 py-4 text-menudo font-semibold text-alerta">
            {sinCorreo === 1
              ? "1 persona sin correo: no puede entrar."
              : `${sinCorreo} personas sin correo: no pueden entrar.`}
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
                codigoDeAlta={codigos.get(persona.id) ?? null}
                pidioOtraClave={Boolean(esperando[persona.id])}
                // Para poder elegir a cuáles llega. Va el nombre porque el
                // identificador de Drive no le dice nada a nadie.
                clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
              />
            ))}
          </ul>
        )}

        <SumarPersona clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      </Plegable>
      </div>
    </main>
  );
}
