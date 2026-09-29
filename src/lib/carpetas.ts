// Qué carpetas de trabajo existen de verdad, en todos los clientes.
//
// Existe para validar lo que llega de afuera. Las acciones de servidor y las
// rutas son endpoints públicos: cualquiera que sepa mandar el pedido llega. El
// identificador de carpeta que viene en un formulario o en una dirección no se
// puede creer, así que se compara contra esta lista antes de leer o escribir
// nada.
//
// Vive en `lib` y no en uno de los dos mundos porque los dos lo necesitan: el
// portal para no dejar espiar conversaciones ajenas, y administración para no
// guardar ajustes de carpetas inventadas.

import { clientesHabilitados, type Cliente } from "@/lib/clientes";
import { metadatosArchivo, subcarpetasDe } from "@/lib/google";
import { esCarpetaDeFacturas, escondidosEntre } from "@/lib/ajustes";

/**
 * Cuánto se recuerda la lista antes de volver a preguntarle a Drive.
 *
 * Los mismos dos minutos que la memoria de listados de `google.ts`: es la otra
 * mitad del mapa de qué carpeta es de qué cliente, y tenerlas en desacuerdo
 * —una fresca y otra vieja— no gana nada. Una carpeta de trabajo nueva creada
 * afuera, en Drive, puede tardar hasta ese tanto en aparecer.
 */
const RECUERDO_MS = 2 * 60 * 1000;

/**
 * Hasta cuántos escalones debajo del cliente se reconoce una carpeta.
 *
 * El mismo número que el portal (`HONDURA` en `portal/datos/cliente.ts`) y el
 * permiso (`NIVELES` en `permisos.ts`): lo que se muestra y lo que se deja
 * tocar no pueden opinar distinto. Más abajo que eso el portal no dibuja nada,
 * así que no hay nada legítimo que reconocer.
 */
const HONDURA = 6;

/** Lo que Drive contesta cuando algo es una carpeta y no un archivo. */
const CARPETA_DE_DRIVE = "application/vnd.google-apps.folder";

/**
 * De qué cliente es cada carpeta de trabajo.
 *
 * **Un mapa y no una lista, y esa es la diferencia que se nota.** Antes esto
 * guardaba solo los identificadores, así que la otra pregunta —«¿de quién es
 * esta carpeta?»— recorría los clientes de a uno pidiéndole a Drive las
 * subcarpetas de cada uno, y la hacía **por cada carpeta**: validar un
 * formulario con diez clientes y sesenta carpetas eran hasta seiscientas
 * llamadas encadenadas. Las dos preguntas salen de la misma vuelta a Drive, así
 * que las dos salen de acá.
 */
let cache: {
  de: Map<string, Cliente>;
  /** Las de primer nivel que son «Facturas»: el cliente no las toca. */
  deFacturas: Set<string>;
  /** Los clientes habilitados, para reconocer su raíz y subir hasta ella. */
  clientes: Cliente[];
  vence: number;
} | null = null;

async function mapaDeCarpetas(): Promise<Map<string, Cliente>> {
  return (await primerNivel()).de;
}

async function primerNivel(): Promise<NonNullable<typeof cache>> {
  const ahora = Date.now();
  if (cache && cache.vence > ahora) return cache;

  const clientes = await clientesHabilitados();
  // En paralelo: son pocas carpetas y esperar una por una haría que cada
  // guardado tarde la suma de todas.
  //
  // **`allSettled` y no `all`, y la diferencia es quién se cae cuando Drive
  // falla para uno.** Con `all`, que la carpeta de un solo cliente no se pueda
  // leer —se dejó de compartir, Drive contesta un error puntual— rechaza la
  // promesa entera: `mapaDeCarpetas` tira, y como todos sus llamadores tratan
  // el error como «de nadie / no es mía», el portal y la gestión enteros
  // dejaban de reconocer **cualquier** carpeta de **cualquier** cliente. Un
  // problema de una cuenta apagaba el acceso de todas. Es la misma regla que
  // ya respetan `entradaDe` y `puertaDe`: un cliente cuya carpeta no se puede
  // leer no invalida a los demás; contribuye con cero carpetas y las suyas se
  // tratan como no reconocidas —cerrado, no abierto— hasta que Drive conteste.
  const porCliente = await Promise.allSettled(clientes.map((c) => subcarpetasDe(c.id)));

  const de = new Map<string, Cliente>();
  const deFacturas = new Set<string>();
  clientes.forEach((cliente, i) => {
    const suyas = porCliente[i];
    if (suyas.status !== "fulfilled") return;
    for (const carpeta of suyas.value) {
      de.set(carpeta.id, cliente);
      if (carpeta.name && esCarpetaDeFacturas(carpeta.name)) deFacturas.add(carpeta.id);
    }
  });

  cache = { de, deFacturas, clientes, vence: ahora + RECUERDO_MS };
  return cache;
}

/**
 * De qué cliente es una carpeta que no es de primer nivel, subiendo por Drive.
 *
 * **El mapa de arriba solo tiene las hijas directas de cada cliente**, y el
 * árbol de gestión y el portal muestran subcarpetas más hondas —«Calendario
 * septiembre / Semana 1»— y los archivos sueltos de la raíz. Todo eso se veía y
 * no se podía tocar: abrir, entregar, fechar o aprobar contestaban que la
 * carpeta no existía. Bajar por todo el árbol de todos los clientes para armar
 * el mapa costaría un viaje a Drive por carpeta cada minuto; subir desde la que
 * se pregunta cuesta uno por escalón, y Drive ya los recuerda.
 *
 * Solo reconoce lo que cuelga de un cliente **habilitado**, a lo sumo
 * `HONDURA` escalones más abajo. Del lado del cliente, además, el camino no
 * puede pasar por «Facturas» ni por nada escondido: es la misma regla con la
 * que el portal decide qué mostrar y el permiso qué servir. La agencia ve todo,
 * incluso lo que apagó, porque si no no habría dónde volver a prenderlo.
 */
async function clienteSubiendo(
  carpetaId: string,
  clientes: Cliente[],
  comoAgencia: boolean
): Promise<Cliente | null> {
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const atravesadas: string[] = [];
  const vistas = new Set<string>([carpetaId]);
  let actual = carpetaId;

  for (let nivel = 0; nivel < HONDURA; nivel++) {
    const datos = await metadatosArchivo(actual);
    // Un archivo no es una carpeta: el identificador que llega tiene que ser
    // de una carpeta, o no hay nada que abrir ni entregar.
    if (nivel === 0 && datos.mimeType !== CARPETA_DE_DRIVE) return null;
    if (!comoAgencia && esCarpetaDeFacturas(datos.name ?? "")) return null;
    atravesadas.push(actual);

    const padres = datos.parents ?? [];
    const raiz = padres.map((p) => porId.get(p)).find((c) => c !== undefined);
    if (raiz) {
      if (!comoAgencia && (await escondidosEntre(atravesadas)).size > 0) return null;
      return raiz;
    }

    // Se sube por un camino, como `cadenaHasta`: en Drive una carpeta puede
    // tener varias madres, pero seguirlas todas es multiplicar los viajes por
    // algo que casi no pasa. Ante la duda, no se reconoce —cerrado, no abierto—.
    const seguir = padres.find((p) => !vistas.has(p));
    if (!seguir) return null;
    vistas.add(seguir);
    actual = seguir;
  }

  return null;
}

export async function idsDeCarpetasReales(): Promise<Set<string>> {
  return new Set((await mapaDeCarpetas()).keys());
}

/**
 * Todas las carpetas de trabajo con el cliente de cada una.
 *
 * **Sin recortar por alcance**, como todo lo de este módulo: quien la use tiene
 * que recortarla, y hay un guardián que verifica que se pida desde el único
 * lugar que lo hace. Existe para contestar de una sola vez lo que antes se
 * preguntaba carpeta por carpeta.
 */
export async function carpetasConSuCliente(): Promise<Map<string, Cliente>> {
  return mapaDeCarpetas();
}

/**
 * Si ese identificador es una carpeta de trabajo de algún cliente habilitado,
 * **mirado del lado del cliente**: a cualquier hondura que muestre el portal,
 * la raíz incluida, y nunca «Facturas» ni lo que cuelga de algo escondido.
 *
 * Ante la duda —Drive no contesta, no hay clientes— devuelve `false`. Nunca al
 * revés.
 */
export async function esCarpetaDelCliente(id: string): Promise<boolean> {
  return (await clienteDeCarpeta(id)) !== null;
}

/** Olvida la lista. Se llama al crear o habilitar algo, y en las pruebas. */
export function olvidarCarpetas(): void {
  cache = null;
}

/**
 * De qué cliente es una carpeta.
 *
 * **Se busca, no se recibe.** Las acciones del portal traían el cliente como
 * parámetro y le creían: con eso, un pedido armado a mano podía aprobar la
 * pieza de un cliente diciendo ser otro, y el archivo terminaba en la carpeta
 * «Entregas finales» **del otro** —o el mensaje, en su conversación—.
 *
 * La regla general: de lo que llega de afuera se acepta la referencia mínima
 * —esta carpeta, esta pieza— y todo lo demás se deduce del servidor.
 *
 * Reconoce las de primer nivel, **la carpeta del cliente misma** —ahí puede
 * haber archivos sueltos, y el portal los muestra— y las subcarpetas más hondas
 * (ver `clienteSubiendo`). Por omisión contesta como lo vería el cliente: sin
 * «Facturas» ni lo escondido. La gestión pasa `comoAgencia`, porque la agencia
 * trabaja también sobre lo que apagó.
 */
export async function clienteDeCarpeta(
  carpetaId: string,
  { comoAgencia = false }: { comoAgencia?: boolean } = {}
): Promise<Cliente | null> {
  if (!carpetaId) return null;
  try {
    const { de, deFacturas, clientes } = await primerNivel();

    const directa = de.get(carpetaId);
    if (directa) return !comoAgencia && deFacturas.has(carpetaId) ? null : directa;

    const raiz = clientes.find((c) => c.id === carpetaId);
    if (raiz) return raiz;

    return await clienteSubiendo(carpetaId, clientes, comoAgencia);
  } catch {
    // Ante la duda, de nadie.
    return null;
  }
}
