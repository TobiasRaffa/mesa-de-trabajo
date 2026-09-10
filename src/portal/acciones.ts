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
import { aplicar, type Evento } from "@/dominio/pieza";
import { entroAlCliente } from "@/lib/acceso";
import { avisar } from "@/lib/avisar";
import { clienteDeCarpeta, esCarpetaDelCliente } from "@/lib/carpetas";
import { datosDeCarpeta } from "@/lib/google";
import { agregarMensaje, LARGO_MAXIMO, type Mensaje } from "@/lib/conversaciones";
import { mudarAFinales } from "@/lib/entregasFinales";

import {
  anotar,
  estadoDe,
  estadosDe,
  guardarPieza,
  guardarPiezas,
  piezasDeLaCarpeta,
  type Cambio,
  type EstadoDePieza,
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
async function piezaDeLaCarpeta(carpetaId: string, piezaId: string): Promise<boolean> {
  if (!(await esCarpetaDelCliente(carpetaId))) return false;
  try {
    return (await piezasDeLaCarpeta(carpetaId)).some((a) => a.id === piezaId);
  } catch {
    return false;
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

  if (!(await piezaDeLaCarpeta(carpetaId, piezaId))) {
    return { ok: false, motivo: "No encontramos esa pieza." };
  }

  // El portal no puede aprobar en nombre de otro ni reabrir: son eventos de la
  // agencia. Se listan los permitidos en vez de prohibir los otros, para que
  // un evento nuevo del dominio no quede habilitado sin que nadie lo decida.
  const PERMITIDOS: Evento["tipo"][] = [
    "abrir",
    "aprobar",
    "pedir_cambios",
    "descartar_cambios",
    "pedir_revision_extra",
    "cerrar_revision",
  ];
  if (!PERMITIDOS.includes(evento?.tipo)) {
    return { ok: false, motivo: "Esa acción no se puede hacer desde el portal." };
  }

  const guardada = await estadoDe(carpetaId, piezaId);
  const rondasIncluidas = 2;

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

  if (evento.tipo === "aprobar") pieza = anotar(pieza, "aprobada", CLIENTE);
  if (evento.tipo === "pedir_cambios") pieza = anotar(pieza, "cambios_pedidos", CLIENTE);
  if (evento.tipo === "descartar_cambios") {
    pieza = anotar(pieza, "cambios_descartados", CLIENTE);
  }

  // **Aprobar muda el archivo a «Entregas finales».** Es una consecuencia, no
  // una condición: si Drive no contesta, la aprobación vale igual y se anota
  // que no se pudo mover.
  if (evento.tipo === "aprobar" && !pieza.mudada) {
    const mudanza = await mudarAFinales(donde.cliente.id, piezaId, carpetaId);
    if (mudanza.movida) {
      pieza = anotar({ ...pieza, mudada: true }, "movida_a_finales", "La aplicación");
    } else {
      pieza = anotar(pieza, "no_se_pudo_mover", "La aplicación", mudanza.motivo);
    }
  }

  await guardarPieza(piezaId, pieza);

  // Se le avisa al equipo. Es el bucle que este proyecto vino a cerrar: hasta
  // hoy, nadie se enteraba salvo que entrara a mirar.
  if (evento.tipo === "aprobar" || evento.tipo === "pedir_cambios") {
    await avisar({
      clase: evento.tipo === "aprobar" ? "aprobo" : "pidio_cambios",
      clienteId: donde.cliente.id,
      cliente: donde.cliente.nombre,
      carpetaId,
      carpeta: donde.nombreDeLaCarpeta,
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
        rondasIncluidas: 2,
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

  let archivos: string[];
  try {
    archivos = (await piezasDeLaCarpeta(carpetaId)).map((a) => a.id);
  } catch {
    return { ok: false, motivo: "No pudimos leer la carpeta. Probá de nuevo." };
  }

  const estados = await estadosDe(carpetaId, archivos);
  const aGuardar: Record<string, EstadoDePieza> = {};

  for (const [id, guardada] of Object.entries(estados)) {
    if (soloEsta && id !== soloEsta) continue;
    if (guardada.enviada) continue;

    const r = aplicar(
      {
        estado: guardada.estado,
        ronda: guardada.ronda,
        rondasIncluidas: 2,
        rondasExtra: guardada.rondasExtra,
      },
      { tipo: "cerrar_revision" }
    );
    if (!r.ok) continue;

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
      CLIENTE
    );
  }

  await guardarPiezas(aGuardar);

  const cuantas = Object.keys(aGuardar).length;
  if (cuantas > 0) {
    await avisar({
      clase: "envio_revision",
      clienteId: donde.cliente.id,
      cliente: donde.cliente.nombre,
      carpetaId,
      carpeta: donde.nombreDeLaCarpeta,
      detalle: `${cuantas} ${cuantas === 1 ? "pieza" : "piezas"}`,
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
