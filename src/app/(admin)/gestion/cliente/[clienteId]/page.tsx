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
import { BotonEnlace } from "@/ui/Boton";

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
    return <ErrorDeDrive error={error} titulo="El cliente" />;
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
              <BotonEnlace
                variante="principal"
                href={`/t/${cliente.token}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Ver el portal como el cliente
              </BotonEnlace>
              {cliente.enlaceDrive && (
                <BotonEnlace
                  href={cliente.enlaceDrive}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Abrir la carpeta en Drive
                </BotonEnlace>
              )}
              {/* Todo lo que le pasó a cada pieza, para una planilla. Pasa por
                  nuestro servidor, que es quien sabe si este cliente es tuyo. */}
              <BotonEnlace href={`/api/historial/${cliente.id}`} download>
                Descargar historial (CSV)
              </BotonEnlace>
            
          </>
        }
      />
      {numeros && <Numeros de={numeros} />}

      {/* Abierto de entrada: esta pantalla es de un cliente solo, y llegar
          acá y tener que abrirlo otra vez —debajo de su nombre, que ya está
          en el encabezado— es un toque para pedir lo que se vino a ver. */}
      <div className="mt-6">
        <ArbolDeClientes clientes={[cliente]} equipo={equipo} abiertoDeEntrada />
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
