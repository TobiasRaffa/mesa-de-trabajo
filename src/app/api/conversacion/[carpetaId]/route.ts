// Los mensajes de una carpeta, para que la pantalla se entere de lo que dijo
// el otro lado sin que haya que recargar.
//
// Es una ruta y no una acción de servidor porque **leer no es mutar**: las
// acciones se despachan de a una por cliente, así que usarlas para preguntar
// cada pocos segundos le pondría un tapón a todo lo demás.
//
// El identificador que llega en la dirección no se cree: se compara contra las
// carpetas que de verdad existen adentro de la del cliente. Sin eso, cualquiera
// podría ir probando identificadores para ver si adivina una conversación.

import type { NextRequest } from "next/server";
import { esCarpetaDelCliente } from "@/lib/carpetas";
import { leerConversacion } from "@/lib/conversaciones";

const sinDetalle = (mensaje: string, codigo: number) =>
  new Response(mensaje, { status: codigo, headers: { "Content-Type": "text/plain" } });

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/conversacion/[carpetaId]">
) {
  const { carpetaId } = await ctx.params;

  // Igual que con los archivos: si no corresponde, se contesta como si no
  // existiera. Un 403 confirmaría que la carpeta existe.
  if (!(await esCarpetaDelCliente(carpetaId))) return sinDetalle("No encontrado", 404);

  try {
    const mensajes = await leerConversacion(carpetaId);
    return Response.json(
      { mensajes },
      // Una conversación no se cachea: el sentido de preguntar es enterarse
      // de lo último.
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return sinDetalle("No se pudo leer la conversación", 500);
  }
}
