// Avisarle al equipo que pasó algo.
//
// Junta las tres piezas: quién lleva el trabajo (`equipo`), cómo se le dice
// (`correo`) y dónde queda anotado (`avisos`). Lo llama el portal cuando el
// cliente decide algo.
//
// **Nunca lanza.** Un aviso es una consecuencia de lo que hizo el cliente, no
// una condición: si el correo falla, la aprobación vale igual. Todo lo que
// pueda salir mal termina en «se anotó, no se pudo mandar».

import { responsableDe, responsableQueCorre } from "@/lib/responsables";
import { anotarAviso, type ClaseDeAviso } from "@/lib/avisos";
import { correoConfigurado, mandarCorreo } from "@/lib/correo";
import { personaPorId } from "@/lib/equipo";

/** Cómo se cuenta cada cosa, en una línea. */
function comoSeCuenta(clase: ClaseDeAviso, carpeta: string, detalle?: string): string {
  switch (clase) {
    case "aprobo":
      return `Aprobó ${detalle ?? "una pieza"} en ${carpeta}.`;
    case "pidio_cambios":
      return `Pidió cambios en ${detalle ?? "una pieza"} de ${carpeta}.`;
    case "envio_revision":
      return `Envió la revisión de ${carpeta}${detalle ? ` (${detalle})` : ""}.`;
    case "escribio":
      // La conversación es del cliente, no de una carpeta: nombrar una acá
      // mandaría a buscar el mensaje donde no está.
      return "Escribió en la conversación.";
    case "vencio":
      return `Se cumplió el plazo de ${carpeta} y todavía falta revisar.`;
  }
}

export async function avisar(opciones: {
  clase: ClaseDeAviso;
  clienteId: string;
  cliente: string;
  carpetaId: string;
  carpeta: string;
  /** El nombre de la pieza, o el resumen. Va adentro del texto. */
  detalle?: string;
}): Promise<void> {
  const { clase, clienteId, cliente, carpetaId, carpeta, detalle } = opciones;

  try {
    const texto = `${cliente}: ${comoSeCuenta(clase, carpeta, detalle)}`;

    // Quién lo lleva sale de la herencia: si la carpeta no tiene a nadie
    // puesto, se le avisa a quien lleva el cliente entero.
    const [deLaCarpeta, delCliente] = await Promise.all([
      responsableDe(carpetaId),
      responsableDe(clienteId),
    ]);
    const quien = responsableQueCorre(undefined, deLaCarpeta, delCliente);
    const persona = await personaPorId(quien ?? undefined);

    let estado: Awaited<ReturnType<typeof mandarCorreo>> = { estado: "sin_configurar" };
    if (!correoConfigurado()) {
      estado = { estado: "sin_configurar" };
    } else if (!persona?.correo) {
      // Hay correo configurado pero nadie a quién mandárselo: el trabajo no
      // está asignado, o quien lo lleva no tiene dirección cargada.
      estado = { estado: "fallo", motivo: "Nadie asignado con correo." };
    } else {
      estado = await mandarCorreo(
        persona.correo,
        `Mesa de trabajo · ${cliente}`,
        `${texto}\n\nEntrá a la app de gestión para verlo.`
      );
    }

    await anotarAviso({
      clase,
      cliente,
      clienteId,
      carpeta,
      carpetaId,
      texto,
      paraQuien: persona?.nombre,
      correo:
        estado.estado === "enviado"
          ? "enviado"
          : estado.estado === "sin_configurar"
            ? "sin_configurar"
            : persona?.correo
              ? "fallo"
              : "sin_destinatario",
      detalleDelCorreo: estado.estado === "fallo" ? estado.motivo : undefined,
    });
  } catch {
    // Que fallar en avisar no tumbe lo que el cliente acaba de hacer.
  }
}
