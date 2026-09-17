"use server";

// Lo que la app de gestión puede cambiar.
//
// **Una acción de servidor es un endpoint público.** Next le cambia el cuerpo
// por una referencia en el navegador, pero la dirección queda accesible para
// cualquiera que sepa mandar el POST. Que el formulario solo se dibuje en una
// pantalla interna no protege nada.
//
// Por eso acá no se cree nada de lo que llega: los identificadores se comparan
// contra lo que de verdad existe en Drive, y cada valor solo puede ser uno de
// los que conocemos. Sin eso, un POST armado a mano podría llenar los archivos
// de configuración con lo que quisiera.
//
// **Las de Admin preguntan además por su cuenta.** Una acción se manda a la
// dirección de la pantalla que la dibujó, así que `proxy.ts` ya rebota el POST
// de dar de alta gente: llega a `/gestion/admin`, que es la sección que esa
// pantalla es. Pero eso depende de dónde se dibujó el formulario, que es una
// decisión de quien arma la pantalla: el día que un formulario del equipo
// aparezca en otro lado, la puerta lo dejaría pasar. Por eso el equipo, los
// roles y las claves de los clientes preguntan con `puedoVer("admin")`, y hay
// un guardián en `cimientos.test.ts` que verifica que ninguna se olvide.

import { revalidatePath } from "next/cache";
import {
  ajustesDe,
  esCarpetaReservada,
  guardarAjustesDe,
  linkDeCarpeta,
  type Vista,
  mostrarUOcultar,
} from "@/lib/ajustes";
import { clientePorId } from "@/lib/clientes";
import {
  clienteDeCarpeta,
  esCarpetaDelCliente,
  idsDeCarpetasReales,
  olvidarCarpetas,
} from "@/lib/carpetas";
import { datosDeCarpeta } from "@/lib/google";
import { plazoDe, plazoQueCorre } from "@/lib/plazos";
import {
  habilitarCliente,
  mostrarDriveA,
  ponerTag,
  ponerTelefono,
  renovarLink,
  todosLosClientes,
} from "@/lib/clientes";
import {
  agregarMensaje,
  hayAnteriores,
  leerConversacion,
  leerConversacionEntera,
  LARGO_MAXIMO,
  type Mensaje,
} from "@/lib/conversaciones";
import {
  aplicar,
  hayAlgoParaEntregar,
  RONDAS_INCLUIDAS_POR_DEFECTO,
} from "@/dominio/pieza";
import { avisar } from "@/lib/avisar";
import { devolverDesdeFinales } from "@/lib/entregasFinales";
import {
  anotar,
  estadoDe,
  estadosDe,
  guardarPieza,
  guardarPiezas,
  piezasDeLaCarpeta,
  type EstadoDePieza,
} from "@/lib/piezas";

/**
 * Cuántas rondas entran en el presupuesto.
 *
 * **Vive en el dominio y en ningún otro lado.** Estuvo copiado en cinco: acá,
 * dos veces en las acciones del portal, una en lo que el portal le muestra al
 * cliente, y la del dominio. El día que se pueda poner por cliente —que es
 * donde se negocia de verdad— cambiar una y olvidar las otras deja al portal
 * dejando pedir cambios que el servidor rechaza, o al revés.
 */
const RONDAS_INCLUIDAS = RONDAS_INCLUIDAS_POR_DEFECTO;
import {
  agruparVersiones,
  comoVueltaDe,
  conSusArchivos,
  identidadDePieza,
} from "@/lib/versiones";
import { esDeAlgunCliente } from "@/lib/permisos";
import { contrasenaCorrecta, hayContrasena } from "@/lib/contrasena";
import { sacarClave } from "@/lib/claves";
import { correoValido } from "@/lib/equipo";
import { firmaDeAgencia, puedoVer } from "@/lib/sesion";
import { darPorAtendido } from "@/lib/olvidos";
import { esRol, esSeccion, seccionesDe, type Seccion } from "@/dominio/roles";
import {
  contenidoDe,
  heredadoDelCliente,
  type Contenido,
} from "@/admin/datos/arbol";
import { carpetaParaFechar } from "@/admin/datos/carpetas";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import { marcarTodosVistos } from "@/lib/avisos";
import {
  cambiarPersona,
  elEquipo,
  personaPorCorreo,
  sacarDelEquipo,
  seccionesDePersona,
  sumarAlEquipo,
} from "@/lib/equipo";
import { diasValidos, ponerPlazo } from "@/lib/plazos";
import { ponerResponsable } from "@/lib/responsables";
import { marcarLeido } from "@/lib/conversaciones";
import { renombrarArchivo, subcarpetasDe } from "@/lib/google";
import {
  esDiaValido,
  guardarPublicaciones,
  type DiaSuelto,
} from "@/lib/publicaciones";

export type Resultado = { ok: true } | { ok: false; motivo: string };

/**
 * Lo que contesta una acción de Admin a quien no entra a Admin.
 *
 * Es el mismo texto que contesta la puerta, a propósito: quien llegó hasta acá
 * sin pasar por Admin no tiene por qué enterarse de cuál de los dos cerrojos lo
 * frenó.
 */
const NO_ES_TUYO = { ok: false as const, motivo: "Esa parte no es tuya." };

// ---------------------------------------------------------------------------
// Carpetas

export async function guardarCarpeta(_previo: unknown, formulario: FormData) {
  const carpetaId = String(formulario.get("carpetaId") ?? "");
  const nombre = String(formulario.get("nombre") ?? "");

  const vistaCruda = String(formulario.get("vista") ?? "lista");

  if (!carpetaId) return { ok: false as const, motivo: "Falta la carpeta." };

  const reales = await idsDeCarpetasReales();
  if (!reales.has(carpetaId)) {
    return {
      ok: false as const,
      motivo: "Esa carpeta no está adentro de la carpeta de un cliente.",
    };
  }

  if (esCarpetaReservada(nombre)) {
    return {
      ok: false as const,
      motivo: "«Entregas finales» no se configura: no es un trabajo.",
    };
  }

  const vista: Vista = vistaCruda === "calendario" ? "calendario" : "lista";

  // Lo que no viene en el formulario se conserva: el link de la carpeta, quién
  // la lleva y hasta cuándo. Pisarlos con vacío sería perderlos cada vez que
  // alguien toca «ocultar».
  const previos = await ajustesDe(carpetaId);
  // La visibilidad no se toca acá: la maneja `cambiarVisibilidad`, y mandarla
  // de nuevo desde una pantalla que quedó vieja podía pisar lo que alguien
  // acababa de apagar.
  await guardarAjustesDe(carpetaId, { ...previos, vista });

  // La pantalla se vuelve a dibujar con lo guardado, en el mismo viaje.
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Clientes

async function esClienteReal(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    return (await todosLosClientes()).some((c) => c.id === id);
  } catch {
    return false;
  }
}

export async function cambiarCliente(_previo: unknown, formulario: FormData) {
  const clienteId = String(formulario.get("clienteId") ?? "");
  const habilitado = formulario.get("habilitado") === "si";

  if (!(await esClienteReal(clienteId))) {
    return { ok: false as const, motivo: "Ese cliente no existe." };
  }

  await habilitarCliente(clienteId, habilitado);
  // Habilitar un cliente cambia qué carpetas se administran: lo recordado
  // quedó viejo.
  olvidarCarpetas();
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * Si a este cliente se le muestran los links a Drive en su portal.
 *
 * Lo decide la agencia porque es la única que lo sabe: compartirle la carpeta
 * pasa en Drive, afuera de la aplicación. Apagado, los links **no se mandan**
 * al navegador del cliente, así que no hay forma de que aparezcan por error.
 */
export async function cambiarVerEnDrive(_previo: unknown, formulario: FormData) {
  const clienteId = String(formulario.get("clienteId") ?? "");
  const ver = formulario.get("verEnDrive") === "si";

  if (!(await esClienteReal(clienteId))) {
    return { ok: false as const, motivo: "Ese cliente no existe." };
  }

  await mostrarDriveA(clienteId, ver);
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * Le da un link nuevo a un cliente.
 *
 * Es cómo se corta el acceso a quien tenga el viejo: alguien que se fue de la
 * empresa del cliente, un link reenviado a quien no correspondía. El viejo
 * deja de funcionar en el acto.
 */
export async function renovarLinkDeCliente(_previo: unknown, formulario: FormData) {
  const clienteId = String(formulario.get("clienteId") ?? "");

  if (!(await esClienteReal(clienteId))) {
    return { ok: false as const, motivo: "Ese cliente no existe." };
  }

  await renovarLink(clienteId);
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * Le pone el tag a un cliente.
 *
 * Es la palabra que el cliente escribe para entrar. Sin tag, su portal no deja
 * pasar a nadie —ni con el link correcto—, que es el estado seguro mientras
 * alguien no decidió cuál va.
 *
 * **Pide la contraseña del equipo.** Es lo único que la pide: gestión abre sin
 * nada, pero la clave de un cliente es con lo que alguien entra a su portal, y
 * no tiene por qué estar a mano de quien se sienta en la computadora un rato.
 */
export async function ponerTagDeCliente(_previo: unknown, formulario: FormData) {
  if (!(await puedoVer("admin"))) return NO_ES_TUYO;

  const clienteId = String(formulario.get("clienteId") ?? "");
  const tag = String(formulario.get("tag") ?? "").trim();
  const contrasena = String(formulario.get("contrasena") ?? "");

  if (!hayContrasena()) {
    return {
      ok: false as const,
      motivo: "Falta configurar CLAVE_DE_ADMIN en .env.local.",
    };
  }
  if (!contrasenaCorrecta(contrasena)) {
    return { ok: false as const, motivo: "Esa contraseña no es." };
  }
  if (!(await esClienteReal(clienteId))) {
    return { ok: false as const, motivo: "Ese cliente no existe." };
  }
  if (tag.length < 3) {
    return { ok: false as const, motivo: "Poné al menos tres letras." };
  }

  await ponerTag(clienteId, tag);
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * Le anota el teléfono por donde se le escribe.
 *
 * **No pide contraseña, y la clave sí.** No es lo mismo: la clave abre el
 * portal, el teléfono es un dato de contacto que cualquiera del equipo tiene
 * en la agenda. Pedir la contraseña para algo que se consigue mirando un
 * mail es el trámite que hace que después nadie complete nada.
 */
export async function ponerTelefonoDeCliente(_previo: unknown, formulario: FormData) {
  const clienteId = String(formulario.get("clienteId") ?? "");
  const telefono = String(formulario.get("telefono") ?? "");

  if (!(await esClienteReal(clienteId))) {
    return { ok: false as const, motivo: "Ese cliente no existe." };
  }

  await ponerTelefono(clienteId, telefono);
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * Muestra la clave de un cliente, con la contraseña del equipo.
 *
 * **La clave no viaja al navegador hasta acá.** La pantalla solo sabe si el
 * cliente tiene una o no; el texto llega recién cuando alguien lo pide y
 * escribe la contraseña. Lo que no se manda no queda escrito en pantalla para
 * el que pasa por atrás, ni en la memoria del navegador.
 */
export async function verClaveDeCliente(
  _previo: unknown,
  formulario: FormData
): Promise<{ ok: true; clave: string } | { ok: false; motivo: string }> {
  if (!(await puedoVer("admin"))) return NO_ES_TUYO;

  const clienteId = String(formulario.get("clienteId") ?? "");
  const contrasena = String(formulario.get("contrasena") ?? "");

  if (!hayContrasena()) {
    return { ok: false, motivo: "Falta configurar CLAVE_DE_ADMIN en .env.local." };
  }
  if (!contrasenaCorrecta(contrasena)) {
    return { ok: false, motivo: "Esa contraseña no es." };
  }

  const cliente = await clientePorId(clienteId);
  if (!cliente) return { ok: false, motivo: "Ese cliente no existe." };
  return { ok: true, clave: cliente.tag };
}

export async function pedirLinkDeCarpeta(carpetaId: string): Promise<
  { ok: true; token: string } | { ok: false; motivo: string }
> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no está adentro de la de un cliente." };
  }
  try {
    const token = await linkDeCarpeta(carpetaId);
    revalidatePath("/gestion", "layout");
    return { ok: true, token };
  } catch {
    return { ok: false, motivo: "No pude generar el link." };
  }
}

// ---------------------------------------------------------------------------
// Calendario

/**
 * Se llama `pieza` y no `archivo` porque eso es lo que es.
 *
 * La fecha de publicación es de la pieza: subir una V2 no hace que haya que
 * volver a ponerla. Cuando esto se llamaba `archivo` y guardaba por
 * identificador de Drive, subir una vuelta nueva borraba la fecha del
 * calendario sin que nadie avisara.
 */
export type CambioDeFecha = { pieza: string; dia: DiaSuelto | null };

/**
 * Guarda las fechas de publicación de una carpeta, todas juntas.
 *
 * Se guarda de a una tanda y no pieza por pieza porque así se trabaja: se
 * acomodan varias en el calendario y recién ahí se aprieta guardar. Poder
 * cancelar sin haber tocado nada es la mitad del valor de tener un botón.
 */
export async function guardarCalendario(
  carpetaId: string,
  cambios: CambioDeFecha[]
): Promise<Resultado> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no está adentro de la carpeta de un cliente." };
  }

  if (!Array.isArray(cambios) || cambios.length > 500) {
    return { ok: false, motivo: "No pude leer los cambios." };
  }

  // Las piezas que llegan tienen que estar de verdad en esa carpeta: si no,
  // esto sería una forma de ponerle fecha a cualquier archivo de cualquier
  // cliente.
  const adentro = new Set(
    agruparVersiones(await piezasDeLaCarpeta(carpetaId)).map((p) =>
      identidadDePieza(carpetaId, p.versiones[0].archivo.name)
    )
  );

  const aGuardar: Record<string, DiaSuelto | null> = {};
  for (const cambio of cambios) {
    const pieza = String(cambio?.pieza ?? "");

    // **Descartar en silencio y contestar que sí es lo peor que puede hacer
    // esto.** Pasó: una pieza aprobada ya no estaba en el listado de Drive, su
    // cambio se salteaba, y la pantalla decía «Listo, el cliente ya lo ve
    // así». Si algo no se puede guardar, se dice.
    if (!adentro.has(pieza)) {
      return { ok: false, motivo: "Una de las piezas ya no está en la carpeta." };
    }

    if (cambio.dia === null) aGuardar[pieza] = null;
    else if (esDiaValido(cambio.dia)) aGuardar[pieza] = cambio.dia;
    else return { ok: false, motivo: "Hay una fecha que no existe." };
  }

  try {
    await guardarPublicaciones(aGuardar);
  } catch {
    return { ok: false, motivo: "No pude guardar las fechas. Probá de nuevo." };
  }

  revalidatePath("/gestion", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Conversación

export type RespuestaDeChat =
  | { ok: true; mensajes: Mensaje[] }
  | { ok: false; motivo: string };

/**
 * La agencia le contesta al cliente.
 *
 * Es la gemela de `escribirComoCliente`, del otro lado del mostrador. Están
 * separadas a propósito: **quién habla lo fija la acción, no el formulario**.
 * Con una sola acción y un parámetro, cualquiera podría mandar un POST desde
 * el portal diciendo ser la agencia.
 *
 * Y lo de siempre: acá contesta una persona. Esta función guarda lo que
 * alguien escribió y nada más.
 */
export async function escribirComoAgencia(
  clienteId: string,
  texto: string
): Promise<RespuestaDeChat> {
  if (!(await esClienteReal(clienteId))) {
    return { ok: false, motivo: "Ese cliente no existe." };
  }

  const limpio = String(texto ?? "").trim();
  if (!limpio) return { ok: false, motivo: "El mensaje está vacío." };
  if (limpio.length > LARGO_MAXIMO) {
    return { ok: false, motivo: "El mensaje es demasiado largo." };
  }

  try {
    // **Quién firma sale de la sesión, no del navegador.** Antes venía como
    // parámetro y había que elegirlo en un desplegable cada vez: hay que
    // acordarse de mirarlo, y el día que se firma mal no hay a quién
    // preguntarle. Ahora es quien dijo ser al entrar, y si no dijo nadie,
    // firma la agencia.
    const mensajes = await agregarMensaje(
      clienteId,
      "agencia",
      await firmaDeAgencia(),
      limpio
    );
    // La agencia leyó lo que había cuando contestó.
    await marcarLeido("agencia", clienteId);
    revalidatePath("/gestion", "layout");
    return { ok: true, mensajes };
  } catch {
    return { ok: false, motivo: "No pudimos guardar el mensaje. Probá de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Entregar

/**
 * Entrega lo que haya sin entregar en una carpeta.
 *
 * **Es el acto que faltaba.** El dominio tenía el evento `entregar` desde el
 * principio y no lo llamaba nadie: un archivo que aparecía en Drive nacía
 * entregado, así que el cliente lo veía —y lo podía aprobar— en el instante en
 * que se subía. El JPG a medio hacer, la prueba de color, el que se guardó en
 * la carpeta equivocada.
 *
 * Entrega **la carpeta entera y no pieza por pieza** porque así se trabaja: se
 * arma una tanda y se manda. Un botón por archivo sería el trámite que el
 * portal vino a sacar del medio.
 *
 * Acá arranca el plazo, y de acá sale el aviso al cliente.
 *
 * **Devuelve con qué avisarle.** No el mensaje armado: los datos para armarlo
 * —el nombre del trabajo, los días que corren, el link y el teléfono—. El
 * texto se termina en el navegador porque ahí está la dirección de la
 * aplicación, que el servidor no tiene forma de saber sin configurarla.
 *
 * La aplicación sigue sin escribirle a nadie: deja el mensaje listo y quien
 * entregó decide si lo manda, por dónde, y qué dice.
 */
export type ParaAvisar = {
  carpeta: string;
  /** Los días de revisión que corren en esta carpeta. */
  dias: number;
  /** El token del portal del cliente: con eso se arma el link. */
  token: string;
  /** Como lo escribieron. Vacío si nadie lo cargó. */
  telefono: string;
};

export async function entregarCarpeta(
  carpetaId: string,
  /**
   * Una sola pieza, si se entrega de a una.
   *
   * **Es la misma acción con distinto alcance, y por eso es una sola
   * función.** Entregar una carpeta y entregar un archivo hacen exactamente lo
   * mismo —el mismo evento del dominio, la misma firma, el mismo aviso, el
   * mismo mensaje para el cliente—; lo único que cambia es sobre cuántas
   * piezas corre. Escritas dos veces, la segunda se olvida de algo.
   */
  soloEsta?: string,
  /**
   * Los días que el cliente tiene para revisar **esto**.
   *
   * Se pregunta al entregar porque es el único momento en que alguien lo sabe
   * de verdad: hasta ahí es una regla general del cliente, y acá es «esto lo
   * necesito para el jueves». Escribirlo antes, en la configuración, obliga a
   * acordarse de volver a cambiarlo después; escribirlo acá es decirlo cuando
   * se está pensando.
   *
   * Queda guardado donde corresponde —en la pieza si se entrega una sola, en
   * la carpeta si se entrega la tanda— y de ahí en más corre solo.
   */
  dias?: number
): Promise<
  | { ok: true; entregadas: number; avisar: ParaAvisar | null }
  | { ok: false; motivo: string }
> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no existe." };
  }

  let agrupadas;
  try {
    agrupadas = agruparVersiones(await piezasDeLaCarpeta(carpetaId));
  } catch {
    return { ok: false, motivo: "No pude leer la carpeta en Drive." };
  }

  const conArchivos = conSusArchivos(carpetaId, agrupadas);
  const estados = await estadosDe(carpetaId, conArchivos);
  // En qué vuelta va cada pieza, según el nombre del archivo más alto que hay
  // en Drive. Es lo que se le entrega, y lo que queda anotado como entregado.
  const versionDe = new Map(conArchivos.map((p) => [p.id, p.version]));

  // El plazo se guarda **antes** de entregar: el vencimiento se calcula desde
  // la fecha de entrega con los días que corren, y si se guardara después la
  // primera pantalla que mire vería el plazo viejo.
  if (dias !== undefined) {
    // Se reusa la acción que ya existe y no se escribe el plazo a mano: es la
    // que sabe que poner un plazo en una carpeta tiene que dejar heredando a
    // sus piezas. Escrito dos veces, una de las dos se olvida de eso.
    const puesto = await guardarDiasDeRevision(
      soloEsta ? "archivo" : "carpeta",
      soloEsta ?? carpetaId,
      dias,
      carpetaId
    );
    if (!puesto.ok) return { ok: false, motivo: puesto.motivo };
  }

  const ahora = new Date().toISOString();
  // Quién lo hizo. Hoy dice «El equipo»; el día que haya login dirá el nombre
  // de quien apretó el botón, sin tocar nada de acá.
  const firma = await firmaDeAgencia();
  const cambios: Record<string, EstadoDePieza> = {};

  for (const [id, guardada] of Object.entries(estados)) {
    // Entregar de a una: el resto de la carpeta se queda donde está.
    if (soloEsta && id !== soloEsta) continue;

    // **Entregar la tanda no arrastra lo que no tiene nada nuevo.** Una pieza
    // que el cliente devolvió con cambios está de nuestro lado, pero hasta que
    // no aparezca la vuelta nueva entregarla le manda el mismo archivo que
    // acaba de devolver. Se saltea, como cualquier otra que no se pueda.
    //
    // Entregando de a una sí se deja: ahí alguien está mirando esa pieza y
    // decidiendo sobre ella. La pantalla se lo avisa antes.
    if (
      !soloEsta &&
      !hayAlgoParaEntregar(
        guardada.estado,
        versionDe.get(id) ?? 0,
        guardada.versionEntregada
      )
    ) {
      continue;
    }

    // Las reglas de qué se puede entregar **no están acá**: salen de
    // `aplicar()`, la misma función que corre en el navegador.
    const r = aplicar(
      {
        estado: guardada.estado,
        ronda: guardada.ronda,
        rondasIncluidas: RONDAS_INCLUIDAS,
        rondasExtra: guardada.rondasExtra,
      },
      { tipo: "entregar" }
    );
    // Una pieza que ya estaba entregada no es un error: se saltea y se sigue.
    if (!r.ok) continue;

    // **La vuelta nueva abre la revisión de cero.**
    //
    // Sin esto, entregar la V2 le llegaba al cliente con la lista de cambios
    // de la V1 todavía marcada como enviada, y el portal no le dejaba ni
    // aprobar ni pedir cambios: le mostraba «ya se lo mandamos al equipo»
    // encima de un archivo nuevo que nadie podía decidir. Quedaba trabado,
    // sin salida y sin decir por qué.
    //
    // Lo pedido no se pierde: se guarda en la historia, junto a la entrega que
    // lo contesta. Es la única forma de poder decir dentro de un mes «esta
    // vuelta salió por esto».
    const pedidos = guardada.cambios;

    cambios[id] = anotar(
      {
        ...guardada,
        estado: r.pieza.estado,
        entregadaEl: ahora,
        // **Qué vuelta se le entregó.** Es lo único que después contesta si
        // hay algo nuevo para mandarle: sin esto se deducía de la ronda, y con
        // una versión de más el tablero ofrecía entregarle el mismo archivo
        // que acababa de devolver.
        versionEntregada: versionDe.get(id),
        cambios: [],
        enviada: false,
      },
      "entregada",
      firma,
      pedidos.length > 0
        ? `Responde a: ${pedidos.map((c, i) => `${i + 1}) ${c.texto}`).join("  ")}`
        : undefined
    );
  }

  const cuantas = Object.keys(cambios).length;
  if (cuantas === 0) {
    return {
      ok: false,
      motivo: soloEsta
        ? "Esa pieza no está para entregar."
        : "No hay nada sin entregar en esta carpeta.",
    };
  }

  await guardarPiezas(cambios);

  // El aviso va después de guardar: si el correo falla, la entrega vale igual.
  const cliente = await clienteDeCarpeta(carpetaId);
  let paraAvisar: ParaAvisar | null = null;

  if (cliente) {
    let nombre = "una carpeta";
    try {
      nombre = (await datosDeCarpeta(carpetaId)).name;
    } catch {}
    await avisar({
      clase: "entregamos",
      clienteId: cliente.id,
      cliente: cliente.nombre,
      carpetaId,
      carpeta: nombre,
      detalle: `${cuantas} ${cuantas === 1 ? "pieza" : "piezas"}`,
    });

    paraAvisar = {
      carpeta: nombre,
      dias: plazoQueCorre(
        await plazoDe(carpetaId),
        undefined,
        await plazoDe(cliente.id)
      ),
      token: cliente.token,
      telefono: cliente.telefono,
    };
  }

  revalidatePath("/gestion", "layout");
  return { ok: true, entregadas: cuantas, avisar: paraAvisar };
}

// ---------------------------------------------------------------------------
// Lo que solo puede hacer la agencia sobre una pieza

/**
 * Encuentra una pieza de una carpeta y dice con qué archivo se corresponde.
 *
 * Lo mismo que hace el portal, y por el mismo motivo: la pieza no es un
 * archivo, así que su identificador no sirve para ir a buscarlo en Drive.
 */
async function laPieza(
  carpetaId: string,
  piezaId: string
): Promise<{ estado: EstadoDePieza; archivoActual: string } | null> {
  // **Que la carpeta sea de un cliente se pregunta acá, y no en cada acción.**
  // Reabrir una pieza y habilitar una revisión adicional entraban sin
  // preguntarlo, cuando todas sus hermanas lo preguntan: una acción de
  // servidor es un endpoint público y el identificador de carpeta que llega en
  // el pedido no se puede creer. Puesto acá, las dos quedan cubiertas y la
  // próxima que use esto también.
  if (!(await esCarpetaDelCliente(carpetaId))) return null;

  try {
    const agrupadas = agruparVersiones(await piezasDeLaCarpeta(carpetaId));
    for (const pieza of agrupadas) {
      if (identidadDePieza(carpetaId, pieza.versiones[0].archivo.name) !== piezaId) {
        continue;
      }
      return {
        estado: await estadoDe(carpetaId, piezaId),
        archivoActual: pieza.versiones[pieza.versiones.length - 1].archivo.id,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export type ResultadoDePieza =
  | { ok: true; motivo: string }
  | { ok: false; motivo: string };

/**
 * Reabre una pieza aprobada.
 *
 * **Aprobar es definitivo para el cliente, no para la agencia.** El dominio lo
 * dice desde el principio —«solo una administradora puede reabrirla»— y esa
 * administradora no existía: el día que un cliente aprobaba por error, no
 * había salida.
 *
 * Además devuelve el archivo a su carpeta de trabajo. Sin eso quedaría
 * reabierta en la aplicación y el archivo en el cajón de lo terminado, y en
 * Drive es donde la agencia trabaja.
 */
export async function reabrirPieza(
  carpetaId: string,
  piezaId: string
): Promise<ResultadoDePieza> {
  const cual = await laPieza(carpetaId, piezaId);
  if (!cual) return { ok: false, motivo: "No encontré esa pieza." };

  const firma = await firmaDeAgencia();
  const r = aplicar(
    {
      estado: cual.estado.estado,
      ronda: cual.estado.ronda,
      rondasIncluidas: RONDAS_INCLUIDAS,
      rondasExtra: cual.estado.rondasExtra,
    },
    { tipo: "reabrir", por: firma }
  );
  if (!r.ok) return { ok: false, motivo: r.motivo };

  let pieza = anotar(
    { ...cual.estado, estado: r.pieza.estado },
    "reabierta_por_agencia",
    firma
  );

  // La vuelta del archivo es una consecuencia, no una condición: si Drive no
  // contesta, la pieza queda reabierta igual y se anota que no se pudo mover.
  const cliente = await clienteDeCarpeta(carpetaId);
  if (pieza.mudada && cliente) {
    const vuelta = await devolverDesdeFinales(
      cliente.id,
      pieza.archivoMudado ?? cual.archivoActual,
      carpetaId
    );
    pieza = vuelta.movida
      ? anotar(
          { ...pieza, mudada: false, archivoMudado: undefined },
          "devuelta_a_su_carpeta",
          "La aplicación"
        )
      : anotar(pieza, "no_se_pudo_devolver", "La aplicación", vuelta.motivo);
  }

  await guardarPieza(piezaId, pieza);
  revalidatePath("/gestion", "layout");
  return { ok: true, motivo: "La pieza volvió a manos del cliente." };
}

/**
 * Habilita la revisión adicional que pidió el cliente.
 *
 * Se agotaron las rondas incluidas, el cliente pidió una más, y el portal le
 * dijo «te avisamos cuando la habiliten». No había dónde habilitarla: la pieza
 * quedaba esperando para siempre.
 */
export async function habilitarExtraDePieza(
  carpetaId: string,
  piezaId: string
): Promise<ResultadoDePieza> {
  const cual = await laPieza(carpetaId, piezaId);
  if (!cual) return { ok: false, motivo: "No encontré esa pieza." };

  const r = aplicar(
    {
      estado: cual.estado.estado,
      ronda: cual.estado.ronda,
      rondasIncluidas: RONDAS_INCLUIDAS,
      rondasExtra: cual.estado.rondasExtra,
    },
    { tipo: "habilitar_extra" }
  );
  if (!r.ok) return { ok: false, motivo: r.motivo };

  await guardarPieza(
    piezaId,
    anotar(
      { ...cual.estado, estado: r.pieza.estado, rondasExtra: r.pieza.rondasExtra },
      "extra_habilitada",
      await firmaDeAgencia()
    )
  );
  revalidatePath("/gestion", "layout");
  return { ok: true, motivo: "El cliente ya puede pedir los cambios." };
}

// ---------------------------------------------------------------------------
// Quién lleva cada trabajo, y hasta cuándo

/**
 * Pone los días de revisión en un nivel, y borra lo que haya debajo.
 *
 * Borrar lo de abajo es la parte importante: sin eso, cambiar el plazo del
 * cliente dejaría carpetas con el valor viejo y nadie sabría de dónde salió.
 */
type Nivel = "cliente" | "carpeta" | "archivo";

/**
 * Comprueba que el identificador sea real y devuelve qué queda debajo.
 *
 * Lo de abajo es lo que se va a dejar heredando otra vez. Un archivo se
 * comprueba contra su carpeta, que viene aparte: el identificador llega de
 * afuera y no se puede creer.
 */
async function nivelReal(
  nivel: Nivel,
  id: string,
  carpetaId?: string
): Promise<{ ok: true; debajo: string[] } | { ok: false; motivo: string }> {
  if (nivel === "cliente") {
    if (!(await esClienteReal(id))) return { ok: false, motivo: "Ese cliente no existe." };
    const carpetas = await subcarpetasDe(id);
    const archivos = await Promise.all(carpetas.map((c) => piezasDeLaCarpeta(c.id)));
    return {
      ok: true,
      debajo: [...carpetas.map((c) => c.id), ...archivos.flat().map((a) => a.id)],
    };
  }

  if (nivel === "carpeta") {
    if (!(await esCarpetaDelCliente(id))) {
      return { ok: false, motivo: "Esa carpeta no existe." };
    }
    return { ok: true, debajo: (await piezasDeLaCarpeta(id)).map((a) => a.id) };
  }

  if (!carpetaId || !(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no existe." };
  }
  if (!(await piezasDeLaCarpeta(carpetaId)).some((a) => a.id === id)) {
    return { ok: false, motivo: "Ese archivo no está en la carpeta." };
  }
  // Un archivo no tiene nada debajo.
  return { ok: true, debajo: [] };
}

export async function guardarDiasDeRevision(
  nivel: Nivel,
  id: string,
  dias: number,
  carpetaId?: string
): Promise<Resultado> {
  if (!diasValidos(dias)) {
    return { ok: false, motivo: "Los días tienen que ir de 1 a 30." };
  }

  const donde = await nivelReal(nivel, id, carpetaId);
  if (!donde.ok) return donde;

  await ponerPlazo(id, dias, donde.debajo);
  revalidatePath("/gestion", "layout");
  return { ok: true };
}

/**
 * Pone quién lleva algo, y deja heredando a todo lo que esté debajo.
 *
 * «Sin asignar» se guarda como una decisión y no como la falta de una: una
 * carpeta puesta en nadie no vuelve sola al responsable del cliente.
 */
export async function guardarResponsable(
  nivel: Nivel,
  id: string,
  personaId: string,
  carpetaId?: string
): Promise<Resultado> {
  if (personaId && !(await elEquipo()).some((p) => p.id === personaId)) {
    return { ok: false, motivo: "Esa persona no está en el equipo." };
  }

  const donde = await nivelReal(nivel, id, carpetaId);
  if (!donde.ok) return donde;

  await ponerResponsable(id, personaId || null, donde.debajo);
  revalidatePath("/gestion", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// El equipo

/**
 * Le pone o le cambia la contraseña a alguien del equipo.
 *
 * **Cualquiera del equipo puede cambiársela a cualquiera**, y es a propósito:
 * son tres personas en una oficina que ya comparten los clientes, los archivos
 * y la caja. La que se la olvida gira la silla y se la piden a la de al lado.
 * Un correo de recuperación sería un camino de entrada más para cuidar, a
 * cambio de resolver algo que se resuelve girando la silla.
 *
 * Nunca se guarda lo escrito: se guarda una huella, y en otro archivo que el
 * navegador no ve nunca.
 */
/**
 * **Dar de alta es un correo y un rol. No hay contraseña acá.**
 *
 * La elige esa persona la primera vez que entra, y desde ese momento no la
 * sabe nadie más —ni quien la dio de alta, porque nunca pasó por sus manos—.
 * Antes esta pantalla le ponía una contraseña a cualquiera, que es lo mismo
 * que decir que cualquiera de Admin podía entrar como cualquiera.
 *
 * El nombre no se pide: sale del correo, y esa persona lo corrige cuando entra
 * por primera vez, que es cuando sabe cómo quiere que la llamen.
 */
export async function darDeAlta(_previo: unknown, formulario: FormData) {
  if (!(await puedoVer("admin"))) return NO_ES_TUYO;

  const correo = String(formulario.get("correo") ?? "").trim();
  const rol = formulario.get("rol");

  if (!correoValido(correo)) {
    return { ok: false as const, motivo: "Ese correo no tiene forma de correo." };
  }
  if (!esRol(rol)) return { ok: false as const, motivo: "Elegí un rol." };

  // **Dos personas con el mismo correo es una puerta ambigua**: entrar buscaría
  // por correo y se quedaría con la primera, así que la segunda tendría una
  // ficha que no se abre nunca.
  if (await personaPorCorreo(correo)) {
    return { ok: false as const, motivo: "Ya hay alguien con ese correo." };
  }

  await sumarAlEquipo({ correo, rol });
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

export async function editarDelEquipo(_previo: unknown, formulario: FormData) {
  if (!(await puedoVer("admin"))) return NO_ES_TUYO;

  const id = String(formulario.get("id") ?? "");
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const correo = String(formulario.get("correo") ?? "").trim();

  const persona = (await elEquipo()).find((p) => p.id === id);
  if (!persona) return { ok: false as const, motivo: "Esa persona no está." };
  if (nombre.length < 2) return { ok: false as const, motivo: "Falta el nombre." };
  if (correo && !correoValido(correo)) {
    return { ok: false as const, motivo: "Ese correo no tiene forma de correo." };
  }

  const otra = correo ? await personaPorCorreo(correo) : null;
  if (otra && otra.id !== id) {
    return { ok: false as const, motivo: "Ya hay alguien con ese correo." };
  }

  await cambiarPersona(id, {
    nombre,
    correo,
    avisaDeTodo: formulario.get("avisaDeTodo") === "si",
    enDrive: String(formulario.get("enDrive") ?? "").trim(),
  });
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * A qué partes de la gestión entra alguien: su rol, y lo que se le da aparte.
 *
 * **Las sueltas suman y nunca restan.** Lo que da el rol no se puede destildar
 * desde acá: para quitarle algo a alguien se le cambia el rol, que es la
 * decisión que de verdad se está tomando. Tildar una que el rol ya da no
 * cambia nada, y la pantalla la muestra puesta y sin tocar.
 */
export async function cambiarAccesos(_previo: unknown, formulario: FormData) {
  if (!(await puedoVer("admin"))) return NO_ES_TUYO;

  const id = String(formulario.get("id") ?? "");
  const rol = formulario.get("rol");
  const sueltas = formulario.getAll("sueltas").filter(esSeccion);

  const persona = (await elEquipo()).find((p) => p.id === id);
  if (!persona) return { ok: false as const, motivo: "Esa persona no está." };
  if (!esRol(rol)) return { ok: false as const, motivo: "Elegí un rol." };

  const sinAdmin = await dejariaSinAdmin(id, seccionesDe(rol, sueltas));
  if (sinAdmin) return sinAdmin;

  await cambiarPersona(id, { rol, sueltas });
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * Le saca la contraseña a alguien: vuelve a poder elegir una.
 *
 * **No le pone una nueva, y esa es la diferencia.** Nadie elige la contraseña
 * de otro: esto la deja como recién dada de alta, y la próxima vez que entre
 * elige la suya. Es lo que contesta el «olvidé mi contraseña», así que de paso
 * el pedido queda dado por atendido.
 */
export async function reiniciarClaveDePersona(_previo: unknown, formulario: FormData) {
  if (!(await puedoVer("admin"))) return NO_ES_TUYO;

  const id = String(formulario.get("id") ?? "");
  if (!(await elEquipo()).some((p) => p.id === id)) {
    return { ok: false as const, motivo: "Esa persona no está." };
  }

  await sacarClave(id);
  await darPorAtendido(id);
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

export async function quitarDelEquipo(_previo: unknown, formulario: FormData) {
  if (!(await puedoVer("admin"))) return NO_ES_TUYO;

  const id = String(formulario.get("id") ?? "");

  const sinAdmin = await dejariaSinAdmin(id, []);
  if (sinAdmin) return sinAdmin;

  // Y con ella su contraseña: dejarla sería dejar abierta una puerta a nombre
  // de alguien que ya no está.
  await sacarClave(id);
  await sacarDelEquipo(id);
  revalidatePath("/gestion", "layout");
  return { ok: true as const };
}

/**
 * **La aplicación no puede quedarse sin nadie que la administre.**
 *
 * Es un lazo fácil de hacerse solo: quien administra se cambia el rol a
 * «Diseño» para ver cómo se ve, y desde ese momento nadie puede volver a
 * repartir roles —ni ella misma—. La llave del equipo no salva: ese camino se
 * cierra en cuanto alguien tiene contraseña. Quedaría editar un archivo a mano.
 */
async function dejariaSinAdmin(
  id: string,
  quedaria: readonly Seccion[]
): Promise<{ ok: false; motivo: string } | null> {
  if (quedaria.includes("admin")) return null;

  const otros = (await elEquipo()).filter(
    (p) => p.id !== id && seccionesDePersona(p).includes("admin")
  );
  if (otros.length > 0) return null;

  return {
    ok: false,
    motivo:
      "Sos la única persona que entra a Admin. Si te lo sacás, nadie puede " +
      "volver a repartir accesos. Dale Admin a otra persona primero.",
  };
}

/**
 * Vuelve a juntar un trabajo que un renombre partió en dos.
 *
 * **Se arregla donde se rompió: en el nombre del archivo.** Un trabajo se arma
 * juntando los archivos que, después de la marca de versión, dicen lo mismo, y
 * sacarle la marca a uno lo saca del grupo y funda otro trabajo. La aplicación
 * no muda lo anotado de un lado al otro —sería lo más delicado que podría
 * hacer, y un renombre raro se llevaría una historia a un lugar inesperado—:
 * le devuelve la marca al archivo, y el grupo se rehace solo.
 *
 * **Lo decide una persona, y por eso es un botón y no algo automático.** Desde
 * afuera no se puede saber si «stickers.pdf» y «stickers.jpg» son un trabajo
 * partido o el mismo trabajo entregado en dos formatos, que es algo que pasa
 * todo el tiempo. Acá la persona ya miró los dos.
 *
 * Si hay más de dos con ese nombre no hace nada: no hay a cuál unir sin
 * adivinar, y adivinar mal deja las vueltas colgadas del trabajo equivocado.
 */
export async function unirConLaOtra(
  carpetaId: string,
  piezaId: string
): Promise<Resultado> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no es de un cliente." };
  }

  try {
    // Por piezasDeLaCarpeta y no por Drive en crudo: una vuelta que se mudó a
    // «Entregas finales» sigue siendo parte del trabajo, y renombrar sin verla
    // le daría a otra el número que ya tenía.
    const agrupadas = agruparVersiones(await piezasDeLaCarpeta(carpetaId));
    const suelta = agrupadas.find((p) => `${carpetaId}::${p.base}` === piezaId);
    if (!suelta) return { ok: false, motivo: "Ese trabajo ya no está." };

    const otras = agrupadas.filter(
      (p) => p !== suelta && p.titulo.toLowerCase() === suelta.titulo.toLowerCase()
    );
    if (otras.length !== 1) {
      return {
        ok: false,
        motivo:
          otras.length === 0
            ? "Ya no hay otro trabajo con ese nombre."
            : "Hay más de dos con ese nombre: renombralos a mano, no puedo adivinar.",
      };
    }

    const destino = otras[0];

    // **Cada archivo conserva su número si puede.** Lo natural sería numerarlos
    // uno atrás del otro desde la última vuelta del destino, y eso renumera: la
    // V6 que el cliente ya vio en su portal pasaría a ser la V4, sin que nadie
    // se lo dijera. Solo se cambia el número del que chocaría con uno que ya
    // existe, que es cuando no hay alternativa.
    const tomados = new Set(destino.versiones.map((v) => v.numero));
    let libre = Math.max(...tomados) + 1;

    // De la vuelta más vieja a la más nueva, para que el orden se conserve.
    for (const v of suelta.versiones) {
      let numero = v.numero;
      if (tomados.has(numero)) {
        while (tomados.has(libre)) libre += 1;
        numero = libre;
      }
      tomados.add(numero);

      await renombrarArchivo(
        v.archivo.id,
        comoVueltaDe(v.archivo.name, destino.titulo, numero)
      );
    }

    olvidarCarpetas();
    revalidatePath("/gestion", "layout");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      motivo: error instanceof Error ? error.message : "No pude renombrar en Drive.",
    };
  }
}

// ---------------------------------------------------------------------------
// La bandeja

export async function marcarAvisosVistos(): Promise<void> {
  await marcarTodosVistos();
  revalidatePath("/gestion", "layout");
}

/** La agencia leyó la conversación de un cliente. */
export async function marcarChatLeido(clienteId: string): Promise<void> {
  if (!(await esClienteReal(clienteId))) return;
  await marcarLeido("agencia", clienteId);
  revalidatePath("/gestion", "layout");
}

// ---------------------------------------------------------------------------
// El árbol, nivel por nivel

/**
 * Las carpetas de un cliente, para cuando se abre su fila.
 *
 * Cada nivel se pide al abrirlo: leer de Drive todos los archivos de todos los
 * clientes para dibujar una lista cerrada sería pagar por adelantado algo que
 * casi nunca se mira.
 */
export type Abierta =
  | { ok: true; contenido: Contenido }
  | { ok: false; motivo: string };

export async function abrirCliente(clienteId: string): Promise<Abierta> {
  if (!(await esClienteReal(clienteId))) {
    return { ok: false, motivo: "Ese cliente no existe." };
  }
  try {
    return {
      ok: true,
      contenido: await contenidoDe(clienteId, await heredadoDelCliente(clienteId)),
    };
  } catch {
    return { ok: false, motivo: "No pude leer la carpeta en Drive." };
  }
}

/**
 * Lo que hay dentro de una carpeta, a cualquier profundidad.
 *
 * `esCarpetaDelCliente` comprueba que la carpeta cuelgue de un cliente: sin
 * eso, cualquiera con una dirección de gestión podría pedir el contenido de
 * una carpeta ajena del Drive del robot.
 */
export async function abrirCarpeta(
  carpetaId: string,
  heredado: { dias: number; responsable: string | null }
): Promise<Abierta> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no existe." };
  }
  try {
    return { ok: true, contenido: await contenidoDe(carpetaId, heredado) };
  } catch {
    return { ok: false, motivo: "No pude leer la carpeta en Drive." };
  }
}

/**
 * Todo lo que pasó en una carpeta, pieza por pieza.
 *
 * **Es lo que hace que la ventana del tablero sirva.** Mostraba el nombre y el
 * estado de cada pieza, y para saber qué había pedido el cliente —o qué
 * escribieron encima del archivo en Drive— había que irse a la pantalla de la
 * carpeta. Cuatro pantallas para contestar «¿por qué está frenado esto?».
 *
 * Va aparte de `abrirCarpeta` a propósito: eso dibuja el árbol y se pide
 * seguido; esto pregunta además por los comentarios de Drive —una vuelta por
 * pieza— y solo hace falta cuando alguien abre una ventana.
 */
export async function historiaDeCarpeta(
  carpetaId: string
): Promise<
  { ok: true; piezas: PiezaConHistoria[] } | { ok: false; motivo: string }
> {
  if (!(await esCarpetaDelCliente(carpetaId))) {
    return { ok: false, motivo: "Esa carpeta no existe." };
  }

  const cliente = await clienteDeCarpeta(carpetaId);
  if (!cliente) return { ok: false, motivo: "Esa carpeta no es de ningún cliente." };

  try {
    const { historia } = await carpetaParaFechar(cliente.id, carpetaId);
    return { ok: true, piezas: historia };
  } catch {
    return { ok: false, motivo: "No pude leer la carpeta en Drive." };
  }
}

/**
 * Prende o apaga: una carpeta, una subcarpeta o una pieza.
 *
 * Recibe **varios** identificadores porque una pieza son varios archivos —sus
 * vueltas— y apagarla tiene que apagarlas todas. Una carpeta manda uno solo.
 */
export async function cambiarVisibilidad(
  ids: string[],
  visible: boolean
): Promise<{ ok: boolean; motivo?: string }> {
  if (ids.length === 0) return { ok: false, motivo: "No me dijiste qué." };

  for (const id of ids) {
    // Vale tanto para una carpeta como para un archivo, así que se acepta
    // cualquiera de las dos comprobaciones. Lo que no se acepta es un
    // identificador suelto de Drive que no cuelgue de ningún cliente.
    const deUnCliente = (await esCarpetaDelCliente(id)) || (await esDeAlgunCliente(id));
    if (!deUnCliente) return { ok: false, motivo: "Eso no es de ningún cliente." };
  }

  for (const id of ids) await mostrarUOcultar(id, visible);
  revalidatePath("/gestion");
  return { ok: true };
}

/**
 * Los mensajes de un cliente, para la app de gestión.
 *
 * La ruta `/api/conversacion` es del portal y pide su galleta. Acá se lee por
 * acción: es el otro lado del mostrador y no tiene esa sesión.
 */
export async function traerConversacion(
  clienteId: string,
  /**
   * Traer también lo de antes.
   *
   * Por omisión llega solo el hilo vivo: lo viejo se pide a mano desde «ver lo
   * anterior». Preguntarlo cada seis segundos con tres años de charla adentro
   * sería pagar justo el precio que el techo vino a sacar.
   */
  entera = false
): Promise<
  | { ok: true; mensajes: Mensaje[]; hayAnteriores: boolean }
  | { ok: false; motivo: string }
> {
  if (!(await esClienteReal(clienteId))) {
    return { ok: false, motivo: "Ese cliente no existe." };
  }
  try {
    const [mensajes, hay] = await Promise.all([
      entera ? leerConversacionEntera(clienteId) : leerConversacion(clienteId),
      hayAnteriores(clienteId),
    ]);
    return { ok: true, mensajes, hayAnteriores: hay && !entera };
  } catch {
    return { ok: false, motivo: "No pude leer la conversación." };
  }
}
