// Quién puede ver qué.
//
// Toda decisión de permisos vive acá y no desparramada en las pantallas: un
// olvido en un archivo suelto no puede abrir una puerta.
//
// Hoy la regla es simple porque todavía no hay usuarios ni base de datos: solo
// se sirven archivos que estén dentro de una carpeta que la aplicación
// administra. Cuando existan los accesos, esta misma función pasa a preguntar
// además si *esta persona* puede ver *ese* proyecto.

import { metadatosArchivo, type MetadatosArchivo } from "@/lib/google";

/** Carpetas que la aplicación administra. Más adelante salen de la base de datos. */
export function carpetasAdministradas(): string[] {
  const test = process.env.DRIVE_TEST_FOLDER;
  return test ? [test] : [];
}

/**
 * Autoriza un archivo y, de paso, devuelve sus datos.
 *
 * Devuelve los metadatos si el archivo está dentro de una carpeta administrada,
 * o `null` si no lo está o no se pudo verificar. Ante la duda, no se sirve.
 *
 * Devuelve los datos en vez de un booleano a propósito: quien autoriza ya tuvo
 * que pedírselos a Google, y hacer que el llamador los pida de nuevo sería
 * pagar dos viajes de red por cada imagen.
 */
export async function archivoAutorizado(fileId: string): Promise<MetadatosArchivo | null> {
  const permitidas = carpetasAdministradas();
  if (permitidas.length === 0) return null;

  try {
    const archivo = await metadatosArchivo(fileId);
    const estaAdentro = (archivo.parents ?? []).some((padre) => permitidas.includes(padre));
    return estaAdentro ? archivo : null;
  } catch {
    return null;
  }
}
