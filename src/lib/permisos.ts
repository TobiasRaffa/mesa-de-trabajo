// Quién puede ver qué.
//
// Toda decisión de permisos vive acá y no desparramada en las pantallas: un
// olvido en un archivo suelto no puede abrir una puerta.
//
// Hoy la regla es simple porque todavía no hay usuarios ni base de datos: solo
// se sirven archivos que estén **dentro del árbol** de una carpeta que la
// aplicación administra. Cuando existan los accesos, esta misma función pasa a
// preguntar además si *esta persona* puede ver *ese* proyecto.
//
// **Por qué se sube por el árbol y no se mira solo la carpeta madre.** Lo que
// la agencia comparte con la aplicación es la carpeta del cliente; los
// archivos están más abajo, adentro de «Logos», «Calendario septiembre» y las
// que vayan creando. Mirando solo el padre directo, cada archivo real quedaba
// afuera y el portal se veía vacío. Mirar el árbol entero es lo que hace que
// la agencia pueda seguir armando carpetas en Drive sin avisarle a nadie.

import { clientesHabilitados } from "@/lib/clientes";
import { metadatosArchivo, type MetadatosArchivo } from "@/lib/google";

/**
 * Hasta dónde se sube buscando una carpeta administrada.
 *
 * Es un tope y no una expectativa: la estructura real tiene dos niveles. Sirve
 * para que un árbol muy profundo —o un ciclo, que Drive permite armar con
 * atajos— no se convierta en una cadena infinita de pedidos a Google.
 */
const NIVELES = 6;

/** Cuánto se recuerda de quién es hija cada carpeta. */
const RECUERDO_MS = 5 * 60 * 1000;

/**
 * Las carpetas madres se consultan muchas veces seguidas: una pantalla con
 * doce miniaturas pregunta doce veces por la misma carpeta. Sin esto, cada
 * imagen cuesta un viaje de red extra por cada nivel del árbol.
 *
 * El recuerdo es corto a propósito. Aun así, el riesgo real es bajo: quitarle
 * el acceso a la aplicación se hace dejando de compartir la carpeta en Drive,
 * y entonces el pedido a Google falla directamente, sin llegar a esta caché.
 */
const madresDe = new Map<string, { padres: string[]; vence: number }>();

/**
 * Carpetas que la aplicación administra: la de cada cliente habilitado.
 *
 * Deshabilitar un cliente en la app de gestión le corta el acceso a sus
 * archivos acá mismo, sin tocar Drive. Es el interruptor rápido; el definitivo
 * sigue siendo dejar de compartirle la carpeta al robot.
 *
 * Ya no se usa para autorizar: `archivoAutorizado` pregunta por **un** cliente,
 * el que abrió la puerta. Queda para saber qué administra la aplicación.
 */
export async function carpetasAdministradas(): Promise<string[]> {
  try {
    return (await clientesHabilitados()).map((c) => c.id);
  } catch {
    // Si no se puede saber qué se administra, no se administra nada.
    return [];
  }
}

/** Olvida lo aprendido del árbol. Existe para las pruebas. */
export function olvidarElArbol(): void {
  madresDe.clear();
}

async function padresDe(carpetaId: string): Promise<string[]> {
  const ahora = Date.now();
  const guardado = madresDe.get(carpetaId);
  if (guardado && guardado.vence > ahora) return guardado.padres;

  const datos = await metadatosArchivo(carpetaId);
  const padres = datos.parents ?? [];
  madresDe.set(carpetaId, { padres, vence: ahora + RECUERDO_MS });
  return padres;
}

/**
 * Sube por el árbol de carpetas buscando alguna administrada.
 *
 * Va por niveles y no en profundidad porque lo normal es encontrarla en el
 * primero o el segundo: así se corta antes y se gastan menos pedidos.
 */
async function desciendeDeAlgunaAdministrada(
  desde: string[],
  permitidas: string[]
): Promise<boolean> {
  const vistas = new Set<string>();
  let frontera = desde;

  for (let nivel = 0; nivel < NIVELES && frontera.length > 0; nivel++) {
    if (frontera.some((id) => permitidas.includes(id))) return true;

    const siguiente: string[] = [];
    for (const id of frontera) {
      // Una carpeta ya visitada no se vuelve a mirar: en Drive un elemento
      // puede tener varias madres, y sin esto un rombo se recorre dos veces.
      if (vistas.has(id)) continue;
      vistas.add(id);
      siguiente.push(...(await padresDe(id)));
    }
    frontera = siguiente;
  }

  return false;
}

/**
 * Autoriza un archivo **para un cliente**, y de paso devuelve sus datos.
 *
 * El segundo parámetro no es opcional a propósito. Antes la pregunta era «¿este
 * archivo cuelga de *algún* cliente habilitado?», y con esa respuesta se servía
 * el original a cualquiera: bastaba con conocer un identificador de Drive —que
 * lo ve todo aquel a quien le compartieron la carpeta— para bajarse el archivo
 * sin haber escrito nunca una clave. Y un cliente legítimo se bajaba los
 * archivos de otro.
 *
 * Que la firma exija saber de quién es hace que la próxima ruta que sirva bytes
 * no pueda olvidarse: no compila sin decirlo.
 *
 * Devuelve los datos en vez de un booleano porque quien autoriza ya tuvo que
 * pedírselos a Google, y hacer que el llamador los pida de nuevo sería pagar
 * dos viajes de red por cada imagen.
 */
export async function archivoAutorizado(
  fileId: string,
  carpetaDelCliente: string
): Promise<MetadatosArchivo | null> {
  if (!carpetaDelCliente) return null;

  try {
    const archivo = await metadatosArchivo(fileId);
    const adentro = await desciendeDeAlgunaAdministrada(archivo.parents ?? [], [
      carpetaDelCliente,
    ]);
    return adentro ? archivo : null;
  } catch {
    return null;
  }
}
