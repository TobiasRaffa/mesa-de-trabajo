// Traer de vuelta lo que alguna vez se mudó a «Entregas finales».
//
// **Ya no se muda nada para allá.** Aprobar movía el archivo a la carpeta de
// finales, y era una idea equivocada de este lado: se creía que el archivo
// aprobado *era* la entrega final. No lo es. La entrega final es otro archivo
// —el mismo trabajo ya terminado, en el formato que va a usarse— y lo sube una
// persona del equipo, aparte.
//
// Queda la vuelta, y queda por una razón concreta: hay piezas guardadas de
// antes que sí se mudaron. Al reabrir una de esas hay que ir a buscar el
// archivo a donde quedó, o la pantalla diría una cosa y Drive tendría otra.
//
// Dos cosas que hacen esto seguro:
//
//   - **El robot no puede borrar.** Está comprobado contra Drive:
//     `canDelete: false`. Mover es lo único que puede hacer con un archivo, así
//     que el peor error posible es dejarlo en la carpeta equivocada.
//
//   - **Si algo falla, la decisión vale igual.** Mover es una consecuencia, no
//     una condición. Que Drive no conteste no puede deshacer lo que alguien
//     decidió; se anota que no se pudo y sigue.

import { esCarpetaReservada } from "@/lib/ajustes";
import { metadatosArchivo, moverArchivo, subcarpetasDe } from "@/lib/google";

/** El nombre exacto que se busca. Se compara sin distinguir mayúsculas. */
const FINALES = "entregas finales";

/**
 * La carpeta de finales de un cliente, o `null` si todavía no la creó.
 *
 * Se busca por nombre y no por identificador guardado porque así la agencia
 * puede armar un cliente nuevo entero desde Drive, sin configurar nada acá.
 */
async function carpetaDeFinales(clienteId: string): Promise<string | null> {
  const carpetas = await subcarpetasDe(clienteId);
  const encontrada = carpetas.find(
    (c) => esCarpetaReservada(c.name) && c.name.trim().toLowerCase().replace(/\s+/g, " ") === FINALES
  );
  return encontrada?.id ?? null;
}

export type ResultadoDeMudanza =
  | { movida: true }
  | { movida: false; motivo: string };

/**
 * Devuelve un archivo desde «Entregas finales» a su carpeta de trabajo.
 *
 * Es lo que hace falta al reabrir una pieza aprobada: sin esto quedaría
 * reabierta en la aplicación y el archivo seguiría en el cajón de lo
 * terminado, que es la peor mezcla —lo que dice la pantalla y lo que hay en
 * Drive dejarían de coincidir, y en Drive es donde la agencia trabaja—.
 *
 * Nunca lanza, por el mismo motivo que su gemela: quien llama está en medio de
 * guardar una decisión y no puede quedarse a mitad de camino.
 */
export async function devolverDesdeFinales(
  clienteId: string,
  archivoId: string,
  carpetaDeTrabajo: string
): Promise<ResultadoDeMudanza> {
  try {
    const finales = await carpetaDeFinales(clienteId);
    if (!finales) {
      return { movida: false, motivo: "El cliente no tiene «Entregas finales»." };
    }

    const datos = await metadatosArchivo(archivoId);
    const padres = datos.parents ?? [];

    // Ya está donde tiene que estar: alguien lo movió a mano mientras tanto.
    if (padres.includes(carpetaDeTrabajo)) return { movida: true };

    if (!padres.includes(finales)) {
      return { movida: false, motivo: "El archivo ya no está en «Entregas finales»." };
    }

    await moverArchivo(archivoId, finales, carpetaDeTrabajo);
    return { movida: true };
  } catch (error) {
    return {
      movida: false,
      motivo: error instanceof Error ? error.message : "Drive no contestó.",
    };
  }
}
