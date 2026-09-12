// Quién puede ver qué.
//
// Toda decisión de permisos vive acá y no desparramada en las pantallas: un
// olvido en un archivo suelto no puede abrir una puerta.
//
// **Hay dos clases de quien pregunta, y ven cosas distintas.**
//
//   - **Un cliente.** Ve lo que cuelga de **su** carpeta y nada más, y solo si
//     el camino hasta el archivo no pasa por nada escondido ni por «Facturas».
//     Eso es lo que convierte «ocultar» en una regla: sin ello, apagar una
//     carpeta en gestión solo dejaba de dibujarla, y el archivo se seguía
//     sirviendo a quien escribiera la dirección a mano.
//
//   - **La agencia.** Ve todo lo que el robot ve, de cualquier cliente,
//     incluido lo que ella misma escondió y las facturas. Esconder algo es una
//     decisión sobre qué ve el cliente, no sobre qué puede mirar quien la tomó;
//     si esconder algo también se lo sacara a la agencia, no habría dónde
//     volver a prenderlo.
//
// Los dos casos pasan por la misma función a propósito. Cuando la agencia no
// estaba contemplada, el arreglo obvio era «que esta pantalla no pida permiso»,
// y eso es cómo se abre un agujero: la segunda pantalla que lo necesite lo
// copia. Acá se dice **quién pregunta** y la respuesta se angosta sola.
//
// **Por qué se sube por el árbol y no se mira solo la carpeta madre.** Lo que
// la agencia comparte con la aplicación es la carpeta del cliente; los
// archivos están más abajo, adentro de «Logos», «Calendario septiembre» y las
// subcarpetas que vayan creando. Mirando solo el padre directo, cada archivo
// real quedaba afuera y el portal se veía vacío.
//
// En Drive una cosa puede tener **varias carpetas madre**. Alcanza con que
// exista un camino limpio hasta el cliente: negar por un camino sucio cuando
// hay otro bueno sería esconder algo que la agencia dejó a la vista.

import { clienteQueEntro } from "@/lib/acceso";
import { esCarpetaDeFacturas, escondidosEntre } from "@/lib/ajustes";
import { GALLETA_DE_GESTION, galletaDeGestionValida } from "@/lib/contrasena";
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
const madresDe = new Map<string, { padres: string[]; nombre: string; vence: number }>();

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

async function nodo(carpetaId: string): Promise<{ padres: string[]; nombre: string }> {
  const ahora = Date.now();
  const guardado = madresDe.get(carpetaId);
  if (guardado && guardado.vence > ahora) return guardado;

  const datos = await metadatosArchivo(carpetaId);
  const fresco = { padres: datos.parents ?? [], nombre: datos.name ?? "" };
  madresDe.set(carpetaId, { ...fresco, vence: ahora + RECUERDO_MS });
  return fresco;
}

/**
 * ¿Hay un camino limpio desde acá hasta la carpeta del cliente?
 *
 * Limpio quiere decir que ningún escalón del camino está escondido ni es
 * «Facturas». «Entregas finales» sí se atraviesa: ahí es donde termina lo que
 * el cliente aprobó, y el cliente tiene que poder seguir viéndolo.
 *
 * Va por niveles y no en profundidad porque lo normal es encontrar la raíz en
 * el primero o el segundo: así se corta antes y se gastan menos pedidos.
 */
async function hayCamino(
  desde: string[],
  raices: string[],
  /**
   * Si lo escondido corta el camino.
   *
   * El cliente ve lo que la agencia dejó visible. **La agencia ve todo**,
   * incluso lo que apagó: si no, apagar una carpeta la haría desaparecer de
   * gestión y ya no habría dónde volver a prenderla.
   */
  { respetarEscondidos }: { respetarEscondidos: boolean }
): Promise<boolean> {
  if (raices.length === 0) return false;

  const vistas = new Set<string>();
  let frontera = desde;

  for (let nivel = 0; nivel < NIVELES && frontera.length > 0; nivel++) {
    if (frontera.some((id) => raices.includes(id))) return true;

    // Se pregunta por toda la frontera de una vez: de a uno serían tantas
    // lecturas del almacén como carpetas tenga el camino.
    const escondidas = respetarEscondidos
      ? await escondidosEntre(frontera)
      : new Set<string>();

    const siguiente: string[] = [];
    for (const id of frontera) {
      // Una carpeta ya visitada no se vuelve a mirar: en Drive un elemento
      // puede tener varias madres, y sin esto un rombo se recorre dos veces.
      if (vistas.has(id)) continue;
      vistas.add(id);

      // Rama muerta: por acá no se llega, aunque más arriba esté la raíz.
      if (escondidas.has(id)) continue;

      const { padres, nombre } = await nodo(id);
      if (respetarEscondidos && esCarpetaDeFacturas(nombre)) continue;

      siguiente.push(...padres);
    }
    frontera = siguiente;
  }

  return false;
}

/** Quién está del otro lado de un pedido de archivo. */
export type QuienPide = { tipo: "cliente"; raiz: string } | { tipo: "agencia" };

/**
 * Autoriza un archivo **para quien lo pide**, y de paso devuelve sus datos.
 *
 * El segundo parámetro no es opcional a propósito. Antes la pregunta era «¿este
 * archivo cuelga de *algún* cliente habilitado?», y con esa respuesta se servía
 * el original a cualquiera: bastaba con conocer un identificador de Drive —que
 * lo ve todo aquel a quien le compartieron la carpeta— para bajarse el archivo
 * sin haber escrito nunca una clave. Y un cliente legítimo se bajaba los
 * archivos de otro.
 *
 * Que la firma exija saber quién pregunta hace que la próxima ruta que sirva
 * bytes no pueda olvidarse: no compila sin decirlo.
 *
 * Devuelve los datos en vez de un booleano porque quien autoriza ya tuvo que
 * pedírselos a Google, y hacer que el llamador los pida de nuevo sería pagar
 * dos viajes de red por cada imagen.
 */
export async function archivoAutorizado(
  fileId: string,
  quien: QuienPide
): Promise<MetadatosArchivo | null> {
  const deLaAgencia = quien.tipo === "agencia";
  if (!deLaAgencia && !quien.raiz) return null;

  try {
    const archivo = await metadatosArchivo(fileId);

    // El archivo en sí puede estar escondido aunque su carpeta se muestre.
    if (!deLaAgencia && (await escondidosEntre([fileId])).has(fileId)) return null;

    const raices = deLaAgencia ? await carpetasAdministradas() : [quien.raiz];
    const adentro = await hayCamino(archivo.parents ?? [], raices, {
      respetarEscondidos: !deLaAgencia,
    });
    return adentro ? archivo : null;
  } catch {
    return null;
  }
}

/**
 * Quién está pidiendo esto, mirando sus galletas.
 *
 * `null` es «nadie»: no hay sesión de cliente ni de agencia. Es la única
 * respuesta que no sirve para abrir nada, y es la de alguien que escribió una
 * dirección sin haber entrado por ninguna puerta.
 */
export async function quienPide(galletas: {
  get(nombre: string): { value: string } | undefined;
}): Promise<QuienPide | null> {
  // Primero la agencia: es una firma y no toca Drive. Buscar el cliente
  // recorre sus carpetas, y sería trabajo tirado cuando quien mira es el equipo.
  if (galletaDeGestionValida(galletas.get(GALLETA_DE_GESTION)?.value)) {
    return { tipo: "agencia" };
  }

  const cliente = await clienteQueEntro(galletas);
  return cliente ? { tipo: "cliente", raiz: cliente.id } : null;
}

/**
 * Si esto cuelga del árbol de algún cliente, mire quien mire.
 *
 * Es para gestión, y por eso **no** respeta lo escondido: la agencia tiene que
 * poder volver a prender lo que apagó. Sirve para no dejar que una pantalla de
 * gestión toque un identificador suelto de Drive que no sea de ningún cliente.
 */
export async function esDeAlgunCliente(id: string): Promise<boolean> {
  const raices = await carpetasAdministradas();
  if (raices.includes(id)) return true;

  try {
    const { parents } = await metadatosArchivo(id);
    return await hayCamino(parents ?? [], raices, { respetarEscondidos: false });
  } catch {
    return false;
  }
}

/**
 * El camino desde algo hasta la carpeta del cliente, de abajo hacia arriba.
 *
 * `["archivo", "Semana 1", "Septiembre", "<cliente>"]`. Devuelve una lista
 * vacía si no cuelga de esa raíz.
 *
 * Existe para la herencia: el plazo y quién lleva un trabajo se ponen en
 * cualquier escalón y valen para todo lo de abajo. Mientras la estructura tuvo
 * dos niveles alcanzaba con mirar la carpeta y el cliente; ahora que puede
 * haber subcarpetas adentro de subcarpetas, mirar solo dos escalones se saltea
 * al del medio —justamente donde suele estar puesto quién lo lleva—.
 *
 * Sube por **un** camino: el primero que llegue. En Drive una cosa puede tener
 * varias madres, pero heredar de dos lugares a la vez no significa nada, así
 * que se toma uno y se avisa con el orden en que Drive los devuelve.
 */
export async function cadenaHasta(id: string, raiz: string): Promise<string[]> {
  if (id === raiz) return [raiz];

  const vistas = new Set<string>([id]);
  let camino: string[] = [id];
  let actual = id;

  for (let nivel = 0; nivel < NIVELES; nivel++) {
    let padres: string[];
    try {
      padres = (await nodo(actual)).padres;
    } catch {
      return [];
    }

    if (padres.includes(raiz)) return [...camino, raiz];

    const seguir = padres.find((p) => !vistas.has(p));
    if (!seguir) return [];

    vistas.add(seguir);
    camino = [...camino, seguir];
    actual = seguir;
  }

  return [];
}
