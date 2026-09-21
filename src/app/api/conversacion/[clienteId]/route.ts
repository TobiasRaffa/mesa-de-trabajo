// Los mensajes de un cliente, para que su portal se entere de lo que dijo el
// otro lado sin recargar.
//
// Es una ruta y no una acción de servidor porque **leer no es mutar**: las
// acciones se despachan de a una por cliente, así que usarlas para preguntar
// cada pocos segundos le pondría un tapón a todo lo demás.
//
// **Pide la misma galleta que el portal.** Sin eso alcanzaba con saber el
// identificador de la carpeta en Drive para leer la conversación sin haber
// escrito nunca la clave —y ese identificador lo ve cualquiera con quien la
// agencia haya compartido la carpeta—. Lo encontró una prueba a mano contra la
// ruta, no el navegador.
//
// La app de gestión no usa esta ruta: pide los mensajes por una acción de
// servidor, del lado de la agencia.

import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { quienPideDe, type Puerta } from "@/lib/permisos";
import {
  hayAnteriores,
  leerConversacion,
  leerConversacionEntera,
} from "@/lib/conversaciones";

const sinDetalle = (mensaje: string, codigo: number) =>
  new Response(mensaje, { status: codigo, headers: { "Content-Type": "text/plain" } });

/**
 * A quién sirve esta ruta.
 *
 * **Solo el cliente.** La agencia no la usa: pide los mensajes por una acción
 * de servidor, que además le marca el chat como leído. Dejarla abierta «por si
 * acaso» sería una segunda puerta a la misma conversación, con otro criterio.
 */
const PUERTA: Puerta = { agencia: null, cliente: true };

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/conversacion/[clienteId]">
) {
  const { clienteId } = await ctx.params;

  // **Por omisión se manda solo el hilo vivo.** Lo de antes se pide a mano,
  // desde «ver lo anterior»: traer tres años de charla en cada vuelta del
  // reloj sería pagar justo el precio que el techo vino a sacar.
  const entera = req.nextUrl.searchParams.get("entera") === "si";

  // Igual que con los archivos: si no corresponde, se contesta como si no
  // existiera. Un 403 confirmaría que el cliente existe.
  if (!(await quienPideDe(clienteId, await cookies(), PUERTA))) {
    return sinDetalle("No encontrado", 404);
  }

  try {
    const [mensajes, hay] = await Promise.all([
      entera ? leerConversacionEntera(clienteId) : leerConversacion(clienteId),
      hayAnteriores(clienteId),
    ]);
    return Response.json(
      { mensajes, hayAnteriores: hay && !entera },
      // Una conversación no se cachea: el sentido de preguntar es enterarse
      // de lo último.
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return sinDetalle("No se pudo leer la conversación", 500);
  }
}
