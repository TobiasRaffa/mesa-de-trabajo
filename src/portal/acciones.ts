"use server";

// Lo que el portal puede escribir en el servidor.
//
// **La acción decide quién habla, no el formulario.** Acá adentro está fijo que
// todo lo que pasa es del cliente. Si el lado del que viene la decisión llegara
// como un dato más, cualquiera podría mandar un POST diciendo ser la agencia.
// Por eso hay dos juegos de acciones, uno en cada mundo.
//
// Una acción de servidor es un endpoint público: que el botón solo se dibuje
// adentro del portal no protege nada. Todo lo que llega se valida contra lo que
// de verdad existe en Drive.
//
// **Acá no se nombra ninguna pantalla de administración**, ni siquiera para
// refrescarla. Las de gestión se dibujan de nuevo en cada visita, así que no
// hacía falta; y el portal no tiene por qué saber que existen.

import { cookies } from "next/headers";
import {
  aplicar,
  RONDAS_INCLUIDAS_POR_DEFECTO,
  type Evento,
} from "@/dominio/pieza";
import {
  agruparVersiones,
  conSusArchivos,
  nombreDePieza,
} from "@/lib/versiones";
import { enPalabrasLoRevisado, versionQueMira } from "@/dominio/historia";
import { entroAlCliente } from "@/lib/acceso";
import { avisar } from "@/lib/avisar";
import type { ClaseDeAviso } from "@/lib/avisos";
import { clienteDeCarpeta, esCarpetaDelCliente } from "@/lib/carpetas";
import { datosDeCarpeta } from "@/lib/google";
import { agregarMensaje, LARGO_MAXIMO, type Mensaje } from "@/lib/conversaciones";

import {
  anotar,
  estadoDe,
  estadosDe,
  guardarPieza,
  guardarPiezas,
  piezasDeLaCarpeta,
  type Cambio,
  type EstadoDePieza,
  type Hito,
} from "@/lib/piezas";

/** Quién figura en la historia. Cuando existan los usuarios, sale de la sesión. */
const CLIENTE = "Cliente";

/**
 * Quién está del otro lado, y de qué carpeta habla.
 *
 * **Toda acción del portal empieza acá.** Son dos preguntas y hacen falta las
 * dos:
 *
 *   1. **¿De quién es esta carpeta?** Se deduce de la carpeta, no llega como
 *      parámetro. Antes venía del navegador y se le creía: con eso, un pedido
 *      armado a mano podía aprobar la pieza de un cliente diciendo ser otro.
 *
 *   2. **¿Y quién pregunta?** Esta faltaba, y es la que importa. Arreglar la
 *      primera impidió *hacerse pasar* por otro cliente, pero no exigió ser
 *      ninguno: alcanzaba con saber un identificador de carpeta de Drive —que
 *      lo ve cualquiera a quien le hayan compartido la carpeta— para aprobar
 *      una pieza, mover el archivo en Drive, cerrar una revisión o escribir en
 *      el chat firmando como el cliente. Sin link y sin clave.
 *
 * Una acción de servidor es un endpoint público: que el navegador no dibuje el
 * botón no impide que alguien haga el pedido igual.
 *
 * Devuelve `null` en los tres casos —carpeta que no existe, carpeta de otro,
 * nadie autenticado— y quien llama contesta lo mismo para los tres. Distinguir
 * le diría a quien prueba si acertó a medias.
 */
async function quienEntro(carpetaId: string) {
  const cliente = await clienteDeCarpeta(carpetaId);
  if (!cliente) return null;

  // La galleta la firma el servidor y dice «este navegador acertó la clave de
  // este link». No se puede fabricar sin la llave del servidor.
  if (!(await entroAlCliente(cliente.id, await cookies()))) return null;

  try {
    const carpeta = await datosDeCarpeta(carpetaId);
    return { cliente, nombreDeLaCarpeta: carpeta.name };
  } catch {
    return { cliente, nombreDeLaCarpeta: "una carpeta" };
  }
}

/**
 * Qué puede hacer el cliente desde su portal, y qué queda anotado de cada cosa.
 *
 * **Una tabla y no una lista más cuatro `if`.** Eran dos cosas separadas —los
 * eventos permitidos por un lado, las anotaciones por otro— y se
 * desincronizaron: pedir una revisión adicional estaba permitido y no se
 * anotaba, así que la pieza pasaba a esperar una decisión de la agencia —que
 * puede costar plata— sin dejar rastro de quién la pidió ni cuándo. Juntas, no
 * se puede agregar una sin decidir la otra.
 *
 * `null` es «se puede, pero no se anota», y es una decisión: abrir una pieza
 * es que el cliente la haya mirado, y anotar cada vez que alguien abre algo
 * llenaría la historia de ruido que tapa lo que importa.
 *
 * Se listan los permitidos en vez de prohibir los otros, para que un evento
 * nuevo del dominio no quede habilitado sin que nadie lo decida.
 */
const DESDE_EL_PORTAL: Partial<Record<Evento["tipo"], Hito | null>> = {
  abrir: null,
  aprobar: "aprobada",
  pedir_cambios: "cambios_pedidos",
  descartar_cambios: "cambios_descartados",
  pedir_revision_extra: "extra_pedida",
  // Lo cierra `enviarRevision`, que toca varias piezas de una: acá se acepta
  // para que el dominio lo valide igual, y la anotación la hace aquella.
  cerrar_revision: null,
};

export type RespuestaDePieza =
  | { ok: true; pieza: EstadoDePieza }
  | { ok: false; motivo: string };

export type RespuestaDeCarpeta =
  | { ok: true; piezas: Record<string, EstadoDePieza> }
  | { ok: false; motivo: string };

export type RespuestaDeChat =
  | { ok: true; mensajes: Mensaje[] }
  | { ok: false; motivo: string };

/**
 * Comprueba que la pieza sea de esa carpeta, de verdad.
 *
 * Una pieza que ya se mudó a «Entregas finales» sigue siendo de su carpeta de
 * origen aunque Drive ya no la liste ahí: por eso se acepta también cuando el
 * estado guardado dice que salió de ahí.
 */
async function piezaDeLaCarpeta(
  carpetaId: string,
  piezaId: string
): Promise<{ archivoActual: string } | null> {
  if (!(await esCarpetaDelCliente(carpetaId))) return null;
  try {
    const agrupadas = agruparVersiones(await piezasDeLaCarpeta(carpetaId));
    for (const pieza of agrupadas) {
      if (`${carpetaId}::${pieza.base}` !== piezaId) continue;
      // El archivo de la última vuelta: es el que se muda al aprobar. La pieza
      // no es un archivo, así que su identificador no sirve para ir a buscarlo.
      return { archivoActual: pieza.versiones[pieza.versiones.length - 1].archivo.id };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Aplica un evento del dominio a una pieza.
 *
 * Las reglas de qué se puede hacer en cada estado **no están acá**: salen de
 * `aplicar()`, la misma función que corre en el navegador. Acá solo se
 * comprueba que el pedido sea legítimo, se guarda y se anota en la historia.
 */
export async function moverPieza(
  carpetaId: string,
  piezaId: string,
  evento: Evento
): Promise<RespuestaDePieza> {
  // Primero quién, después qué. Al revés, un pedido de alguien que no entró
  // igual averiguaría si una pieza existe o no.
  const donde = await quienEntro(carpetaId);
  if (!donde) return { ok: false, motivo: "No encontramos esa carpeta." };

  const cual = await piezaDeLaCarpeta(carpetaId, piezaId);
  if (!cual) return { ok: false, motivo: "No encontramos esa pieza." };

  if (!(evento?.tipo in DESDE_EL_PORTAL)) {
    return { ok: false, motivo: "Esa acción no se puede hacer desde el portal." };
  }

  const guardada = await estadoDe(carpetaId, piezaId);
  const rondasIncluidas = RONDAS_INCLUIDAS_POR_DEFECTO;

  const resultado = aplicar(
    {
      estado: guardada.estado,
      ronda: guardada.ronda,
      rondasIncluidas,
      rondasExtra: guardada.rondasExtra,
    },
    // Aprobar lleva quién: la firma la pone el servidor, no el navegador.
    evento.tipo === "aprobar" ? { tipo: "aprobar", por: CLIENTE } : evento
  );

  if (!resultado.ok) return { ok: false, motivo: resultado.motivo };

  let pieza: EstadoDePieza = {
    ...guardada,
    carpetaId,
    estado: resultado.pieza.estado,
    ronda: resultado.pieza.ronda,
    rondasExtra: resultado.pieza.rondasExtra,
    // Descartar los cambios los borra de verdad: dejar la lista escrita debajo
    // de una pieza sin decidir sería mentir sobre lo que va a recibir la agencia.
    cambios: evento.tipo === "descartar_cambios" ? [] : guardada.cambios,
  };

  const hito = DESDE_EL_PORTAL[evento.tipo];
  if (hito) pieza = anotar(pieza, hito, CLIENTE);

  // **Aprobar ya no muda el archivo a «Entregas finales».**
  //
  // Lo hacía, y estaba mal entendido de este lado: se creía que el archivo
  // aprobado *era* la entrega final. No lo es. La entrega final es otro
  // archivo —el mismo trabajo ya terminado de verdad, en el formato que va a
  // usarse: el PDF de imprenta, el empaquetado— y lo sube una persona del
  // equipo, aparte, cuando está.
  //
  // Mover el aprobado dejaba la misma pieza en dos lugares, sacaba el archivo
  // de la carpeta donde el equipo trabaja, y obligaba a un viaje de vuelta
  // cada vez que algo se reabría. Ahora la pieza aprobada se queda donde está,
  // marcada aprobada, y «Entregas finales» es lo que su nombre dice: donde el
  // equipo deja lo terminado.

  await guardarPieza(piezaId, pieza);

  // Se le avisa al equipo. Es el bucle que este proyecto vino a cerrar: hasta
  // hoy, nadie se enteraba salvo que entrara a mirar.
  // **Pedir una revisión adicional también avisa**, y es el que más falta
  // hacía: los otros cuentan algo que ya pasó; este deja a una pieza esperando
  // una decisión de la agencia. Sin aviso, el cliente quedaba esperando a que
  // alguien entrara a mirar por casualidad.
  const AVISAN: Partial<Record<Evento["tipo"], ClaseDeAviso>> = {
    aprobar: "aprobo",
    pedir_cambios: "pidio_cambios",
    pedir_revision_extra: "pidio_extra",
  };
  const clase = AVISAN[evento.tipo];

  if (clase) {
    await avisar({
      clase,
      clienteId: donde.cliente.id,
      cliente: donde.cliente.nombre,
      carpetaId,
      carpeta: donde.nombreDeLaCarpeta,
      // Cual pieza y de que vuelta. Decia "una pieza" a secas, y con eso el
      // aviso obligaba a entrar a mirar de que estaba hablando.
      detalle: enPalabrasLoRevisado([
        {
          nombre: nombreDePieza(piezaId),
          version: versionQueMira(guardada.ronda),
        },
      ]),
    });
  }

  return { ok: true, pieza };
}

/**
 * Reescribe la lista de cambios de una pieza.
 *
 * Anotar el primero es pedir cambios y borrar el último es arrepentirse: son
 * las dos únicas veces que tocar la lista mueve la pieza.
 */
export async function guardarCambiosDePieza(
  carpetaId: string,
  piezaId: string,
  cambios: Cambio[]
): Promise<RespuestaDePieza> {
  if (!(await quienEntro(carpetaId))) {
    return { ok: false, motivo: "No encontramos esa carpeta." };
  }

  if (!(await piezaDeLaCarpeta(carpetaId, piezaId))) {
    return { ok: false, motivo: "No encontramos esa pieza." };
  }

  if (!Array.isArray(cambios) || cambios.length > 100) {
    return { ok: false, motivo: "No pude leer los cambios." };
  }

  const limpios: Cambio[] = [];
  for (const cambio of cambios) {
    const texto = String(cambio?.texto ?? "").trim();
    const id = String(cambio?.id ?? "");
    if (!id || !texto) continue;
    limpios.push({ id, texto: texto.slice(0, LARGO_MAXIMO) });
  }

  const guardada = await estadoDe(carpetaId, piezaId);
  if (guardada.enviada) {
    return { ok: false, motivo: "Esta pieza ya se envió: lo escrito queda firme." };
  }

  let estado = guardada.estado;
  let ronda = guardada.ronda;

  const quiereMarcar = limpios.length > 0 && guardada.estado !== "cambios_marcados";
  const quiereSoltar = limpios.length === 0 && guardada.estado === "cambios_marcados";

  if (quiereMarcar || quiereSoltar) {
    const r = aplicar(
      {
        estado: guardada.estado,
        ronda: guardada.ronda,
        rondasIncluidas: RONDAS_INCLUIDAS_POR_DEFECTO,
        rondasExtra: guardada.rondasExtra,
      },
      { tipo: quiereMarcar ? "pedir_cambios" : "descartar_cambios" }
    );
    if (!r.ok) return { ok: false, motivo: r.motivo };
    estado = r.pieza.estado;
    ronda = r.pieza.ronda;
  }

  let pieza: EstadoDePieza = { ...guardada, carpetaId, estado, ronda, cambios: limpios };
  if (quiereMarcar) pieza = anotar(pieza, "cambios_pedidos", CLIENTE);
  if (quiereSoltar) pieza = anotar(pieza, "cambios_descartados", CLIENTE);

  await guardarPieza(piezaId, pieza);
  return { ok: true, pieza };
}

/**
 * Los cambios de una vuelta, escritos para leer.
 *
 * Empieza por la versión —«V1: …»— porque lo que se lee después es una lista
 * de vueltas, y sin el número no se sabe cuál de todas pidió qué.
 */
function cambiosEnPalabras(version: number, cambios: Cambio[]): string {
  return `V${version}: ${cambios.map((c, i) => `${i + 1}) ${c.texto}`).join("  ")}`;
}

/**
 * Cierra la revisión: la agencia recibe todo junto.
 *
 * Es el único acto de esta pantalla que la agencia ve, y no se deshace.
 */
export async function enviarRevision(
  carpetaId: string,
  soloEsta?: string
): Promise<RespuestaDeCarpeta> {
  const donde = await quienEntro(carpetaId);
  if (!donde) return { ok: false, motivo: "No encontramos esa carpeta." };

  let piezas: Array<{ id: string; archivos: string[] }>;
  try {
    piezas = conSusArchivos(
      carpetaId,
      agruparVersiones(await piezasDeLaCarpeta(carpetaId))
    );
  } catch {
    return { ok: false, motivo: "No pudimos leer la carpeta. Probá de nuevo." };
  }

  const estados = await estadosDe(carpetaId, piezas);
  const aGuardar: Record<string, EstadoDePieza> = {};
  // Que revisó, para el aviso. Se junta acá adentro y no después: la versión
  // es la que miraba **antes** de cerrar la vuelta, y guardada ya no la tiene.
  const revisadas: Array<{ nombre: string; version: number }> = [];

  for (const [id, guardada] of Object.entries(estados)) {
    if (soloEsta && id !== soloEsta) continue;
    if (guardada.enviada) continue;

    const r = aplicar(
      {
        estado: guardada.estado,
        ronda: guardada.ronda,
        rondasIncluidas: RONDAS_INCLUIDAS_POR_DEFECTO,
        rondasExtra: guardada.rondasExtra,
      },
      { tipo: "cerrar_revision" }
    );
    if (!r.ok) continue;

    // **Solo se cierra lo que de verdad cambia de estado.**
    //
    // El dominio contesta que sí para una pieza aprobada o esperando una
    // revisión adicional —cerrar la ronda no las toca—, y acá eso se tomaba
    // como «se envió»: la pieza quedaba marcada `enviada` sin haber mandado
    // nada. Para una aprobada da igual; para una que espera la revisión
    // adicional era un callejón sin salida: la agencia se la habilitaba, y el
    // cliente encontraba «ya se lo mandamos al equipo» y ningún botón para
    // usar la vuelta que acababa de pedir.
    if (r.pieza.estado === guardada.estado && r.pieza.ronda === guardada.ronda) {
      continue;
    }

    aGuardar[id] = anotar(
      {
        ...guardada,
        carpetaId,
        estado: r.pieza.estado,
        ronda: r.pieza.ronda,
        rondasExtra: r.pieza.rondasExtra,
        enviada: true,
      },
      "revision_enviada",
      CLIENTE,
      // **Qué pidió, y sobre qué versión.** Sin esto lo pedido se perdía al
      // entregar la vuelta siguiente: la lista se vacía —es lo correcto, la
      // revisión nueva empieza limpia— y lo único que quedaba era un renglón
      // diciendo que hubo cambios, sin decir cuáles. Dentro de un mes, «¿por
      // qué la v2 salió así?» no tenía respuesta.
      cambiosEnPalabras(versionQueMira(guardada.ronda), guardada.cambios)
    );

    revisadas.push({
      nombre: nombreDePieza(id),
      version: versionQueMira(guardada.ronda),
    });
  }

  await guardarPiezas(aGuardar);

  if (revisadas.length > 0) {
    await avisar({
      clase: "envio_revision",
      clienteId: donde.cliente.id,
      cliente: donde.cliente.nombre,
      carpetaId,
      carpeta: donde.nombreDeLaCarpeta,
      detalle: enPalabrasLoRevisado(revisadas),
    });
  }

  return { ok: true, piezas: { ...estados, ...aGuardar } };
}

// ---------------------------------------------------------------------------

export async function escribirComoCliente(
  carpetaId: string,
  texto: string
): Promise<RespuestaDeChat> {
  // La conversación es **del cliente**, y el cliente sale de la carpeta: si
  // llegara como parámetro, un pedido armado a mano podría escribir en la
  // conversación de otro.
  const donde = await quienEntro(carpetaId);
  if (!donde) return { ok: false, motivo: "No encontramos esa carpeta." };

  const limpio = String(texto ?? "").trim();
  if (!limpio) return { ok: false, motivo: "El mensaje está vacío." };
  if (limpio.length > LARGO_MAXIMO) {
    return { ok: false, motivo: "El mensaje es demasiado largo." };
  }

  try {
    const mensajes = await agregarMensaje(
      donde.cliente.id,
      "cliente",
      CLIENTE,
      limpio
    );

    await avisar({
      clase: "escribio",
      clienteId: donde.cliente.id,
      cliente: donde.cliente.nombre,
      carpetaId,
      carpeta: donde.nombreDeLaCarpeta,
    });

    return { ok: true, mensajes };
  } catch {
    return { ok: false, motivo: "No pudimos guardar el mensaje. Probá de nuevo." };
  }
}
