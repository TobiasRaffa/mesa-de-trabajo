// Avisarle al equipo que pasó algo.
//
// Junta las tres piezas: quién lleva el trabajo (`equipo`), cómo se le dice
// (`correo`) y dónde queda anotado (`avisos`). Lo llama el portal cuando el
// cliente decide algo.
//
// **A quiénes les llega.** A dos grupos, y a la unión de los dos:
//
//   1. **Quien lleva ese trabajo**, buscado subiendo por el árbol desde donde
//      pasó la cosa hasta la carpeta del cliente: la subcarpeta, la de arriba,
//      y así. Vale el primero que tenga a alguien puesto. Mientras la
//      estructura tuvo dos niveles alcanzaba con mirar la carpeta y el cliente;
//      ahora que puede haber subcarpetas adentro de subcarpetas, mirar dos
//      escalones se saltea al del medio, que es justo donde suele estar puesto
//      quién lo lleva. Si dos personas llevan subcarpetas distintas del mismo
//      cliente, cada una recibe lo suyo.
//
//   2. **Quienes reciben todo**, marcados en el equipo. Alguien de la agencia
//      tiene que enterarse de todo lo que pasa; sin eso, un aviso de una
//      carpeta que nadie tiene asignada no le llegaba a nadie.
//
// **Nunca lanza.** Un aviso es una consecuencia de lo que hizo el cliente, no
// una condición: si el correo falla, la aprobación vale igual. Todo lo que
// pueda salir mal termina en «se anotó, no se pudo mandar».

import { anotarAviso, type ClaseDeAviso } from "@/lib/avisos";
import { correoConfigurado, mandarCorreo } from "@/lib/correo";
import { personaPorId, quienesRecibenTodo, type Persona } from "@/lib/equipo";
import { cadenaHasta } from "@/lib/permisos";
import { responsablesDe } from "@/lib/responsables";

/** Cómo se cuenta cada cosa, en una línea. */
function comoSeCuenta(clase: ClaseDeAviso, carpeta: string, detalle?: string): string {
  switch (clase) {
    case "entregamos":
      return `Se le entregó ${detalle ?? "trabajo"} en ${carpeta}.`;
    case "aprobo":
      return `Aprobó ${detalle ?? "una pieza"} en ${carpeta}.`;
    case "pidio_cambios":
      return `Pidió cambios en ${detalle ?? "una pieza"} de ${carpeta}.`;
    case "pidio_extra":
      // Este espera una decisión de la agencia, y por eso lo dice: el resto de
      // los avisos cuentan algo que pasó, este pide algo.
      return `Se quedó sin vueltas en ${detalle ?? "una pieza"} de ${carpeta} y pide una más.`;
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

    const quienes = await aQuienesLesToca(clienteId, carpetaId);
    const conCorreo = quienes.filter((p) => p.correo);

    let estado: Awaited<ReturnType<typeof mandarCorreo>> = { estado: "sin_configurar" };

    if (!correoConfigurado()) {
      estado = { estado: "sin_configurar" };
    } else if (conCorreo.length === 0) {
      // Hay correo configurado pero nadie a quién mandárselo: el trabajo no
      // está asignado y nadie recibe todo, o los que hay no tienen dirección.
      estado = { estado: "fallo", motivo: "Nadie asignado con correo." };
    } else {
      // Uno por persona, no una copia oculta a todos: así cada quien recibe lo
      // suyo y no se entera de a quién más le llegó.
      const salidas = await Promise.all(
        conCorreo.map((p) =>
          mandarCorreo(
            p.correo,
            `Mesa de trabajo · ${cliente}`,
            `${texto}\n\nEntrá a la app de gestión para verlo.`
          )
        )
      );
      // Si alguno no salió, el aviso muestra ese: es el que hay que mirar.
      estado = salidas.find((r) => r.estado === "fallo") ?? salidas[0];
    }

    await anotarAviso({
      clase,
      cliente,
      clienteId,
      carpeta,
      carpetaId,
      texto,
      paraQuienes: quienes.map((p) => p.nombre),
      correo:
        estado.estado === "enviado"
          ? "enviado"
          : estado.estado === "sin_configurar"
            ? "sin_configurar"
            : conCorreo.length > 0
              ? "fallo"
              : "sin_destinatario",
      detalleDelCorreo: estado.estado === "fallo" ? estado.motivo : undefined,
    });
  } catch {
    // Que fallar en avisar no tumbe lo que el cliente acaba de hacer.
  }
}

/**
 * Quiénes tienen que enterarse de algo que pasó en esta carpeta.
 *
 * Sin repetidos: quien lleva el trabajo puede estar además entre los que
 * reciben todo, y que llegue dos veces el mismo correo es cómo empiezan a
 * ignorarse los avisos.
 */
async function aQuienesLesToca(
  clienteId: string,
  carpetaId: string
): Promise<Persona[]> {
  const [todos, quienLleva] = await Promise.all([
    quienesRecibenTodo(),
    quienLlevaEsto(clienteId, carpetaId),
  ]);

  const porId = new Map(todos.map((p) => [p.id, p]));
  if (quienLleva) porId.set(quienLleva.id, quienLleva);
  return [...porId.values()];
}

/** Quien lleva este trabajo, subiendo escalón por escalón hasta el cliente. */
async function quienLlevaEsto(
  clienteId: string,
  carpetaId: string
): Promise<Persona | null> {
  // La cadena va de abajo hacia arriba, así que el primer escalón que tenga
  // algo puesto es el que manda.
  const cadena = await cadenaHasta(carpetaId, clienteId);
  // Si Drive no contesta, quedan los dos extremos: es lo que se miraba antes y
  // sigue siendo mejor que no avisarle a nadie.
  const escalones = cadena.length > 0 ? cadena : [carpetaId, clienteId];

  const puestos = await responsablesDe(escalones);
  for (const escalon of escalones) {
    if (!(escalon in puestos)) continue;
    // `null` es «nadie, a propósito» y corta la búsqueda: alguien decidió que
    // esto no lo lleva nadie, y heredar al de arriba sería ignorar esa decisión.
    const quien = puestos[escalon];
    return quien ? await personaPorId(quien) : null;
  }
  return null;
}
