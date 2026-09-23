// Los avisos que dispara el calendario y no una persona.
//
// Una pieza entregada tiene un plazo. A mitad del plazo, si el cliente todavía
// no decidió, conviene que el equipo lo sepa —es cuando escribirle sirve—; y
// cuando se cumple, también. Nadie aprieta un botón para eso: lo que hay es
// una fecha que pasó.
//
// **No hay un reloj corriendo.** En internet la aplicación no tiene un proceso
// vivo que mire la hora: cada pedido arranca y termina. Así que se revisa
// cuando alguien abre el tablero, que es la pantalla del día y se abre todos
// los días. Un aviso puede llegar horas tarde; nunca dos veces.
//
// **Nunca dos veces** es lo que guarda este archivo: cada aviso queda anotado
// con la pieza, la entrega y de qué clase fue, y con eso anotado no vuelve a
// salir. Una entrega nueva de la misma pieza es otra entrega, y avisa de nuevo.

import { coleccion } from "@/lib/almacen";
import { avisar } from "@/lib/avisar";
import type { ClaseDeAviso } from "@/lib/avisos";
import { calcularAviso, medianocheDeHoy } from "@/lib/fechas";

type Recordatorio = { cuando: string };

const esRecordatorio = (v: unknown): v is Recordatorio =>
  Boolean(v) && typeof v === "object" && typeof (v as Recordatorio).cuando === "string";

const almacen = coleccion<Recordatorio>("recordatorios", esRecordatorio);

/** Las dos clases que salen de acá, y de ningún otro lado. */
export type ClaseDeRecordatorio = Extract<ClaseDeAviso, "por_vencer" | "vencio">;

export type PiezaConPlazo = {
  piezaId: string;
  /** El nombre para el aviso: «la v2 de stickers». */
  detalle: string;
  /** Cuándo se entregó, ISO. Sin esto no corre ningún plazo. */
  entregadaEl?: string;
  /** Los días de revisión que corren para esta pieza. */
  dias: number;
  /** Cuándo vence, ya calculado. */
  vence: Date | null;
  /** El cliente todavía no decidió: entregada o en revisión, sin enviar. */
  esperandoAlCliente: boolean;
};

export type DondeEsta = {
  clienteId: string;
  cliente: string;
  carpetaId: string;
  carpeta: string;
};

/**
 * Qué recordatorio le toca a una pieza en este momento, si alguno.
 *
 * Puro, para poder probarlo: `vencio` si el plazo pasó; `por_vencer` si pasó
 * la mitad; nada si no se entregó, si el cliente ya decidió, o si todavía es
 * temprano.
 */
export function recordatorioQueToca(
  pieza: PiezaConPlazo,
  ahora = new Date()
): ClaseDeRecordatorio | null {
  if (!pieza.esperandoAlCliente || !pieza.entregadaEl || !pieza.vence) return null;

  const entregada = new Date(pieza.entregadaEl);
  if (Number.isNaN(entregada.getTime())) return null;

  // **Vencido es desde el día siguiente, contado en Buenos Aires.** Comparaba
  // instantes: el aviso de que se cumplió el plazo salía a la hora exacta de
  // la entrega, mientras el tablero y el portal todavía decían «vence hoy», y
  // la agencia salía a apurar a un cliente al que le quedaba el resto del día.
  if (pieza.vence.getTime() < medianocheDeHoy(ahora).getTime()) return "vencio";
  if (calcularAviso(entregada, pieza.dias).getTime() <= ahora.getTime()) return "por_vencer";
  return null;
}

const clave = (pieza: PiezaConPlazo, clase: ClaseDeRecordatorio) =>
  `${pieza.piezaId}::${pieza.entregadaEl}::${clase}`;

/**
 * Manda el recordatorio que le toque a la pieza, si no salió ya.
 *
 * Devuelve qué mandó, o `null` si no había nada que mandar. Cualquier error
 * se traga: un recordatorio que no sale no puede tirar abajo el tablero.
 */
export async function recordarSiHaceFalta(
  pieza: PiezaConPlazo,
  donde: DondeEsta,
  ahora = new Date()
): Promise<ClaseDeRecordatorio | null> {
  const clase = recordatorioQueToca(pieza, ahora);
  if (!clase) return null;

  try {
    const id = clave(pieza, clase);

    // **El lugar se pide con `cambiar`, que es la única primitiva atómica.**
    // Era `uno()` y después `guardar()`: dos personas abriendo el tablero a la
    // misma hora leían las dos «no está», escribían las dos, y al cliente le
    // llegaban dos correos iguales. Con `cambiar` gana uno solo, y se reconoce
    // porque le devuelven la marca que escribió él.
    // El que gana es el que encontró el lugar vacío. La marca se mira adentro
    // del `cambiar` y no comparando lo que quedó: dos pedidos del mismo
    // instante escriben la misma fecha, y entonces los dos creerían haber
    // ganado. `como` puede correr más de una vez, y la última es la que queda,
    // así que esta bandera vale por el intento que ganó.
    let loPuseYo = false;
    await almacen.cambiar(id, (habia) => {
      loPuseYo = habia === undefined;
      return habia ?? { cuando: ahora.toISOString() };
    });
    if (!loPuseYo) return null;

    // **Si no quedó anotado, la marca se borra.** Anotarlo antes de mandarlo
    // lo dejaba dado por enviado para siempre —la clave ya estaba tomada— y el
    // aviso de que algo venció no se volvía a intentar nunca. Se mira lo que
    // contesta `avisar` y no si lanzó: `avisar` nunca lanza, así que un
    // `catch` acá no corría jamás.
    if (!(await avisar({ clase, ...donde, detalle: pieza.detalle }))) {
      await almacen.borrar(id).catch(() => undefined);
      return null;
    }
    return clase;
  } catch {
    return null;
  }
}
