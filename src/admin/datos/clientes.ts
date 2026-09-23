// Los clientes que le tocan a quien está mirando.
//
// **Es el único lugar por el que la gestión pide clientes**, y esa es toda la
// idea. Los roles separan secciones; esto separa clientes: quien entra a
// «Clientes» veía las carpetas y los archivos de todos, y en una agencia con
// varias cuentas eso es demasiado.
//
// Podría estar repartido —un filtro en el árbol, otro en el tablero, otro en
// los chats— y ahí está la trampa: **un filtro que hay que acordarse de poner
// es un filtro que alguna vez falta**, y el día que falta, alguien ve la
// carpeta de un cliente que no lleva. Es la misma lección que la puerta.
//
// Por eso `@/lib/clientes` y `@/lib/carpetas` no se importan desde ninguna
// pantalla ni acción de gestión: se pasa por acá. Hay un guardián en
// `cimientos.test.ts` que lo verifica, porque esto no se nota leyendo el
// archivo que se olvidó.
//
// **El portal sigue usando los de `lib` directamente**, y tiene que ser así:
// del otro lado del mostrador no hay una persona de la agencia con un alcance,
// hay un cliente que entró por su link y solo se ve a sí mismo.

import {
  clientePorId,
  clientesHabilitados,
  todosLosClientes,
  type Cliente,
} from "@/lib/clientes";
import { carpetasConSuCliente, clienteDeCarpeta } from "@/lib/carpetas";
import { cadenaHasta, cuelgaDeAlguna } from "@/lib/permisos";
import { miAlcance, quienSoy } from "@/lib/sesion";
import { losAvisos, loVio, type AvisoMio } from "@/lib/avisos";
import { alcanzaA, recortaA } from "@/dominio/roles";

export type { Cliente };

/**
 * Los clientes habilitados que le tocan.
 *
 * Es lo que usan el árbol, el tablero, los chats y las facturas: cada uno pide
 * «los clientes» y recibe los suyos, sin tener que saber que existe un alcance.
 */
export async function misClientes(): Promise<Cliente[]> {
  return recortaA(await miAlcance(), await clientesHabilitados());
}

/**
 * Todos los que le tocan, habilitados o no.
 *
 * La diferencia importa en una sola pantalla: el árbol de clientes, que
 * muestra también los deshabilitados para poder volver a prenderlos.
 */
export async function todosMisClientes(): Promise<Cliente[]> {
  return recortaA(await miAlcance(), await todosLosClientes());
}

/**
 * Un cliente, si le toca.
 *
 * `null` tanto si no existe como si no es suyo, y a propósito: la pantalla que
 * lo recibe contesta «no encontrado» en los dos casos. Distinguirlos le diría
 * a quien prueba direcciones cuáles clientes tiene la agencia.
 */
export async function miCliente(id: string): Promise<Cliente | null> {
  const cliente = await clientePorId(id);
  if (!cliente) return null;
  return recortaA(await miAlcance(), [cliente]).length === 1 ? cliente : null;
}

/**
 * De qué cliente es una carpeta, si es de uno de los suyos.
 *
 * **Las acciones reciben identificadores de carpeta, no de cliente.** Entregar
 * un trabajo, cambiar el calendario, escribirle al cliente: todas llegan con
 * una carpeta de Drive. Sin esto, una carpeta ajena pasaba la validación de
 * «existe» y lo demás se deducía del servidor, que es justamente lo correcto
 * salvo que falte preguntar de quién es.
 *
 * Vale a cualquier hondura que muestre el árbol, y para la carpeta del cliente
 * misma. Se pregunta **como agencia**: la gestión trabaja también sobre lo que
 * escondió y sobre «Facturas», que el cliente no ve.
 */
export async function clienteDeMiCarpeta(carpetaId: string): Promise<Cliente | null> {
  const cliente = await clienteDeCarpeta(carpetaId, { comoAgencia: true });
  if (!cliente) return null;
  return recortaA(await miAlcance(), [cliente]).length === 1 ? cliente : null;
}

/** Si esa carpeta es de un cliente de los suyos. */
export const esCarpetaMia = async (carpetaId: string): Promise<boolean> =>
  (await clienteDeMiCarpeta(carpetaId)) !== null;

/**
 * Los avisos de los clientes que le tocan.
 *
 * **Un aviso nombra al cliente y la carpeta.** «Aprobó los stickers en Banners
 * de Cafe Otoño» le cuenta a quien lo lee exactamente lo que el alcance viene a
 * no mostrarle, y encima le infla el contador con cosas que no puede abrir.
 */
export async function misAvisos(): Promise<AvisoMio[]> {
  const [alcance, yo] = await Promise.all([miAlcance(), quienSoy()]);
  return (await losAvisos())
    .filter((a) => alcanzaA(alcance, a.clienteId))
    .map((a) => ({ ...a, loVi: loVio(a, yo?.id ?? null) }));
}

/**
 * Las carpetas de trabajo de los clientes que le tocan.
 *
 * Para validar lo que llega de afuera cuando además hace falta la lista entera
 * —guardar la configuración de una carpeta, por ejemplo—.
 */
export async function misCarpetas(): Promise<Set<string>> {
  const alcance = await miAlcance();
  const todas = await carpetasConSuCliente();
  if (alcance === "todos") return new Set(todas.keys());

  // **De una sola pasada sobre el mapa.** Preguntaba `esCarpetaMia` carpeta por
  // carpeta, en serie, y cada una de esas preguntas recorría a su vez todos los
  // clientes pidiéndole subcarpetas a Drive: con diez clientes y sesenta
  // carpetas eran hasta seiscientas llamadas encadenadas para validar un
  // formulario.
  const mias = new Set<string>();
  for (const [id, cliente] of todas) {
    if (alcanzaA(alcance, cliente.id)) mias.add(id);
  }
  return mias;
}

/**
 * Si algo —una carpeta a cualquier hondura, o un archivo— es de alguno de
 * **sus** clientes.
 *
 * Es lo que se pregunta antes de esconder o mostrar: `esCarpetaMia` alcanza
 * para las carpetas de primer nivel, pero lo que se esconde puede ser un
 * archivo o una subcarpeta, y para eso hay que subir por Drive hasta una raíz.
 * Las raíces son las de quien pregunta, no las de todos los clientes.
 */
export async function esDeMisClientes(id: string): Promise<boolean> {
  if (!id) return false;
  return cuelgaDeAlguna(
    id,
    (await misClientes()).map((c) => c.id)
  );
}

/**
 * Si esa carpeta cuelga de ese cliente —directo o más abajo—, y el cliente es
 * de los suyos.
 *
 * Existe porque las pantallas reciben los dos identificadores por la
 * dirección, y creerle a la dirección era el error: con un cliente propio en
 * la primera parte y una carpeta ajena en la segunda, se leía la carpeta
 * ajena.
 */
export async function esCarpetaDeMiCliente(clienteId: string, carpetaId: string): Promise<boolean> {
  if (!carpetaId || !(await miCliente(clienteId))) return false;
  return (await cadenaHasta(carpetaId, clienteId)).length > 0;
}
