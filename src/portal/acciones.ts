"use server";

// Lo que el portal puede escribir en el servidor.
//
// Hoy es una sola cosa: mandarle un mensaje al equipo.
//
// **La acción decide quién habla, no el formulario.** Acá adentro está fijo
// que el mensaje es del cliente. Si el lado del que viene el mensaje llegara
// como un dato más, cualquiera podría mandar un POST diciendo ser la agencia y
// ponerle palabras en la boca. Por eso hay dos acciones separadas —una en cada
// mundo— en vez de una sola con un parámetro.
//
// Una acción de servidor es un endpoint público: que el botón solo se dibuje
// adentro del portal no protege nada.

import { esCarpetaDelCliente } from "@/lib/carpetas";
import { agregarMensaje, LARGO_MAXIMO, type Mensaje } from "@/lib/conversaciones";

export type RespuestaDeChat =
  | { ok: true; mensajes: Mensaje[] }
  | { ok: false; motivo: string };

export async function escribirComoCliente(
  carpetaId: string,
  texto: string
): Promise<RespuestaDeChat> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "No encontramos esa carpeta." };
  }

  const limpio = String(texto ?? "").trim();
  if (!limpio) return { ok: false, motivo: "El mensaje está vacío." };
  if (limpio.length > LARGO_MAXIMO) {
    return { ok: false, motivo: "El mensaje es demasiado largo." };
  }

  try {
    // El nombre queda fijo hasta que existan los usuarios. Cuando existan,
    // sale de la sesión y no de acá.
    const mensajes = await agregarMensaje(carpetaId, "cliente", "Cliente", limpio);
    return { ok: true, mensajes };
  } catch {
    return { ok: false, motivo: "No pudimos guardar el mensaje. Probá de nuevo." };
  }
}
