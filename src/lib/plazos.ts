// Cuánto tiempo tiene el cliente para revisar.
//
// Se cuenta en **días**, no en fechas. Una fecha hay que volver a poner en
// cada tanda; «tres días» se pone una vez y sirve siempre. La fecha en que
// vence cada pieza sale sola: el día que se subió el archivo, más los días.
//
// Se hereda cliente → carpeta → archivo, y lo de arriba borra lo de abajo. La
// mecánica de eso vive en `almacenHeredable`, que comparte con los
// responsables: es exactamente la misma regla.
//
// Y sigue valiendo la del principio: **el plazo avisa, no decide.** Que se
// cumpla no aprueba nada ni cierra nada. No hay un evento de vencimiento en el
// dominio y no lo va a haber.

import { almacenHeredable } from "@/lib/almacenHeredable";
import { diasValidos } from "@/lib/dias";

export { DIAS_POSIBLES, DIAS_POR_OMISION, diasValidos, plazoQueCorre } from "@/lib/dias";

const almacen = almacenHeredable<number>("plazos", diasValidos);

/** Los días puestos a mano. Sin entrada significa «hereda». */
export async function plazosDe(ids: string[]): Promise<Record<string, number>> {
  const crudo = await almacen.leerVarios(ids);
  const salida: Record<string, number> = {};
  // Un plazo en `null` no tiene sentido —no existe «sin plazo»— así que si
  // alguien lo dejó así a mano, se trata como si no estuviera.
  for (const [id, valor] of Object.entries(crudo)) {
    if (typeof valor === "number") salida[id] = valor;
  }
  return salida;
}

export async function plazoDe(id: string): Promise<number | undefined> {
  const valor = await almacen.leerUno(id);
  return typeof valor === "number" ? valor : undefined;
}

/**
 * Pasa el plazo propio de una pieza a su nombre nuevo.
 *
 * Por lo mismo que `mudarPublicacion`: la identidad de la pieza cambia cuando
 * se va la vuelta que le daba el nombre, y el plazo puesto a mano no puede
 * quedarse atrás y volver a heredarse sin que nadie lo decida.
 *
 * Se escribe con `poner` dejando «debajo» la clave vieja: es la forma que
 * tiene este almacén de guardar una y borrar la otra en una sola escritura.
 */
export async function mudarPlazo(
  viejo: string,
  nuevo: string,
  { pisar = false }: { pisar?: boolean } = {}
): Promise<void> {
  const deAntes = await almacen.leerUno(viejo);
  if (deAntes === undefined) return;
  const yaTenia = pisar ? undefined : await almacen.leerUno(nuevo);
  await almacen.poner(nuevo, yaTenia !== undefined ? yaTenia : deAntes, [viejo]);
}

export async function ponerPlazo(
  id: string,
  dias: number,
  debajo: string[] = []
): Promise<void> {
  await almacen.poner(id, dias, debajo);
}
