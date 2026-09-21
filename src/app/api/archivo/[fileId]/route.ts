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
import { cookies } from "next/headers";

import { abrirArchivo } from "@/lib/google";
import { cabeceraDeDescarga } from "@/lib/descargas";
import {
  archivoAutorizado,
  pasaPorFacturas,
  quienPideEn,
  type Puerta,
} from "@/lib/permisos";

const sinDetalle = (mensaje: string, codigo: number) =>
  new Response(mensaje, { status: codigo, headers: { "Content-Type": "text/plain" } });

/**
 * Los tipos que el navegador puede mostrar sin bajarlos, y que además son
 * seguros de mostrar en nuestro propio dominio.
 *
 * Es una lista cerrada a propósito: dejar que el navegador decida qué hacer
 * con un archivo servido desde acá es lo que convierte una subida en una
 * página nuestra. Hoy alcanza con el PDF, que es el caso real —la miniatura
 * muestra solo la primera página—.
 */
const SE_PUEDE_MIRAR = new Set(["application/pdf"]);

/**
 * A quién sirve esta ruta.
 *
 * **El cliente entra**: es la ruta por la que se lleva su trabajo. De la
 * agencia entran las tres secciones donde hay algo para abrir —el árbol de
 * Clientes, la ventana del Tablero y la pantalla de Facturas—. Quedan afuera
 * Conversaciones y Notificaciones, que no muestran archivos, y Admin y
 * Diagnóstico, que no son para mirar trabajo.
 */
const PUERTA: Puerta = { agencia: ["clientes", "tablero", "facturas"], cliente: true };

/**
 * Lo que se cobra es otra sección, y también para los bytes.
 *
 * Con una sola lista, quien lleva Facturas se bajaba un boceto y quien lleva
 * Clientes se bajaba una factura: los dos tenían «alguna» de las secciones que
 * abren archivos, y el archivo no decía de cuál era. Acá lo dice el camino.
 */
const PARA_FACTURAS: readonly ["facturas"] = ["facturas"];
const PARA_TRABAJO: readonly ["clientes", "tablero"] = ["clientes", "tablero"];

export async function GET(req: NextRequest, ctx: RouteContext<"/api/archivo/[fileId]">) {
  const { fileId } = await ctx.params;

  // **Quién pregunta, antes que qué pide.** Sin haber entrado por alguna
  // puerta —la del cliente o la de la agencia— no se sirve un solo byte. Y lo
  // que se sirve depende de quién sea: el cliente ve lo suyo y nada más; la
  // agencia ve todo lo que el robot ve.
  const galletas = await cookies();
  const quien = await quienPideEn(galletas, PUERTA);
  if (!quien) return sinDetalle("No encontrado", 404);

  // Si el archivo no cuelga de su carpeta, se responde igual que si no
  // existiera: no confirmamos ni desmentimos que exista.
  const archivo = await archivoAutorizado(fileId, quien);
  if (!archivo) return sinDetalle("No encontrado", 404);

  // Y del lado de la agencia, además, que la sección sea la del archivo. Al
  // cliente no le toca esta pregunta: «Facturas» ya le corta el camino en
  // `archivoAutorizado`, así que lo que llega hasta acá es trabajo suyo.
  if (quien.tipo === "agencia") {
    const suyas = (await pasaPorFacturas(fileId)) ? PARA_FACTURAS : PARA_TRABAJO;
    if (!suyas.some((s) => quien.secciones.includes(s))) {
      return sinDetalle("No encontrado", 404);
    }
  }

  try {
    const deDrive = await abrirArchivo(fileId);

    const cabeceras = new Headers({
      "Content-Type": archivo.mimeType || "application/octet-stream",
      "Content-Disposition": cabeceraDeDescarga(
        archivo.name,
        req.nextUrl.searchParams.has("ver") && SE_PUEDE_MIRAR.has(archivo.mimeType)
          ? "inline"
          : "attachment"
      ),
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
