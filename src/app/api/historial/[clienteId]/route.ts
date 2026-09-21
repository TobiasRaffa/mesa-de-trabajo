// El historial de un cliente, como archivo para bajar.
//
// Solo para la agencia, y solo de un cliente de los suyos: quien pide tiene
// que tener sesión de gestión y llegar a ese cliente. Un cliente no baja su
// propio historial por acá —no hay nada suyo que no vea ya en su portal—, y
// una sesión que no llega a ese cliente recibe «no encontrado», igual que si
// no existiera.

import { cookies } from "next/headers";
import { comoCsv, historialDelCliente } from "@/admin/datos/historial";
import { cabeceraDeDescarga } from "@/lib/descargas";
import { datosDeCarpeta } from "@/lib/google";
import { quienPideDe, type Puerta } from "@/lib/permisos";

const sinDetalle = (mensaje: string, codigo: number) =>
  new Response(mensaje, { status: codigo, headers: { "Content-Type": "text/plain" } });

/**
 * A quién sirve esta ruta.
 *
 * **Solo Clientes**, que es la sección donde vive el trabajo que este archivo
 * cuenta: qué se entregó, cuántas vueltas llevó, quién hizo cada cosa y qué
 * pidió cambiar el cliente. Pedía nada más que «sesión de gestión», así que
 * alguien dado de alta para facturar se bajaba todo eso con escribir la
 * dirección. El cliente no entra: lo suyo ya lo ve en su portal.
 */
const PUERTA: Puerta = { agencia: ["clientes"], cliente: false };

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ clienteId: string }> }
) {
  const { clienteId } = await ctx.params;

  if (!(await quienPideDe(clienteId, await cookies(), PUERTA))) {
    return sinDetalle("No encontrado", 404);
  }

  let nombre = "cliente";
  try {
    nombre = (await datosDeCarpeta(clienteId)).name;
  } catch {
    // El nombre es para el archivo; sin él, va uno genérico.
  }

  try {
    const csv = comoCsv(await historialDelCliente(clienteId));
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": cabeceraDeDescarga(`historial ${nombre}.csv`, "attachment"),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[historial]", clienteId, e);
    return sinDetalle("No se pudo armar el historial", 502);
  }
}
