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

import {
  actualizarAviso,
  anotarAviso,
  avisoQueContinua,
  continuaA,
  type ClaseDeAviso,
} from "@/lib/avisos";
import { correoConfigurado, mandarCorreo } from "@/lib/correo";
import { personaPorId, quienesRecibenTodo, type Persona } from "@/lib/equipo";
import { cadenaHasta } from "@/lib/permisos";
import { responsablesDe } from "@/lib/responsables";
import { alcanzaA } from "@/dominio/roles";
import { enCastellano } from "@/dominio/texto";

/**
 * Qué clases se juntan cuando pasan seguidas.
 *
 * Lo que el cliente hace de a una pieza pero en una sola sesión: revisar una
 * carpeta de ocho es un rato de trabajo suyo, no ocho novedades para nosotros.
 */
const SE_ACUMULAN: ClaseDeAviso[] = ["escribio", "aprobo", "pidio_cambios"];

/** «Aprobó 3 piezas en Banners: el A, el B y el C.» */
function juntadas(
  clase: ClaseDeAviso,
  carpeta: string,
  veces: number,
  piezas: string[] | undefined
): string {
  const verbo = clase === "aprobo" ? "Aprobó" : "Pidió cambios en";
  const cuantas = `${veces} ${veces === 1 ? "pieza" : "piezas"}`;
  // Hasta cuatro nombres; más que eso, la lista deja de leerse y lo que
  // importa es cuántas son y dónde están.
  const lista =
    piezas && piezas.length > 0 && piezas.length <= 4 ? `: ${enCastellano(piezas)}` : "";
  return clase === "aprobo"
    ? `${verbo} ${cuantas} en ${carpeta}${lista}.`
    : `${verbo} ${cuantas} de ${carpeta}${lista}.`;
}

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
      // **Dice qué versión cerró.** Decía «la revisión de Banners (2 piezas)»,
      // y con eso había que entrar a mirar cuáles y de qué vuelta: saber si es
      // la primera pasada o la tercera es lo que cambia qué se hace después.
      return detalle
        ? `Envió la revisión de ${detalle} en ${carpeta}.`
        : `Envió la revisión de ${carpeta}.`;
    case "escribio":
      // La conversación es del cliente, no de una carpeta: nombrar una acá
      // mandaría a buscar el mensaje donde no está.
      return "Escribió en la conversación.";
    case "por_vencer":
      return `Va por la mitad del plazo de ${detalle ?? "una pieza"} en ${carpeta} y todavía no decidió.`;
    case "vencio":
      return `Se cumplió el plazo de ${detalle ?? "una pieza"} en ${carpeta} y todavía no decidió.`;
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
}): Promise<boolean> {
  // **Contesta si el aviso quedó anotado.** Como nunca lanza, quien necesita
  // saber si salió —los recordatorios, que si no lo dan por mandado para
  // siempre— no tenía otra forma de enterarse.
  const { clase, clienteId, cliente, carpetaId, carpeta, detalle } = opciones;

  try {
    // **Un mensaje seguido de otro es el mismo aviso.** Cuatro mensajes en
    // dos minutos son una persona escribiendo, no cuatro novedades: se
    // reescribe el aviso que ya está —cuántos van y la hora del último— y no
    // sale otro correo. Si alguien lo vio entre medio, no se suma: lo nuevo
    // vuelve a avisar, que es para lo que existe la bandeja.
    if (SE_ACUMULAN.includes(clase)) {
      // Los mensajes van por cliente —la conversación no es de una carpeta—;
      // lo que se decide pieza por pieza, por carpeta: aprobar en «Banners» y
      // aprobar en «Stories» son dos novedades y nombran carpetas distintas.
      const nuevo = {
        clase,
        clienteId,
        carpetaId: clase === "escribio" ? undefined : carpetaId,
      };
      const anterior = await avisoQueContinua(nuevo);
      // **La cuenta sale de lo guardado, no de lo que se leyó recién.** Tres
      // mensajes a la vez leían el mismo aviso, le sumaban uno cada uno a su
      // copia y guardaban «2 mensajes» donde había 4. Y si alguien lo vio entre
      // la lectura y la escritura, ya no se suma: lo nuevo va en otro aviso,
      // en lugar de esconderse adentro de uno que figura como leído.
      const sumado =
        anterior &&
        (await actualizarAviso(anterior, (habia) => {
          const ahora = new Date();
          if (!continuaA(habia, nuevo, ahora)) return null;
          // **Se cuentan piezas, no toques.** Pedir cambios, descartar y volver
          // a pedir sobre la misma pieza decía «2 piezas: la v2 de a y la v2
          // de a». Si la pieza ya está, lo único que cambia es la hora.
          if (clase !== "escribio" && detalle && habia.piezas?.includes(detalle)) {
            return { cuando: ahora.toISOString() };
          }
          const veces = (habia.veces ?? 1) + 1;
          const piezas = detalle ? [...(habia.piezas ?? []), detalle] : habia.piezas;
          return {
            veces,
            piezas,
            cuando: ahora.toISOString(),
            texto:
              clase === "escribio"
                ? `Escribió ${veces} mensajes en la conversación.`
                : juntadas(clase, carpeta, veces, piezas),
          };
        }));
      if (sumado) return true;
    }

    // **Sin el nombre del cliente adentro.** Iba cosido al principio de cada
    // texto, y la bandeja quedaba con cincuenta renglones que empezaban con la
    // misma cadena: el ojo tiene que saltearla para llegar a lo que pasó. El
    // cliente es un dato del aviso y se dibuja como tal —y cuando todos los
    // avisos a la vista son del mismo cliente, no se dibuja—. En el correo, el
    // asunto ya lo nombra.
    const texto = comoSeCuenta(clase, carpeta, detalle);

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
      piezas: detalle ? [detalle] : undefined,
      paraQuienes: quienes.map((p) => p.nombre),
      correo:
        estado.estado === "enviado"
          ? "enviado"
          : estado.estado === "sin_configurar"
            ? "sin_configurar"
            : conCorreo.length > 0
              ? "fallo"
              : "sin_destinatario",
      // **Sin repetir el motivo que ya dice la etiqueta.** Con nadie a quien
      // mandárselo, el renglón decía «sin asignar · Nadie asignado con
      // correo.»: la misma frase dos veces, en el mismo renglón.
      detalleDelCorreo:
        estado.estado === "fallo" && conCorreo.length > 0 ? estado.motivo : undefined,
    });
    return true;
  } catch {
    // Que fallar en avisar no tumbe lo que el cliente acaba de hacer.
    return false;
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

  // **«Recibe todo» quiere decir todo lo suyo.** Quien lleva dos cuentas de
  // ocho no tiene por qué enterarse de lo que pasa en las otras seis: el aviso
  // nombra al cliente y la carpeta, así que mandárselo sería contarle
  // exactamente lo que la aplicación no le deja mirar.
  //
  // A quien lo lleva no se lo filtra: que alguien esté asignado a un trabajo es
  // una decisión que tomó una persona, y callarle el aviso por una casilla la
  // dejaría esperando algo que nunca llega.
  const porId = new Map(
    todos.filter((p) => alcanzaA(p.clientes, clienteId)).map((p) => [p.id, p])
  );
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
