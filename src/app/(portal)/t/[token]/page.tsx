// El portal, como lo ve el cliente.
//
// Esta parte corre en el servidor: lee la carpeta del cliente en Drive y arma
// la estructura. La parte que responde a los clics vive en `Portal`, del lado
// del navegador. Es la división de siempre: el servidor trae, el navegador
// interactúa.
//
// Todavía falta la base de datos para saber a qué cliente apunta el token y
// para pedirle el tag. La ruta, la forma y el comportamiento son los
// definitivos.

import { portalDelCliente } from "@/portal/datos/cliente";
import { Portal } from "@/portal/Portal";

export const dynamic = "force-dynamic";

export default async function Entrega() {
  let datos;
  try {
    datos = await portalDelCliente();
  } catch (error) {
    // Un problema de configuración o de Drive no puede verse como una pantalla
    // rota. Pero el detalle **no se le muestra al cliente**: los mensajes de
    // Google traen identificadores de carpeta y a veces la dirección del robot,
    // y esta pantalla la abre gente de afuera de la agencia. El detalle va al
    // registro del servidor, donde lo lee quien tiene que leerlo.
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
              <span className="mt-2 block font-sans not-italic opacity-70">
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
