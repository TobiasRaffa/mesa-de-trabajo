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

import {
  comoPedido,
  esDelEquipo,
  idDelComentario,
} from "@/dominio/comentarios";
import { puedeEscribirCambios } from "@/dominio/pieza";
import { comoFirmaElEquipo } from "@/lib/equipo";
import { comentariosDeArchivo, type ComentarioDeDrive } from "@/lib/google";
import { guardarPiezas, type EstadoDePieza } from "@/lib/piezas";

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
 * ninguna de ellas puede tumbar la pantalla: si Drive no contesta, no hay
 * comentarios y se sigue.
 */
export async function conLosComentariosDelCliente(
  piezas: Array<{ id: string; ultimoArchivo: string }>,
  estados: Record<string, EstadoDePieza>
): Promise<ConComentarios> {
  if (piezas.length === 0) return { estados, sinCopiar: {} };

  const [firmas, porPieza] = await Promise.all([
    comoFirmaElEquipo(),
    Promise.all(piezas.map((p) => comentariosDeArchivo(p.ultimoArchivo))),
  ]);

  const salida = { ...estados };
  const sinCopiar: Record<string, ComentarioDeDrive[]> = {};
  const aGuardar: Record<string, EstadoDePieza> = {};

  piezas.forEach(({ id }, i) => {
    const estado = salida[id];
    if (!estado) return;

    const delCliente = porPieza[i].filter((c) => !esDelEquipo(c, firmas));
    const yaCopiados = new Set(estado.comentariosCopiados ?? []);

    // Un comentario resuelto en Drive es una conversación terminada: entrarlo
    // como pedido nuevo sería reabrir algo que alguien ya cerró. Tampoco se
    // anota como copiado, por si lo vuelven a abrir.
    const nuevos = delCliente.filter(
      (c) => !yaCopiados.has(c.id) && !c.resuelto && c.texto.trim()
    );

    const sePuede = puedeEscribirCambios(estado.estado, estado.enviada);

    if (sePuede && nuevos.length > 0) {
      const copiado: EstadoDePieza = {
        ...estado,
        cambios: [
          ...estado.cambios,
          ...nuevos.map((c) => ({ id: idDelComentario(c.id), texto: comoPedido(c) })),
        ],
        comentariosCopiados: [...yaCopiados, ...nuevos.map((c) => c.id)],
      };
      salida[id] = copiado;
      aGuardar[id] = copiado;
      for (const c of nuevos) yaCopiados.add(c.id);
    }

    sinCopiar[id] = delCliente.filter((c) => !yaCopiados.has(c.id));
  });

  // Se escribe solo cuando de verdad entró algo, y todo junto.
  if (Object.keys(aGuardar).length > 0) await guardarPiezas(aGuardar);

  return { estados: salida, sinCopiar };
}
