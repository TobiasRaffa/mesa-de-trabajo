// Entrega el archivo original de una pieza.
//
// Es la ruta por la que el cliente se lleva el trabajo terminado: el .jpg de
// verdad, no la miniatura. Pasa por el servidor por la misma razón que las
// miniaturas — que la estructura de Drive no llegue al navegador y que todo el
// acceso quede detrás de una sola puerta— y por una más: así el cliente no
// necesita tener permiso sobre la carpeta de Drive.
//
// El archivo no se guarda ni se junta en memoria: se reenvía mientras llega.
// Un archivo de diseño puede pesar cientos de megas.

import type { NextRequest } from "next/server";
import { abrirArchivo } from "@/lib/google";
import { cabeceraDeDescarga } from "@/lib/descargas";
import { archivoAutorizado } from "@/lib/permisos";

const sinDetalle = (mensaje: string, codigo: number) =>
  new Response(mensaje, { status: codigo, headers: { "Content-Type": "text/plain" } });

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/archivo/[fileId]">) {
  const { fileId } = await ctx.params;

  // Autorización antes que nada. Si no está dentro de una carpeta que
  // administramos, se responde igual que si no existiera.
  //
  // Cuando exista la base de datos, acá se agrega la otra mitad: que la pieza
  // esté aprobada. Hoy no hay dónde preguntarlo.
  const archivo = await archivoAutorizado(fileId);
  if (!archivo) return sinDetalle("No encontrado", 404);

  try {
    const deDrive = await abrirArchivo(fileId);

    const cabeceras = new Headers({
      "Content-Type": archivo.mimeType || "application/octet-stream",
      "Content-Disposition": cabeceraDeDescarga(archivo.name),
      "X-Content-Type-Options": "nosniff",
      // Es contenido de un cliente: nunca en cachés compartidas. Y corto,
      // porque un archivo final que se reemplaza tiene que bajar el nuevo.
      "Cache-Control": "private, max-age=60",
    });

    // Si Drive dijo cuánto pesa, se lo pasamos: es lo que hace que el
    // navegador muestre una barra de avance en vez de un reloj de arena.
    const largo = deDrive.headers.get("content-length");
    if (largo) cabeceras.set("Content-Length", largo);

    return new Response(deDrive.body, { headers: cabeceras });
  } catch (e) {
    console.error("[archivo]", fileId, e);
    return sinDetalle("No se pudo descargar el archivo", 502);
  }
}
