// El portal, como lo ve el cliente.
//
// Esta parte corre en el servidor: resuelve de qué cliente es el link, lee su
// carpeta en Drive y arma la estructura. La parte que responde a los clics vive
// en `Portal`, del lado del navegador. Es la división de siempre: el servidor
// trae, el navegador interactúa.
//
// **El link es la mitad del acceso.** Son 96 bits al azar: adivinarlo probando
// no es una estrategia. La otra mitad —pedirle al cliente su tag— llega cuando
// exista la base de datos.

import { clientePorToken, clientesHabilitados } from "@/lib/clientes";
import { portalDelCliente } from "@/portal/datos/cliente";
import { Portal } from "@/portal/Portal";

export const dynamic = "force-dynamic";

/** Una pantalla de «acá no hay nada», sin explicar por qué. */
function NoHayNada({ titulo, bajada }: { titulo: string; bajada: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md">
        <h1 className="text-titulo font-extrabold tracking-tight">{titulo}</h1>
        <p className="mt-3 text-normal text-tinta-suave">{bajada}</p>
      </div>
    </div>
  );
}

export default async function Entrega({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;

  let cliente = await clientePorToken(token);

  // Mientras se trabaja en la máquina, un link que no existe cae en el primer
  // cliente habilitado. Es lo que hace que el acceso directo del escritorio
  // siga sirviendo sin tener que copiar un link cada vez.
  //
  // **En producción no pasa**: ahí un link que no vale es un link que no vale.
  const deConveniencia = !cliente && process.env.NODE_ENV !== "production";
  if (deConveniencia) {
    try {
      cliente = (await clientesHabilitados())[0] ?? null;
    } catch {
      cliente = null;
    }
  }

  if (!cliente) {
    // No se distingue «este link no existe» de «este cliente está apagado»:
    // decirlo confirmaría cuál de las dos cosas es.
    return (
      <NoHayNada
        titulo="Este link no está disponible"
        bajada="Puede que haya cambiado. Pedile uno nuevo a la agencia."
      />
    );
  }

  let datos;
  try {
    datos = await portalDelCliente(cliente.id);
  } catch (error) {
    // El detalle **no** se le muestra al cliente: los mensajes de Google traen
    // identificadores de carpeta y a veces la dirección del robot, y esta
    // pantalla la abre gente de afuera de la agencia. El detalle va al registro
    // del servidor, donde lo lee quien tiene que leerlo.
    console.error("No se pudo armar el portal del cliente:", error);

    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-lg">
          <h1 className="text-titulo font-extrabold tracking-tight">
            No pudimos abrir la carpeta
          </h1>
          <p className="mt-3 text-normal text-tinta-suave">
            Es un problema nuestro, no tuyo. Avisale al equipo y lo resuelven; tu
            trabajo no se perdió.
          </p>
          {process.env.NODE_ENV !== "production" && (
            <p className="mt-4 border-l-4 border-alerta bg-alerta-tenue px-4 py-3 font-mono text-menudo text-alerta">
              {error instanceof Error ? error.message : "Error desconocido"}
              <span className="mt-2 block font-sans opacity-70">
                Esto solo se ve mientras se trabaja en la aplicación.
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {deConveniencia && (
        <p className="bg-espera-tenue px-5 py-2 text-center text-menudo font-semibold text-espera">
          Ese link no existe, así que estás viendo el primer cliente. Solo pasa mientras
          la aplicación corre en tu computadora.
        </p>
      )}
      <Portal datos={datos} />
    </>
  );
}
