// Mandar un correo.
//
// Se hace con `fetch` contra la API de un proveedor, sin librería, igual que
// con Drive. Un correo es un POST con cuatro campos; traer una dependencia
// entera para eso es cargar código que después hay que mantener.
//
// **Está pensado para no estar configurado.** Mientras no haya llave, esta
// función contesta «sin configurar» y no falla: los avisos se anotan igual y
// se ven en la bandeja de gestión. El día que se agreguen las dos variables,
// los mismos avisos empiezan a salir por correo sin tocar nada más.
//
// Qué hace falta cuando llegue el momento:
//
//   RESEND_API_KEY   la llave de la cuenta (resend.com, tiene plan gratis)
//   CORREO_DESDE     de qué dirección salen, p. ej. "Mesa de trabajo <avisos@…>"
//
// Se eligió una API por HTTP y no SMTP a propósito: SMTP desde una casa suele
// estar bloqueado por el proveedor de internet, y el correo termina en spam.

const API = "https://api.resend.com/emails";

export type ResultadoDeCorreo =
  | { estado: "enviado" }
  | { estado: "sin_configurar" }
  | { estado: "fallo"; motivo: string };

export function correoConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.CORREO_DESDE?.trim());
}


/** Cuánto se espera al proveedor de correo antes de darlo por perdido. */
const ESPERA_MS = 8000;

export async function mandarCorreo(
  para: string,
  asunto: string,
  cuerpo: string
): Promise<ResultadoDeCorreo> {
  if (!correoConfigurado()) return { estado: "sin_configurar" };
  if (!para.trim()) return { estado: "fallo", motivo: "No hay a quién mandarle." };

  try {
    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.CORREO_DESDE!.trim(),
        to: [para.trim()],
        subject: asunto,
        text: cuerpo,
      }),
      // **Con límite, porque esto está en el camino de la respuesta.** El
      // aviso se manda mientras el cliente espera a que su aprobación termine
      // de guardarse: sin tope, el proveedor lento o caído convertía algo que
      // ya se guardó bien en un error en la pantalla del cliente, que entonces
      // volvía a apretar Aprobar. El aviso está diseñado para no ser condición
      // —nunca lanza— y esto hace que tampoco sea una espera sin fin.
      signal: AbortSignal.timeout(ESPERA_MS),
    });

    if (!r.ok) {
      const datos = await r.json().catch(() => ({}));
      const motivo =
        (datos as { message?: string }).message ?? `El correo devolvió ${r.status}.`;
      return { estado: "fallo", motivo };
    }
    return { estado: "enviado" };
  } catch (error) {
    // Sin internet, o el proveedor caído. El aviso ya quedó anotado igual.
    return {
      estado: "fallo",
      motivo: error instanceof Error ? error.message : "No se pudo conectar.",
    };
  }
}
