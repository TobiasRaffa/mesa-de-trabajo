// Lo que el cliente escribió encima del archivo, en Drive, pasado a su lista
// de cambios pedidos.
//
// **Es la mitad de la devolución que la aplicación no veía.** El cliente abre
// el PDF, comenta en la hoja 7 señalando un pedazo del diseño, y eso vivía
// solo en Drive: la pantalla que dice «qué pidió el cliente» contaba la otra
// mitad, y alguien tenía que acordarse de ir a mirar las dos.
//
// Queda en los dos lados. El comentario sigue en Drive, donde está pegado al
// pedazo del archivo del que habla —que es justamente lo que lo hace útil
// ahí—, y acá aparece como un pedido más, con la hoja adelante.
//
// **Tres cosas que no hace, y cada una es una decisión:**
//
//   1. **No copia lo que escribe el equipo.** Desde Drive, un pedido del
//      cliente y una nota que el diseñador se deja a sí mismo son la misma
//      cosa: un nombre y un texto. Sin separarlos, esa nota entra a la lista
//      de cambios, se le entrega al cliente y gasta una vuelta del presupuesto.
//
//   2. **No cierra la vuelta.** El pedido queda en la lista igual que si el
//      cliente lo hubiera escrito en el portal, y la vuelta se cierra cuando
//      él toca «Enviar revisión». Un comentario suelto no es una devolución:
//      la devolución es cuando decide que terminó de escribir.
//
//   3. **No copia dos veces.** La lista de cambios se vacía al entregar la
//      vuelta siguiente, pero el comentario sigue en Drive: sin memoria de lo
//      ya copiado, volvería a aparecer en la lectura siguiente y el cliente
//      vería resucitar un pedido que ya le contestamos.
//
// **Se miran todas las versiones, no solo la última.** Un comentario vive en
// un archivo, y una pieza tiene un archivo por vuelta: leyendo solo el último,
// lo que el cliente escribió encima de la V1 desaparecía de la aplicación en
// cuanto se subía la V2 —y seguía ahí en Drive, esperando una respuesta que
// nadie iba a dar—. Los de versiones de antes se marcan con cuál, porque puede
// que hablen de algo que ya se cambió.
//
// **Mientras la revisión sigue abierta, los dos lados son el mismo.** Si el
// cliente corrige lo que escribió en Drive, o lo borra, acá pasa lo mismo: son
// una sola cosa mirada desde dos lugares, y dos textos distintos para el mismo
// pedido es peor que no tener el segundo. Cuando manda la revisión se congela:
// de ahí en más es lo que la agencia está trabajando, y cambiarlo por atrás
// sería cambiarle el pedido a alguien que ya empezó.

import {
  comoPedido,
  esDelEquipo,
  idDeDrive,
  idDelComentario,
  vieneDeDrive,
} from "@/dominio/comentarios";
import type { Cambio } from "@/lib/piezas";
import { aplicar, puedeEscribirCambios, RONDAS_INCLUIDAS_POR_DEFECTO } from "@/dominio/pieza";
import { comoFirmaElEquipo } from "@/lib/equipo";
import { comentariosDeArchivo, type ComentarioDeDrive } from "@/lib/google";
import { anotar, cambiarPieza, type EstadoDePieza } from "@/lib/piezas";

/** Una pieza, con todos sus archivos: uno por vuelta. */
export type PiezaConArchivos = {
  id: string;
  /**
   * Los archivos de la pieza, de la versión más vieja a la más nueva.
   *
   * Cada uno con qué número de versión es, para poder decirlo en el pedido
   * cuando no es el último.
   */
  archivos: Array<{ id: string; version: number }>;
};

export type ConComentarios = {
  estados: Record<string, EstadoDePieza>;
  /**
   * Los del cliente que **todavía no** son un pedido, por pieza.
   *
   * Son los que llegaron cuando la pieza no estaba de su lado: se muestran
   * aparte y entran a su lista cuando le vuelva a tocar. Los que ya se
   * copiaron no están acá **a propósito**: se ven una sola vez, como pedido,
   * y no dos veces en la misma pantalla diciendo lo mismo.
   */
  sinCopiar: Record<string, ComentarioDeDrive[]>;
};

/**
 * Pasa a pedidos los comentarios que el cliente dejó en Drive.
 *
 * Escribe, y por eso se llama desde donde se leen las piezas y no desde cada
 * pantalla: el portal y la gestión tienen que ver exactamente lo mismo, y dos
 * llamadas distintas es como empiezan a ver cosas distintas.
 *
 * **Nunca rompe.** Una carpeta con diez piezas son diez preguntas a Drive, y
 * ninguna de ellas puede tumbar la pantalla: si Drive no contesta, esa pieza
 * se deja como está y se sigue.
 */
export async function conLosComentariosDelCliente(
  piezas: PiezaConArchivos[],
  estados: Record<string, EstadoDePieza>
): Promise<ConComentarios> {
  if (piezas.length === 0) return { estados, sinCopiar: {} };

  const [firmas, porPieza] = await Promise.all([
    comoFirmaElEquipo(),
    Promise.all(
      piezas.map(async (p): Promise<ComentarioDeDrive[] | null> => {
        // Una pregunta por archivo. Son más que antes —una por vuelta en vez
        // de una por pieza— y es el precio de no perder lo que el cliente
        // escribió sobre las versiones de antes. Salen todas juntas.
        const porArchivo = await Promise.all(
          p.archivos.map(async (a) => {
            const leidos = await comentariosDeArchivo(a.id);
            return leidos && leidos.map((c) => ({ ...c, version: a.version }));
          })
        );
        // **Si una vuelta no se pudo leer, la pieza entera queda para la
        // próxima.** Un tropiezo de Google se leía como «no hay comentarios»,
        // y eso es «el cliente borró todo»: se sacaban de la lista los pedidos
        // ya copiados y, como seguían anotados como copiados, no volvían más.
        // No se sabe sobre qué vuelta se escribió cada pedido, así que no hay
        // forma de salvar solo una parte.
        const leidos: ComentarioDeDrive[] = [];
        for (const deUno of porArchivo) {
          if (!deUno) return null;
          leidos.push(...deUno);
        }
        return leidos;
      })
    ),
  ]);

  const salida = { ...estados };
  const sinCopiar: Record<string, ComentarioDeDrive[]> = {};

  // De a una y en orden, igual que al enviar la revisión.
  for (const [i, { id, archivos }] of piezas.entries()) {
    const foto = salida[id];
    const leidos = porPieza[i];
    if (!foto) continue;
    if (!leidos) {
      sinCopiar[id] = [];
      continue;
    }

    const ultima = archivos[archivos.length - 1]?.version;
    const delCliente = leidos.filter((c) => !esDelEquipo(c, firmas));

    // Se pregunta primero sobre la foto, para no ir a la base cuando no hay
    // nada que escribir, que es casi siempre.
    let final = foto;
    if (ponerAlDia(foto, delCliente, ultima)) {
      // **Y se escribe sobre lo que hay ahora, no sobre la foto.** La foto se
      // leyó antes de esperar a Drive, y escribir la pieza entera armada
      // encima de ella deshacía lo que otro guardó en el medio: una revisión
      // enviada, una aprobación, un cambio anotado. Lo leído de Drive es un
      // dato estable y vale como constante adentro de la transición.
      const r = await cambiarPieza<EstadoDePieza>(foto.carpetaId, id, (actual) => {
        const nueva = ponerAlDia(actual, delCliente, ultima);
        return nueva ? { commit: nueva } : { abort: actual };
      });
      final = "pieza" in r ? r.pieza : r.abort;
      salida[id] = final;
    }

    const copiados = new Set(final.comentariosCopiados ?? []);
    sinCopiar[id] = delCliente.filter((c) => !copiados.has(c.id));
  }

  return { estados: salida, sinCopiar };
}

/**
 * La pieza con lo que el cliente escribió en Drive, o `null` si no cambia nada.
 *
 * No tiene efectos: corre adentro de `cambiarPieza`, que puede llamarla más de
 * una vez.
 */
function ponerAlDia(
  estado: EstadoDePieza,
  /** Los comentarios del cliente, ya sin los del equipo. */
  delCliente: ComentarioDeDrive[],
  ultima: number | undefined
): EstadoDePieza | null {
  // Quien congela lo ya mandado es esta guarda: con la pieza de nuestro lado,
  // o ya enviada, no se escribe nada.
  if (!puedeEscribirCambios(estado.estado, estado.enviada)) return null;

  const yaCopiados = new Set(estado.comentariosCopiados ?? []);

  // **Lo ya copiado sigue al comentario mientras la vuelta esté abierta.**
  // Corregir en Drive lo que uno escribió es lo más común del mundo, y sin
  // esto la agencia recibía la primera redacción y el cliente veía la
  // segunda. Lo borrado en Drive se va; lo reescrito se reescribe.
  const enDrive = new Map(delCliente.map((c) => [c.id, c]));
  // Los que se sacan por resueltos dejan de contar como copiados: si alguien
  // los vuelve a abrir en Drive, tienen que poder entrar de nuevo. Solo los
  // resueltos, y solo los que estaban en la lista: lo contestado en una vuelta
  // anterior ya no está en ella, y ese no resucita.
  const resueltos = new Set<string>();
  const alDia = estado.cambios.flatMap((cambio) => {
    if (!vieneDeDrive(cambio.id)) return [cambio];
    const suyo = enDrive.get(idDeDrive(cambio.id));
    if (suyo?.resuelto) {
      resueltos.add(suyo.id);
      return [];
    }
    if (!suyo || !suyo.texto.trim()) return [];
    return [{ ...cambio, texto: comoPedido(suyo, ultima) }];
  });

  // Un comentario resuelto en Drive es una conversación terminada: entrarlo
  // como pedido nuevo sería reabrir algo que alguien ya cerró. Tampoco se
  // anota como copiado, por si lo vuelven a abrir.
  const nuevos = delCliente.filter(
    (c) => !yaCopiados.has(c.id) && !c.resuelto && c.texto.trim()
  );

  const cambios = [
    ...alDia,
    ...nuevos.map((c) => ({ id: idDelComentario(c.id), texto: comoPedido(c, ultima) })),
  ];

  if (nuevos.length === 0 && !distintos(estado.cambios, cambios)) return null;

  let pieza: EstadoDePieza = {
    ...estado,
    cambios,
    comentariosCopiados: [
      ...[...yaCopiados].filter((c) => !resueltos.has(c)),
      ...nuevos.map((c) => c.id),
    ],
  };

  // **La pieza se mueve igual que cuando el cliente escribe en el portal.**
  // Anotar el primer pedido la pasa a «cambios marcados», y quedarse sin
  // ninguno la devuelve a «en revisión». Sin esto el pedido copiado quedaba en
  // una pieza «entregada»: el portal no la juntaba para mandar, cerrar la
  // revisión no la movía, y el cliente tocaba «Enviar revisión» sin que nada
  // llegara a la agencia.
  const quiereMarcar =
    cambios.length > 0 && (estado.estado === "entregada" || estado.estado === "en_revision");
  const quiereSoltar = cambios.length === 0 && estado.estado === "cambios_marcados";

  if (quiereMarcar || quiereSoltar) {
    const r = aplicar(
      {
        estado: estado.estado,
        ronda: estado.ronda,
        rondasIncluidas: RONDAS_INCLUIDAS_POR_DEFECTO,
        rondasExtra: estado.rondasExtra,
      },
      { tipo: quiereMarcar ? "pedir_cambios" : "descartar_cambios" }
    );
    // Sin rondas, el dominio no deja marcar: lo que corresponde es pedir una
    // revisión adicional, y eso lo decide el cliente. El pedido queda anotado
    // en la lista igual —es lo que escribió— pero la pieza no se mueve.
    if (r.ok) {
      pieza = anotar(
        { ...pieza, estado: r.pieza.estado, ronda: r.pieza.ronda },
        quiereMarcar ? "cambios_pedidos" : "cambios_descartados",
        "Cliente",
        "Desde un comentario en Drive"
      );
    }
  }

  return pieza;
}

/** Si la lista de pedidos quedó distinta de como estaba. */
const distintos = (antes: Cambio[], ahora: Cambio[]) =>
  antes.length !== ahora.length ||
  antes.some((c, i) => c.id !== ahora[i].id || c.texto !== ahora[i].texto);
