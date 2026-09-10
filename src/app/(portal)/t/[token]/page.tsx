// El portal, como lo ve el cliente.
//
// El link puede llevar a dos lados y la pantalla es la misma:
//
//   - **Link del cliente**: todas sus carpetas visibles.
//   - **Link de una carpeta**: esa sola. Sirve para mandarle «Calendario
//     septiembre» sin que de paso vea «Rediseño de identidad».
//
// Antes de mostrar nada se pide el tag. El link es la mitad del acceso —96
// bits al azar— y el tag es la otra: es lo que hace que un link reenviado sin
// querer no alcance.

import { cookies } from "next/headers";
import { galletaValida, nombreDeGalleta, puertaDe } from "@/lib/acceso";
import { portalDelCliente } from "@/portal/datos/cliente";
import { Portal } from "@/portal/Portal";
import { Puerta } from "@/portal/Puerta";

export const dynamic = "force-dynamic";

export default async function Entrega({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;

  const puerta = await puertaDe(token);

  // No se distingue «este link no existe» de «este cliente está apagado»:
  // decirlo confirmaría cuál de las dos cosas es.
  if (!puerta) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md">
          <h1 className="text-titulo font-extrabold tracking-tight">
            Este link no está disponible
          </h1>
          <p className="mt-3 text-normal text-tinta-suave">
            Puede que haya cambiado. Pedile uno nuevo a la agencia.
          </p>
        </div>
      </div>
    );
  }

  const galletas = await cookies();
  const galleta = galletas.get(await nombreDeGalleta(token))?.value;
  if (!(await galletaValida(token, galleta))) return <Puerta token={token} />;

  let datos;
  try {
    datos = await portalDelCliente(
      puerta.cliente.id,
      puerta.tipo === "carpeta" ? puerta.carpetaId : undefined
    );
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

  return <Portal datos={datos} />;
}
