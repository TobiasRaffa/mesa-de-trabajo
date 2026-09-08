// Sirve la miniatura de un archivo de Drive.
//
// Existe porque Google responde 429 cuando la imagen se pide desde una página
// (cabecera `Referer`). Pedida desde el servidor funciona siempre.
//
// De paso mejora dos cosas:
//   - el navegador nunca ve una URL de Google, así que no se filtra nada de la
//     estructura de Drive en el HTML;
//   - el acceso pasa por una única puerta que se puede controlar.

import type { NextRequest } from "next/server";
import { bytesDeMiniatura } from "@/lib/google";
import { tamanoPermitido } from "@/lib/miniaturas";
import { archivoAutorizado } from "@/lib/permisos";

const sinDetalle = (mensaje: string, codigo: number) =>
  new Response(mensaje, { status: codigo, headers: { "Content-Type": "text/plain" } });

export async function GET(req: NextRequest, ctx: RouteContext<"/api/miniatura/[fileId]">) {
  const { fileId } = await ctx.params;

  const px = tamanoPermitido(req.nextUrl.searchParams.get("px"));

  // Autorización antes que nada. Si no está dentro de una carpeta que
  // administramos, se responde igual que si no existiera: no confirmamos
  // ni desmentimos que el archivo exista.
  const archivo = await archivoAutorizado(fileId);
  if (!archivo) return sinDetalle("No encontrado", 404);

  if (!archivo.thumbnailLink) return sinDetalle("El archivo no tiene miniatura", 415);

  try {
    const { bytes, tipo } = await bytesDeMiniatura(archivo.thumbnailLink, px);

    // La página agrega ?v=<fecha de modificación> a la URL. Si alguien
    // reemplaza el archivo en Drive sin cambiarle el nombre, la fecha cambia,
    // la URL cambia y el navegador pide la imagen nueva. Sin ese parámetro no
    // se puede confiar en una caché larga: el cliente vería el boceto viejo.
    const versionada = req.nextUrl.searchParams.has("v");

    return new Response(bytes, {
      headers: {
        "Content-Type": tipo,
        // Privada porque es contenido de un cliente: nunca en cachés compartidas.
        "Cache-Control": versionada
          ? "private, max-age=86400, immutable"
          : "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    // El detalle queda en los registros del servidor, no viaja al navegador.
    console.error("[miniatura]", fileId, e);
    return sinDetalle("No se pudo cargar la miniatura", 502);
  }
}
