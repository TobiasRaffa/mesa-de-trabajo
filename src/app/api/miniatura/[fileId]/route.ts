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
import { cookies } from "next/headers";

import { bytesDeMiniatura } from "@/lib/google";
import { tamanoPermitido } from "@/lib/miniaturas";
import {
  archivoAutorizado,
  pasaPorFacturas,
  quienPideEn,
  type Puerta,
} from "@/lib/permisos";

const sinDetalle = (mensaje: string, codigo: number) =>
  new Response(mensaje, { status: codigo, headers: { "Content-Type": "text/plain" } });

/** A quién sirve esta ruta. La misma que la del archivo: es su vista previa. */
const PUERTA: Puerta = { agencia: ["clientes", "tablero", "facturas"], cliente: true };

const PARA_FACTURAS: readonly ["facturas"] = ["facturas"];
const PARA_TRABAJO: readonly ["clientes", "tablero"] = ["clientes", "tablero"];

export async function GET(req: NextRequest, ctx: RouteContext<"/api/miniatura/[fileId]">) {
  const { fileId } = await ctx.params;

  const px = tamanoPermitido(req.nextUrl.searchParams.get("px"));

  // **Quién pregunta, antes que qué pide.** Sin haber entrado por alguna
  // puerta —la del cliente o la de la agencia— no se sirve un solo byte. Y lo
  // que se sirve depende de quién sea: el cliente ve lo suyo y nada más; la
  // agencia ve todo lo que el robot ve.
  const quien = await quienPideEn(await cookies(), PUERTA);
  if (!quien) return sinDetalle("No encontrado", 404);

  const archivo = await archivoAutorizado(fileId, quien);
  if (!archivo) return sinDetalle("No encontrado", 404);

  // La miniatura de una factura es la factura: se mira igual que el original.
  if (quien.tipo === "agencia") {
    const suyas = (await pasaPorFacturas(fileId)) ? PARA_FACTURAS : PARA_TRABAJO;
    if (!suyas.some((s) => quien.secciones.includes(s))) {
      return sinDetalle("No encontrado", 404);
    }
  }

  if (!archivo.thumbnailLink) return sinDetalle("El archivo no tiene miniatura", 415);

  try {
    const { bytes, tipo } = await bytesDeMiniatura(archivo.thumbnailLink, px);

    // La página agrega ?v=<fecha de modificación> a la URL. Si alguien
    // reemplaza el archivo en Drive sin cambiarle el nombre, la fecha cambia,
    // la URL cambia y el navegador pide la imagen nueva. Sin ese parámetro no
    // se puede confiar en una caché larga: el cliente vería el boceto viejo.
    //
    // **Que el parámetro exista no alcanza: tiene que valer algo.** Con
    // `has("v")`, un `?v=` vacío —que es lo que sale cuando el archivo no trae
    // fecha de modificación— pedía un día de caché `immutable` sobre una
    // dirección que ya no se puede invalidar: el boceto viejo se quedaba
    // pegado en el navegador sin forma de sacarlo.
    const versionada = Boolean(req.nextUrl.searchParams.get("v"));

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
