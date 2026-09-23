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
import { conSusArchivos, hastaLoEntregado } from "@/lib/versiones";
import { comoFirmaElCliente, enPalabrasLoRevisado } from "@/dominio/historia";
import { idDeDrive, vieneDeDrive } from "@/dominio/comentarios";
import { entradaDe } from "@/lib/acceso";
import { cadenaHasta } from "@/lib/permisos";
import { avisar } from "@/lib/avisar";
import type { ClaseDeAviso } from "@/lib/avisos";
import { clienteDeCarpeta, esCarpetaDelCliente } from "@/lib/carpetas";
import { datosDeCarpeta } from "@/lib/google";
import {
  agregarMensaje,
  anotarHito,
  LARGO_MAXIMO,
  type Mensaje,
} from "@/lib/conversaciones";

import {
  anotar,
  cambiarPieza,
  estadoDe,
  estadosDe,
  type Cambio,
  type EstadoDePieza,
  type Hito,
} from "@/lib/piezas";
import { trabajosDeLaCarpeta } from "@/lib/trabajos";

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
  const entrada = await entradaDe(await cookies());
  if (!entrada || entrada.cliente.id !== cliente.id) return null;

  // Entró por el link de una carpeta sola: solo esa carpeta, y lo que cuelgue
  // de ella. Con el identificador de otra carpeta del mismo cliente, no.
  //
  // **Cualquiera de las carpetas cuyo link abrió, no solo la primera.** Con
  // dos links del mismo cliente en el navegador —uno por mes es lo normal—,
  // la segunda carpeta abría y todas sus acciones contestaban que no existía.
  if (entrada.carpeta) {
    const suyas = entrada.carpetas ?? [entrada.carpeta];
    let alcanza = suyas.includes(carpetaId);
    for (const suya of suyas) {
      if (alcanza) break;
      alcanza = (await cadenaHasta(carpetaId, suya)).length > 0;
    }
    if (!alcanza) return null;
  }

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
  // **`cerrar_revision` no está, y antes sí.** Estaba con la idea de «que el
  // dominio lo valide igual», pero `moverPieza` no se detenía ahí: aplicaba el
  // evento, gastaba la vuelta —`ronda + 1`— y guardaba. Como el hito era
  // `null` no quedaba anotado nada, y como no está en `AVISAN` tampoco se
  // avisaba: un POST a mano sobre una pieza con cambios marcados le quemaba
  // una revisión al cliente, la mandaba a «Con el equipo» con `enviada` en
  // falso, y nadie se enteraba de que había pedidos esperando.
  //
  // Cerrar la vuelta es asunto de `enviarRevision`, que llama al dominio por
  // su cuenta, marca `enviada`, anota qué se pidió y avisa.
};

/**
 * Lo que vuelve al navegador de una pieza: **lo que la pantalla usa, nada más**.
 *
 * Se devolvía la ficha entera, y la respuesta de una acción se lee en la
 * pestaña Red: viajaban la historia —con el nombre propio de quien del equipo
 * hizo cada cosa y el motivo crudo de un error de Drive— y los ids de todas
 * las vueltas, incluida la que todavía no se entregó y que `/api/archivo`
 * sirve con solo pedirla. Es el mismo cuidado que ya tiene `PiezaDeCarpeta`
 * para lo que llega con la página.
 */
export type PiezaParaElCliente = Pick<
  EstadoDePieza,
  "estado" | "ronda" | "rondasExtra" | "cambios" | "enviada"
>;

function paraElCliente(p: EstadoDePieza): PiezaParaElCliente {
  return {
    estado: p.estado,
    ronda: p.ronda,
    rondasExtra: p.rondasExtra,
    cambios: p.cambios,
    enviada: p.enviada,
  };
}

export type RespuestaDePieza =
  | { ok: true; pieza: PiezaParaElCliente }
  | { ok: false; motivo: string };

export type RespuestaDeCarpeta =
  | { ok: true; cuantas: number; piezas: Record<string, PiezaParaElCliente> }
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
): Promise<LaQueMira | null> {
  if (!(await esCarpetaDelCliente(carpetaId))) return null;
  try {
    const agrupadas = (await trabajosDeLaCarpeta(carpetaId)).agrupadas;
    for (const pieza of agrupadas) {
      if (`${carpetaId}::${pieza.base}` !== piezaId) continue;
      // La vuelta que el cliente tiene delante es la que se le entregó, no la
      // última que hay en Drive: el portal le muestra hasta esa.
      return laQueMira(pieza, await estadoDe(carpetaId, piezaId));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * La vuelta que el cliente tiene delante: **la última que se le entregó**.
 *
 * Era «la última que hay en Drive», y eso nombraba una vuelta que el cliente no
 * veía: si el equipo subía la V3 mientras el cliente revisaba la V2, el aviso
 * al equipo decía «aprobó la v3». El portal le muestra hasta la vuelta
 * entregada, y el aviso tiene que nombrar esa misma.
 */
type LaQueMira = {
  /** El archivo de Drive: es el que se muda al aprobar. La pieza no es un
   *  archivo, así que su identificador no sirve para ir a buscarlo. */
  archivoActual: string;
  /**
   * Cómo se llama y qué número de vuelta es, **según el archivo**.
   *
   * No según la ronda. Se calculaba como «ronda + 1», y eso vale solo mientras
   * las dos cosas coincidan: el cliente miraba «V5_stickers.jpeg» y el aviso
   * al equipo decía «la v1 de stickers.pdf», que es el nombre de la identidad
   * de la pieza y el número de la ronda. Dos datos ciertos que juntos no
   * nombran nada que exista.
   */
  nombre: string;
  version: number;
};

function laQueMira<T extends { name: string; id: string }>(
  pieza: { versiones: Array<{ numero: number; archivo: T }> },
  /** Lo que se le entregó. Sin nada, la última que hay. */
  entregado: { versionEntregada?: number; archivoEntregado?: string } = {}
): LaQueMira {
  const hasta = hastaLoEntregado(pieza.versiones, {
    version: entregado.versionEntregada,
    archivo: entregado.archivoEntregado,
  });
  // Mismo criterio que el portal: si la entregada ya no está y solo quedan
  // vueltas más nuevas, se nombra la que hay antes que ninguna.
  const lista = hasta.length > 0 ? hasta : pieza.versiones;
  const ultima = lista[lista.length - 1];
  return {
    archivoActual: ultima.archivo.id,
    nombre: ultima.archivo.name,
    version: ultima.numero,
  };
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

  // **`hasOwnProperty` y no `in`.** `in` mira también la cadena de prototipos,
  // así que un evento armado a mano con `tipo: "constructor"` —o `"toString"`,
  // `"valueOf"`, cualquier cosa que herede de `Object.prototype`— pasaba este
  // filtro. `aplicar()` no tiene esos casos en su `switch` y devolvía
  // `undefined`, y la línea siguiente —`if (!resultado.ok)`— reventaba con un
  // TypeError no controlado: un 500 desde el portal, con solo una sesión de
  // cliente y un pedido a mano. Preguntar solo por las claves propias del
  // objeto cierra el paso.
  if (!Object.prototype.hasOwnProperty.call(DESDE_EL_PORTAL, evento?.tipo)) {
    return { ok: false, motivo: "Esa acción no se puede hacer desde el portal." };
  }

  const rondasIncluidas = RONDAS_INCLUIDAS_POR_DEFECTO;

  // Quién firma. Del otro lado hay «Cliente»; al aprobar puede decir su
  // nombre, y queda al lado. Lo que llega se limpia acá, no se le cree.
  const firma =
    evento.tipo === "aprobar" ? comoFirmaElCliente(CLIENTE, evento.por) : CLIENTE;

  // **La transición se calcula sobre el estado que hay ahora, no sobre una
  // foto.** Con `cambiarPieza`, aprobar mientras la agencia reabre —o al revés—
  // no pisa la decisión del otro: el que pierde la carrera vuelve a leer y
  // recalcula. Antes se leía, se calculaba y se guardaba en tres pasos, y una
  // de las dos decisiones desaparecía sin dejar rastro.
  //
  // **Aprobar ya no muda el archivo a «Entregas finales».** Eso está mal
  // entendido de este lado: la entrega final es otro archivo —el PDF de
  // imprenta, el empaquetado— que sube una persona del equipo, aparte. La pieza
  // aprobada se queda donde está, marcada aprobada.
  const cambio = await cambiarPieza<string>(carpetaId, piezaId, (actual) => {
    const resultado = aplicar(
      {
        estado: actual.estado,
        ronda: actual.ronda,
        rondasIncluidas,
        rondasExtra: actual.rondasExtra,
      },
      // Aprobar lleva quién: la firma la pone el servidor, no el navegador.
      evento.tipo === "aprobar" ? { tipo: "aprobar", por: firma } : evento
    );
    if (!resultado.ok) return { abort: resultado.motivo };

    let pieza: EstadoDePieza = {
      ...actual,
      carpetaId,
      estado: resultado.pieza.estado,
      ronda: resultado.pieza.ronda,
      rondasExtra: resultado.pieza.rondasExtra,
      // Descartar los cambios los borra de verdad: dejar la lista escrita
      // debajo de una pieza sin decidir sería mentir sobre lo que va a recibir
      // la agencia. **Aprobar también los borra**: aprobada es «sale tal cual
      // está», y lo anotado antes de decidirlo no es un pedido. Nada salió
      // todavía —la ronda no se mandó—, así que no hay nada que perder.
      cambios:
        evento.tipo === "descartar_cambios" || evento.tipo === "aprobar"
          ? []
          : actual.cambios,
    };

    const hito = DESDE_EL_PORTAL[evento.tipo];
    if (hito) pieza = anotar(pieza, hito, firma);
    return { commit: pieza };
  });

  if ("abort" in cambio) return { ok: false, motivo: cambio.abort };
  const pieza = cambio.pieza;

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
      detalle:
        enPalabrasLoRevisado([{ nombre: cual.nombre, version: cual.version }]) +
        (firma === CLIENTE ? "" : ` (${firma.slice(CLIENTE.length + 3)})`),
    });
  }

  return { ok: true, pieza: paraElCliente(pieza) };
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

  const recibidos: Cambio[] = [];
  for (const cambio of cambios) {
    const texto = String(cambio?.texto ?? "").trim();
    const id = String(cambio?.id ?? "");
    if (!id || !texto) continue;
    recibidos.push({ id, texto: texto.slice(0, LARGO_MAXIMO) });
  }

  // Se reescribe sobre el estado que hay ahora, no sobre una foto: si la
  // agencia entregó una vuelta nueva mientras el cliente escribía, la carrera
  // no borra ni lo uno ni lo otro.
  const cambio = await cambiarPieza<string>(carpetaId, piezaId, (guardada) => {
    if (guardada.enviada) {
      return { abort: "Esta pieza ya se envió: lo escrito queda firme." };
    }

    // **Un pedido que vino de Drive y el cliente corrigió acá, deja de seguir
    // a Drive.** Lo copiado de un comentario se mantiene al día con lo que diga
    // el comentario —corregirlo en Drive es lo normal—, así que la carga
    // siguiente le pisaba al cliente lo que acababa de corregir en el portal,
    // sin aviso. Si el texto que llega es distinto del guardado, lo escribió el
    // cliente: pasa a ser un pedido suyo, con un id propio. El comentario sigue
    // anotado como copiado, así que no vuelve a entrar repetido.
    const antes = new Map(guardada.cambios.map((c) => [c.id, c.texto]));
    const limpios = recibidos.map((c) =>
      vieneDeDrive(c.id) && antes.has(c.id) && antes.get(c.id) !== c.texto
        ? { ...c, id: `corregido:${idDeDrive(c.id)}` }
        : c
    );

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
      if (!r.ok) return { abort: r.motivo };
      estado = r.pieza.estado;
      ronda = r.pieza.ronda;
    }

    let pieza: EstadoDePieza = { ...guardada, carpetaId, estado, ronda, cambios: limpios };
    if (quiereMarcar) pieza = anotar(pieza, "cambios_pedidos", CLIENTE);
    if (quiereSoltar) pieza = anotar(pieza, "cambios_descartados", CLIENTE);
    return { commit: pieza };
  });

  if ("abort" in cambio) return { ok: false, motivo: cambio.abort };
  return { ok: true, pieza: paraElCliente(cambio.pieza) };
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

  let agrupadas;
  try {
    agrupadas = (await trabajosDeLaCarpeta(carpetaId)).agrupadas;
  } catch {
    return { ok: false, motivo: "No pudimos leer la carpeta. Probá de nuevo." };
  }
  const piezas = conSusArchivos(carpetaId, agrupadas);

  const estados = await estadosDe(carpetaId, piezas);

  // Cómo se llama y en qué vuelta va cada una: **la que se le entregó**, que
  // es lo que el cliente tiene delante y lo que el aviso tiene que nombrar. Se
  // arma después de leer los estados porque de ahí sale la vuelta entregada.
  const laVuelta: Record<string, { nombre: string; version: number }> = Object.fromEntries(
    agrupadas.map((pieza) => {
      const id = `${carpetaId}::${pieza.base}`;
      const { nombre, version } = laQueMira(pieza, estados[id]);
      return [id, { nombre, version }];
    })
  );
  const aGuardar: Record<string, EstadoDePieza> = {};
  // Que revisó, para el aviso. Se junta acá adentro y no después: la versión
  // es la que miraba **antes** de cerrar la vuelta, y guardada ya no la tiene.
  const revisadas: Array<{ nombre: string; version: number }> = [];

  // Cada pieza se cierra por separado y **con `cambiar`**: sobre el estado que
  // hay ahora, no sobre la foto que leyó `estadosDe`. Si la agencia entregó una
  // vuelta nueva mientras el cliente cerraba la revisión, ninguna de las dos
  // cosas se pierde. La versión de Drive —`laVuelta`— es un dato estable que se
  // leyó antes y vale como constante adentro de la transición.
  for (const id of Object.keys(estados)) {
    if (soloEsta && id !== soloEsta) continue;

    const cambio = await cambiarPieza<string>(carpetaId, id, (guardada) => {
      if (guardada.enviada) return { abort: "ya-enviada" };

      const r = aplicar(
        {
          estado: guardada.estado,
          ronda: guardada.ronda,
          rondasIncluidas: RONDAS_INCLUIDAS_POR_DEFECTO,
          rondasExtra: guardada.rondasExtra,
        },
        { tipo: "cerrar_revision" }
      );
      if (!r.ok) return { abort: "no-aplica" };

      // **Solo se cierra lo que de verdad cambia de estado.** El dominio
      // contesta que sí para una pieza aprobada o esperando una revisión
      // adicional —cerrar la ronda no las toca—, y acá eso se tomaba como «se
      // envió»: quedaba marcada `enviada` sin haber mandado nada. Para una que
      // espera la revisión adicional era un callejón sin salida.
      if (r.pieza.estado === guardada.estado && r.pieza.ronda === guardada.ronda) {
        return { abort: "sin-cambio" };
      }

      return {
        commit: anotar(
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
          // entregar la vuelta siguiente: la lista se vacía —es correcto, la
          // revisión nueva empieza limpia— y solo quedaba un renglón diciendo
          // que hubo cambios, sin decir cuáles.
          cambiosEnPalabras(laVuelta[id]?.version ?? guardada.ronda + 1, guardada.cambios)
        ),
      };
    });

    if ("pieza" in cambio) {
      aGuardar[id] = cambio.pieza;
      const suya = laVuelta[id];
      if (suya) revisadas.push(suya);
    }
  }

  if (revisadas.length > 0) {
    await anotarHito(
      donde.cliente.id,
      `Se envió la revisión de ${donde.nombreDeLaCarpeta} · ${revisadas.length} ${
        revisadas.length === 1 ? "pieza" : "piezas"
      }.`
    );
    await avisar({
      clase: "envio_revision",
      clienteId: donde.cliente.id,
      cliente: donde.cliente.nombre,
      carpetaId,
      carpeta: donde.nombreDeLaCarpeta,
      detalle: enPalabrasLoRevisado(revisadas),
    });
  }

  // **Cuántas viajaron de verdad.** Sin este número la pantalla contestaba
  // «Enviamos la revisión al equipo» pasara lo que pasara, incluso cuando el
  // dominio no había cerrado ninguna vuelta y no se había avisado a nadie.
  //
  // **Vuelven solo las que se cerraron.** Volvían también `estados`, que es
  // la carpeta entera —lo escondido, lo que no se entregó, lo que no es
  // imagen—, con el nombre de cada archivo en la clave. La pantalla solo
  // refresca las que cambiaron; las demás se quedan como estaban.
  return {
    ok: true,
    cuantas: revisadas.length,
    piezas: Object.fromEntries(
      Object.entries(aGuardar).map(([id, p]) => [id, paraElCliente(p)])
    ),
  };
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
