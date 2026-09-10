// Mover lo aprobado a «Entregas finales».
//
// Es lo que la agencia ya hacía a mano y se olvidaba: cuando el cliente aprueba
// una pieza, el archivo se muda a la carpeta de finales del cliente. Ahí es
// donde el cliente lo va a buscar dentro de tres meses, sin tener que acordarse
// de en qué carpeta de trabajo estaba.
//
// Dos cosas que hacen esto seguro:
//
//   - **El robot no puede borrar.** Está comprobado contra Drive:
//     `canDelete: false`. Mover es lo único que puede hacer con un archivo, así
//     que el peor error posible es dejarlo en la carpeta equivocada.
//
//   - **Si algo falla, la aprobación vale igual.** Mover es una consecuencia de
//     aprobar, no una condición. Que Drive no conteste no puede deshacer la
//     decisión que tomó el cliente; se anota que no se pudo y sigue.

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
 * Muda un archivo aprobado a «Entregas finales».
 *
 * Nunca lanza: quien llama está en medio de guardar una aprobación y no puede
 * quedarse a mitad de camino por un problema de Drive.
 */
export async function mudarAFinales(
  clienteId: string,
  archivoId: string,
  carpetaDeOrigen: string
): Promise<ResultadoDeMudanza> {
  try {
    const destino = await carpetaDeFinales(clienteId);
    if (!destino) {
      return {
        movida: false,
        motivo: "El cliente no tiene una carpeta «Entregas finales» en Drive.",
      };
    }

    // Puede haberse movido a mano mientras tanto. Mover algo que ya está en
    // destino es un error de Drive, y además sería mentir en la historia.
    const datos = await metadatosArchivo(archivoId);
    const padres = datos.parents ?? [];
    if (padres.includes(destino)) return { movida: true };

    // Se saca de la carpeta de la que salió, no de «cualquiera de sus padres»:
    // en Drive un archivo puede estar en varias, y quitarlo de todas sería
    // decidir por la agencia algo que nadie pidió.
    if (!padres.includes(carpetaDeOrigen)) {
      return { movida: false, motivo: "El archivo ya no está en su carpeta de trabajo." };
    }

    await moverArchivo(archivoId, carpetaDeOrigen, destino);
    return { movida: true };
  } catch (error) {
    return {
      movida: false,
      motivo: error instanceof Error ? error.message : "Drive no contestó.",
    };
  }
}
