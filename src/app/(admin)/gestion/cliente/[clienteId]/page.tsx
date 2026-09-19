// Un cliente solo: sus carpetas y sus mensajes listos.
//
// Es la misma pantalla de Clientes pero mirando a uno, con los mensajes para
// copiar debajo. Usa **el mismo árbol** a propósito: dos formas distintas de
// configurar lo mismo terminan divergiendo, y la que se usa menos queda vieja.

import { EncabezadoDePagina, PANTALLA } from "@/admin/EncabezadoDePagina";
import { panelDeClientes } from "@/admin/datos/carpetas";
import { contenidoDe, heredadoDelCliente } from "@/admin/datos/arbol";
import { ArbolDeClientes } from "@/admin/ArbolDeClientes";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { MensajesListos } from "@/admin/MensajesListos";
import { ChatDeCliente } from "@/admin/ChatDeCliente";
import { elEquipo } from "@/lib/equipo";
import { comoMePresentoEnElChat } from "@/lib/sesion";
import { estadisticasDe, type Estadisticas } from "@/admin/datos/estadisticas";

export const dynamic = "force-dynamic";

export default async function UnCliente({
  params,
}: PageProps<"/gestion/cliente/[clienteId]">) {
  const { clienteId } = await params;

  let cliente;
  let carpetas;
  let equipo;
  let numeros: Estadisticas | null = null;
  try {
    const todos = await panelDeClientes();
    cliente = todos.find((c) => c.id === clienteId);
    if (!cliente) throw new Error("No encontre ese cliente.");
    [carpetas, equipo, numeros] = await Promise.all([
      contenidoDe(clienteId, await heredadoDelCliente(clienteId)).then((c) => c.carpetas),
      elEquipo(),
      // Los números no pueden tirar abajo la pantalla: sin ellos, se muestra igual.
      estadisticasDe(clienteId).catch(() => null),
    ]);
  } catch (error) {
    return <ErrorDeDrive error={error} />;
  }

  // La primera carpeta de trabajo visible: es de la que se suele hablar, y la
  // que se nombra en los mensajes listos.
  const principal = carpetas.find((c) => !c.reservada && c.visible);

  return (
    <main className={PANTALLA}>
      <EncabezadoDePagina
        volver={{ href: "/gestion", texto: "Clientes" }}
        titulo={cliente.nombre}
        acciones={
          <>
              {/*
                Se abre en una pestana nueva a proposito. Asi esta pantalla queda
                atras -entrar al portal no tenia vuelta- y el portal no lleva
                ningun link de vuelta a administracion: eso seria una puerta de un
                mundo al otro, y la veria tambien el cliente.
              */}
              <a
                href={`/t/${cliente.token}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-toque items-center rounded-full bg-acento px-6 text-normal font-bold
                           tracking-tight text-white transition-colors hover:bg-acento-hover"
              >
                Ver el portal como el cliente
              </a>
              {cliente.enlaceDrive && (
                <a
                  href={cliente.enlaceDrive}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-toque items-center rounded-full border-2 border-tinta px-6
                             text-normal font-bold tracking-tight text-tinta transition-colors hover:bg-hueco"
                >
                  Abrir la carpeta en Drive
                </a>
              )}
              {/* Todo lo que le pasó a cada pieza, para una planilla. Pasa por
                  nuestro servidor, que es quien sabe si este cliente es tuyo. */}
              <a
                href={`/api/historial/${cliente.id}`}
                className="inline-flex min-h-toque items-center rounded-full border-2 border-tinta px-6
                           text-normal font-bold tracking-tight text-tinta transition-colors hover:bg-hueco"
              >
                Descargar historial (CSV)
              </a>
            
          </>
        }
      />
      {numeros && <Numeros de={numeros} />}

      <div className="mt-6">
        <ArbolDeClientes clientes={[cliente]} equipo={equipo} />
      </div>

      <MensajesListos
        datos={{
          cliente: cliente.nombre,
          carpeta: principal?.nombre ?? "lo nuevo",
          link: `/t/${cliente.token}`,
          pendientes: principal?.sinRevisar,
        }}
        alLado={
          <ChatDeCliente
            clienteId={cliente.id}
            nombre={cliente.nombre}
            sinLeer={cliente.sinLeer}
            firma={await comoMePresentoEnElChat()}
          />
        }
      />
    </main>
  );
}

/**
 * Cómo viene la cuenta, de un vistazo. Lo que se pregunta al presupuestar:
 * cuántas vueltas por pieza, cuántas de más, cuánto tarda en decidir.
 */
function Numeros({ de }: { de: Estadisticas }) {
  const tiles: Array<{ cifra: string; que: string }> = [
    { cifra: String(de.piezas), que: de.piezas === 1 ? "pieza" : "piezas" },
    { cifra: String(de.aprobadas), que: de.aprobadas === 1 ? "aprobada" : "aprobadas" },
    { cifra: String(de.enJuego), que: "en juego" },
    { cifra: String(de.vueltasPromedio), que: "vueltas por pieza" },
    { cifra: String(de.conMasDeDosVueltas), que: "con más de 2 vueltas" },
    { cifra: String(de.revisionesExtra), que: "revisiones extra" },
    {
      cifra: de.diasParaDecidir === null ? "—" : String(de.diasParaDecidir),
      que: "días para decidir",
    },
  ];

  return (
    <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
      {tiles.map((t) => (
        <div key={t.que} className="flex items-baseline gap-1.5">
          <dd className="cifras text-guia font-extrabold leading-none tracking-tight">{t.cifra}</dd>
          <dt className="text-micro font-semibold uppercase tracking-wider text-apagado">{t.que}</dt>
        </div>
      ))}
    </dl>
  );
}
