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

import { entradaDe, entroAlCliente } from "@/lib/acceso";
import { esCarpetaDeFacturas, escondidosEntre } from "@/lib/ajustes";
import { GALLETA_DE_GESTION } from "@/lib/contrasena";
import { quienLleva } from "@/lib/sesion";
import { recortaA, type Seccion } from "@/dominio/roles";
import { clientesHabilitados } from "@/lib/clientes";
import { alOlvidarDrive, metadatosArchivo, type MetadatosArchivo } from "@/lib/google";

/**
 * Hasta dónde se sube buscando una carpeta administrada.
 *
 * Es un tope y no una expectativa: la estructura real tiene dos niveles. Sirve
 * para que un árbol muy profundo —o un ciclo, que Drive permite armar con
 * atajos— no se convierta en una cadena infinita de pedidos a Google.
 */
const NIVELES = 6;

/**
 * Cuánto se recuerda de quién es hija cada carpeta.
 *
 * **Lo mismo que `google.ts`, medio minuto.** Eran cinco minutos, y lo que se
 * hace afuera, en Drive, no avisa: mover una carpeta de un cliente a otro, o
 * pasarla a «Facturas», dejaba al cliente viejo bajando los archivos cinco
 * minutos, mientras el nuevo ya la veía listada con las miniaturas rotas. Las
 * ráfagas de miniaturas caen todas adentro de medio minuto, que es para lo que
 * esto existe.
 */
const RECUERDO_MS = 30 * 1000;

/**
 * Las carpetas madres se consultan muchas veces seguidas: una pantalla con
 * doce miniaturas pregunta doce veces por la misma carpeta. Sin esto, cada
 * imagen cuesta un viaje de red extra por cada nivel del árbol.
 *
 * El recuerdo es corto a propósito. Quitarle el acceso a la aplicación se hace
 * dejando de compartir la carpeta en Drive, y entonces el pedido a Google falla
 * directamente, sin llegar a esta caché; mover o renombrar no falla, y por eso
 * no puede recordarse más que lo que recuerda Drive.
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

/** Olvida lo aprendido del árbol. */
export function olvidarElArbol(): void {
  madresDe.clear();
}

/**
 * **Y se olvida junto con lo demás cuando la aplicación toca Drive.**
 *
 * Esto existía solo para las pruebas, y era un agujero: `olvidarDrive()`
 * limpiaba la memoria de `google.ts` y dejaba esta intacta cinco minutos. Como
 * es la que dice qué carpeta cuelga de cuál, esconder una carpeta o devolver
 * un archivo desde «Entregas finales» seguía dejando pasar al cliente por el
 * camino viejo, y el aviso le llegaba a quien llevaba la carpeta anterior.
 */
alOlvidarDrive(olvidarElArbol);

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

  // **La última frontera también se mira.** El bucle pedía los padres del
  // último nivel y salía sin compararlos, así que el tope real quedaba uno
  // por debajo de `NIVELES`: el portal listaba la carpeta del sexto nivel y
  // acá se negaban sus archivos.
  return frontera.some((id) => raices.includes(id));
}

/**
 * Quién está del otro lado de un pedido de archivo.
 *
 * **La agencia trae sus raíces, no un permiso general.** Antes era `{ tipo:
 * "agencia" }` a secas y con eso se autorizaba contra las carpetas de *todos*
 * los clientes: una diseñadora que solo lleva una cuenta se bajaba el archivo
 * de otra con solo conocer su identificador de Drive. Ahora trae las carpetas
 * de los clientes que le tocan, y la comprobación es la misma que la del
 * cliente: ¿cuelga de alguna de estas raíces?
 */
export type QuienPide =
  | {
      tipo: "cliente";
      raiz: string;
      /**
       * Todas las carpetas cuyo link abrió, si entró por más de un link de carpeta
       * del mismo cliente. Sin esto, con dos links abiertos en el navegador, la
       * segunda carpeta se veía pero sus miniaturas y archivos daban «no
       * encontrado»: se autorizaba solo contra la primera.
       */
      raices?: string[];
    }
  | {
      tipo: "agencia";
      raices: string[];
      /**
       * A qué partes de la gestión entra.
       *
       * **Estaba solo en las pantallas y en las acciones, no acá**, y esa era
       * la única puerta de la aplicación por la que los roles no pasaban: el
       * `proxy` separa por sección mirando la ruta y su matcher nunca incluyó
       * `/api`, así que cualquier sesión de gestión valía lo mismo en las
       * rutas. Alguien de Facturación se bajaba el historial entero de piezas,
       * entregas y aprobaciones de un cliente con escribir la dirección.
       */
      secciones: Seccion[];
    };

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
/** Lo que Drive contesta cuando algo es una carpeta y no un archivo. */
const CARPETA_DE_DRIVE = "application/vnd.google-apps.folder";

export async function archivoAutorizado(
  fileId: string,
  quien: QuienPide
): Promise<MetadatosArchivo | null> {
  const deLaAgencia = quien.tipo === "agencia";
  if (!deLaAgencia && !quien.raiz) return null;

  try {
    const archivo = await metadatosArchivo(fileId);

    // **Una carpeta no es un archivo.** Pedir una por esta puerta llegaba
    // hasta el final y reventaba al intentar descargarla: un 502 donde tenía
    // que haber un «no encontrado». Además contestaba distinto según el id
    // fuera de una carpeta del cliente o de cualquier otra cosa, que es una
    // forma de contar qué existe adentro sin mostrarlo.
    if (archivo.mimeType === CARPETA_DE_DRIVE) return null;

    // **Lo que está en la papelera ya no está.** Pedido por identificador,
    // Drive lo sigue contestando con sus carpetas madre intactas, y se servía
    // hasta que se vaciara: un archivo subido por error a otro cliente y
    // tirado seguía bajándose con el link viejo. Tampoco para la agencia: lo
    // tirado no es trabajo de nadie.
    if (archivo.trashed) return null;

    // El archivo en sí puede estar escondido aunque su carpeta se muestre.
    if (!deLaAgencia && (await escondidosEntre([fileId])).has(fileId)) return null;

    const raices = quien.tipo === "agencia" ? quien.raices : (quien.raices ?? [quien.raiz]);
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
async function quienPide(galletas: Galletas): Promise<QuienPide | null> {
  // Primero la agencia: es una firma y no toca Drive. Buscar el cliente
  // recorre sus carpetas, y sería trabajo tirado cuando quien mira es el equipo.
  const sesion = await quienLleva(galletas.get(GALLETA_DE_GESTION)?.value);
  if (sesion) {
    // Las raíces salen del alcance de esa persona. Con `"todos"` son las de
    // todos los clientes, que es lo que era antes para cualquiera.
    const administradas = await carpetasAdministradas();
    return {
      tipo: "agencia",
      raices: recortaA(
        sesion.clientes,
        administradas.map((id) => ({ id }))
      ).map((c) => c.id),
      secciones: sesion.secciones,
    };
  }

  // Quien entró por el link de una carpeta ve esa carpeta: su raíz es la
  // carpeta, no el cliente entero.
  const entrada = await entradaDe(galletas);
  if (!entrada) return null;
  const raiz = entrada.carpeta ?? entrada.cliente.id;
  return { tipo: "cliente", raiz, raices: entrada.carpetas ?? [raiz] };
}

/** Lo que hace falta para leer una galleta, sin depender de cómo se leyó. */
type Galletas = { get(nombre: string): { value: string } | undefined };

/**
 * Quién sirve cada ruta de `/api`.
 *
 * **Se declara por ruta y en su propio archivo, al lado de lo que protege.**
 * Es la forma de que la separación por sección alcance también a las rutas:
 * el `proxy` la aplica mirando la dirección, y su matcher cubre `/gestion` y
 * `/diagnostico` pero no `/api`, así que ahí la decisión tiene que viajar con
 * la ruta.
 *
 * Las dos mitades se escriben aparte porque son dos preguntas distintas y
 * ninguna se puede deducir de la otra: hay rutas que sirven a los dos lados
 * —un archivo lo baja el cliente y también la agencia—, una que es solo de la
 * agencia —el historial en CSV— y una que es solo del cliente —el sondeo de la
 * conversación, que del lado de la agencia va por una acción—.
 */
export type Puerta = {
  /**
   * Qué secciones de gestión entran. `null` es «la agencia no entra por acá».
   *
   * Nunca es «todas»: una lista vacía o un `null` son decisiones, y escribir la
   * lista obliga a pensar de qué sección es lo que esta ruta devuelve.
   */
  agencia: readonly Seccion[] | null;
  /** Si entra quien vino por el link del portal. */
  cliente: boolean;
};

/**
 * Quién pide, **ya comprobado contra la puerta de esta ruta**.
 *
 * `null` es «acá no entra»: no hay galleta de ninguno de los dos lados, o la
 * hay y esa ruta no es para esa sección. Quien la llama contesta 404 sin
 * distinguir los casos, que es lo que evita contarle a alguien qué existe del
 * otro lado de una puerta que no puede abrir.
 *
 * **Es la única forma de saber quién pide.** `quienPide` quedó adentro de este
 * módulo a propósito: mientras fue pública, una ruta podía preguntar «¿quién
 * es?» y olvidarse de «¿le toca?» —y las cuatro se olvidaron—. Ahora no hay
 * manera de preguntar lo primero sin contestar lo segundo, porque la sección es
 * un argumento y no una llamada aparte que alguien tiene que acordarse de
 * escribir.
 */
export async function quienPideEn(
  galletas: Galletas,
  puerta: Puerta
): Promise<QuienPide | null> {
  const quien = await quienPide(galletas);
  if (!quien) return null;

  if (quien.tipo === "cliente") return puerta.cliente ? quien : null;

  if (!puerta.agencia) return null;
  return puerta.agencia.some((s) => quien.secciones.includes(s)) ? quien : null;
}

/**
 * Lo mismo, para una ruta que sirve los datos de **un** cliente.
 *
 * Junta las dos preguntas que si no habría que acordarse de hacer por separado
 * en cada ruta: **¿esta puerta es para vos?** y **¿este cliente es tuyo?**. La
 * segunda se contestaba a mano y distinto en cada lado —una comparaba contra
 * las raíces, la otra leía la galleta del portal—, que es la forma en que dos
 * respuestas a la misma pregunta se separan con el tiempo.
 */
export async function quienPideDe(
  clienteId: string,
  galletas: Galletas,
  puerta: Puerta
): Promise<QuienPide | null> {
  const quien = await quienPideEn(galletas, puerta);
  if (!quien) return null;

  if (quien.tipo === "agencia") {
    return quien.raices.includes(clienteId) ? quien : null;
  }
  return (await entroAlCliente(clienteId, galletas)) ? quien : null;
}

/**
 * Si el camino hasta esto pasa por «Facturas».
 *
 * **Lo que se cobra es una sección aparte, y eso tiene que valer también para
 * los bytes.** Sin esto, la ruta del archivo dejaba que alguien de Facturación
 * se bajara un boceto, y que alguien de Diseño se bajara una factura: los dos
 * tenían «alguna» sección de las que abren archivos, y el archivo no decía de
 * cuál era.
 *
 * Sube por las mismas carpetas que ya recorrió la autorización, y esas
 * respuestas están recordadas, así que no cuesta un viaje nuevo a Google.
 */
export async function pasaPorFacturas(fileId: string): Promise<boolean> {
  try {
    const { parents } = await metadatosArchivo(fileId);
    let frontera = parents ?? [];
    const vistas = new Set<string>();

    for (let nivel = 0; nivel < NIVELES && frontera.length > 0; nivel++) {
      const siguiente: string[] = [];
      for (const id of frontera) {
        if (vistas.has(id)) continue;
        vistas.add(id);

        const { padres, nombre } = await nodo(id);
        if (esCarpetaDeFacturas(nombre)) return true;
        siguiente.push(...padres);
      }
      frontera = siguiente;
    }
    return false;
  } catch {
    // Sin poder saberlo, se trata como factura: es la respuesta que cierra en
    // vez de abrir.
    return true;
  }
}

/**
 * Si esto cuelga del árbol de algún cliente, mire quien mire.
 *
 * Es para gestión, y por eso **no** respeta lo escondido: la agencia tiene que
 * poder volver a prender lo que apagó. Sirve para no dejar que una pantalla de
 * gestión toque un identificador suelto de Drive que no sea de ningún cliente.
 */
export async function esDeAlgunCliente(id: string): Promise<boolean> {
  return cuelgaDeAlguna(id, await carpetasAdministradas());
}

/**
 * Si algo —carpeta o archivo— es una de estas raíces o cuelga de alguna.
 *
 * Es `esDeAlgunCliente` con las raíces elegidas por quien pregunta: la
 * gestión pasa **sus** clientes, no todos, para que alguien acotado a dos
 * clientes no pueda esconder o mostrar cosas de un tercero sabiendo el
 * identificador.
 */
export async function cuelgaDeAlguna(id: string, raices: string[]): Promise<boolean> {
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
