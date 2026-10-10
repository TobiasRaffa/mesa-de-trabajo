// Mandar un correo desde la cuenta de Gmail de la agencia.
//
// Se usa SMTP de Gmail con una **contraseña de aplicación** (no la contraseña
// de la cuenta). Esa contraseña se crea en la cuenta de Google, con la
// verificación en dos pasos activada, y se carga en Netlify como variable.
//
// Qué hace falta:
//
//   GMAIL_USUARIO              la cuenta de Gmail que manda los correos
//   GMAIL_CLAVE_DE_APLICACION  la contraseña de aplicación de 16 letras
//
// **Está pensado para no estar configurado.** Sin esas dos variables, esta
// función contesta «sin configurar» y no falla: los avisos se anotan igual.

import nodemailer from "nodemailer";

export type ResultadoDeCorreo =
  | { estado: "enviado" }
  | { estado: "sin_configurar" }
  | { estado: "fallo"; motivo: string };

export function correoConfigurado(): boolean {
  return Boolean(process.env.GMAIL_USUARIO?.trim() && process.env.GMAIL_CLAVE_DE_APLICACION?.trim());
}

/** Cuánto se espera al servidor de correo antes de darlo por perdido. */
const ESPERA_MS = 8000;

export async function mandarCorreo(
  para: string,
  asunto: string,
  cuerpo: string
): Promise<ResultadoDeCorreo> {
  if (!correoConfigurado()) return { estado: "sin_configurar" };
  if (!para.trim()) return { estado: "fallo", motivo: "No hay a quién mandarle." };

  const usuario = process.env.GMAIL_USUARIO!.trim();
  try {
    const transporte = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: usuario, pass: process.env.GMAIL_CLAVE_DE_APLICACION!.trim() },
      // **Con límite, porque esto está en el camino de la respuesta.** Sin tope,
      // un servidor lento o caído dejaba colgada la pantalla de quien espera.
      connectionTimeout: ESPERA_MS,
      greetingTimeout: ESPERA_MS,
      socketTimeout: ESPERA_MS,
    });
    await transporte.sendMail({
      from: `Mesa de trabajo <${usuario}>`,
      to: para.trim(),
      subject: asunto,
      text: cuerpo,
    });
    return { estado: "enviado" };
  } catch (error) {
    return {
      estado: "fallo",
      motivo: error instanceof Error ? error.message : "No se pudo mandar el correo.",
    };
  }
}
