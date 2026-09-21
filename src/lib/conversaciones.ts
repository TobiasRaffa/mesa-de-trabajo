// La conversación entre el cliente y el equipo, guardada del lado del servidor.
//
// Está acá y no en el navegador porque una conversación necesita **dos lados**:
// el cliente escribe desde el portal y la agencia contesta desde la app de
// gestión. Guardado en el navegador, cada uno hablaría solo.
//
// **Es una conversación por cliente, no por carpeta.** Al principio había una
// por carpeta y en la práctica no funciona así: con el cliente se habla de
// todo en el mismo hilo, y tener que adivinar en cuál de sus cinco carpetas
// dijo algo es peor que no tenerlo separado.
//
// Hoy vive en un archivo al lado de la aplicación, igual que los ajustes. Es
// lo que corresponde mientras corre en una computadora: se abre con el Bloc de
// notas y se copia. **Cuando exista Supabase se cambia el cuerpo de estas tres
// funciones y no se toca ninguna pantalla** —por eso todo pasa por acá—.
//
// **Del otro lado siempre hay una persona.** Este módulo guarda y devuelve lo
// que alguien escribió; no genera respuestas, no sugiere, no resume. Lo único
// que escribe la aplicación son avisos de estado, con `de: "sistema"`, que la
// pantalla dibuja distinto para que nadie los confunda con alguien hablando.

import { randomUUID } from "node:crypto";
import { coleccion, documento } from "@/lib/almacen";

export type Quien = "cliente" | "agencia" | "sistema";

export type Mensaje = {
  id: string;
  de: Quien;
  /** El nombre que se muestra. Cuando haya usuarios, sale de la sesión. */
  quien: string;
  texto: string;
  /** En ISO, para que sobreviva a `JSON.stringify`. */
  cuando: string;
};

// El tope vive en el dominio porque además lo necesita el campo donde se
// escribe, que corre en el navegador. Se reexporta para no obligar a nadie a
// cambiar de puerta.
export { LARGO_MAXIMO } from "@/dominio/texto";
import { LARGO_MAXIMO } from "@/dominio/texto";

function esMensaje(m: unknown): m is Mensaje {
  if (!m || typeof m !== "object") return false;
  const x = m as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    typeof x.quien === "string" &&
    typeof x.texto === "string" &&
    typeof x.cuando === "string" &&
    (x.de === "cliente" || x.de === "agencia" || x.de === "sistema")
  );
}

/** Una conversación es un documento: el hilo vivo de un cliente. */
type Hilo = {
  mensajes: Mensaje[];
  /**
   * Si este cliente tiene tramos viejos guardados aparte.
   *
   * **Vive en el hilo vivo para no tener que buscarlo.** La pregunta «¿hay algo
   * anterior?» se hace en **cada** vuelta del sondeo —cada seis segundos, por
   * cada chat abierto, de los dos lados— y se contestaba recorriendo la
   * colección entera de tramos: en Supabase eso es bajarse las conversaciones
   * viejas de **todos** los clientes para saber algo de uno. Justo el costo que
   * el techo del hilo vino a evitar.
   *
   * Sin definir en los hilos guardados antes de que esto existiera: la primera
   * pregunta lo averigua a la manera vieja y lo anota, y no vuelve a pasar.
   */
  tieneAnteriores?: boolean;
};

const esHilo = (v: unknown): v is Hilo =>
  Boolean(v) && typeof v === "object" && Array.isArray((v as Hilo).mensajes);

const almacen = coleccion<Hilo>("conversaciones", esHilo);

// ---------------------------------------------------------------------------
// El techo
//
// **Una conversación no puede crecer para siempre.** Cada mensaje reescribe el
// hilo entero, así que un hilo de tres años hace lento cada guardado —y lo hace
// de a poco, sin que nadie pueda señalar el día en que empezó—.
//
// **Nada se borra.** Lo viejo se muda a un tramo aparte y se sigue pudiendo
// leer: el hilo vivo queda corto, y quien quiere ver lo de antes lo pide. Es la
// misma regla de siempre: lo que se saca de la vista se marca, no se elimina.
//
// El tramo se escribe **antes** de sacar los mensajes del hilo vivo. Al revés
// —sacar y después escribir—, un corte en el medio se lleva puestos doscientos
// mensajes de alguien. Así, lo peor que puede pasar es que queden en los dos
// lados un rato, y eso se arregla solo porque al leer se descartan los
// repetidos.

/** Cuántos mensajes quedan a mano. */
const TOPE_VIVO = 300;

/**
 * Cuánto se deja crecer por encima del tope antes de mudar.
 *
 * Sin este margen se mudaría un mensaje en cada mensaje a partir del 301: dos
 * escrituras por cada cosa que alguien dice, para siempre. Con él se muda una
 * vez cada cien.
 */
const MARGEN = 100;

const tramos = coleccion<Hilo>("conversaciones-antes", esHilo);

/**
 * Cómo se llama un tramo.
 *
 * Por el primer mensaje que lleva adentro, y no por un número que se va
 * contando: un contador guardado aparte se puede leer dos veces igual y dejar
 * dos tramos con el mismo nombre, que es un tramo pisando al otro. El
 * identificador de un mensaje ya es único y no hace falta coordinarlo.
 */
const nombreDeTramo = (clienteId: string, primero: Mensaje) =>
  `${clienteId}::${primero.id}`;

/** El comienzo de la clave de todos los tramos de un cliente. */
const prefijoDe = (clienteId: string) => `${clienteId}::`;

/** Lo que sale del almacén se valida y se ordena por cuándo se dijo. */
const enOrden = (mensajes: Mensaje[]) =>
  mensajes.filter(esMensaje).sort((a, b) => a.cuando.localeCompare(b.cuando));

export async function leerConversacion(clienteId: string): Promise<Mensaje[]> {
  const hilo = await almacen.uno(clienteId);
  // Lo que sale del almacén se valida igual que lo que llega por la red: un
  // mensaje con la forma rota reventaría la pantalla en vez de no aparecer.
  return (hilo?.mensajes ?? []).filter(esMensaje);
}

/** Si este cliente tiene mensajes guardados de antes del hilo vivo. */
export async function hayAnteriores(clienteId: string): Promise<boolean> {
  const hilo = await almacen.uno(clienteId);
  if (typeof hilo?.tieneAnteriores === "boolean") return hilo.tieneAnteriores;

  // Todavía no está anotado: se averigua una vez —solo los tramos de este
  // cliente, no los de todos— y se deja escrito para que la próxima sea una
  // sola lectura.
  const hay = Object.keys(await tramos.losQueEmpiezanCon(prefijoDe(clienteId))).length > 0;

  // **También cuando todavía no hay hilo.** Se anotaba solo `if (hilo)`, o sea
  // que un cliente sin conversación empezada repetía el escaneo entero en cada
  // vuelta del reloj, para siempre, para contestar que no hay nada.
  await almacen
    .cambiar(clienteId, (actual) => ({ ...(actual ?? { mensajes: [] }), tieneAnteriores: hay }))
    .catch(() => undefined);

  return hay;
}

/**
 * La conversación entera, incluidos los tramos viejos.
 *
 * Se pide a mano desde la pantalla —«ver lo anterior»— y no se trae siempre: el
 * sentido del techo es justamente no cargar tres años de charla para escribir
 * una línea.
 */
export async function leerConversacionEntera(clienteId: string): Promise<Mensaje[]> {
  // **Solo los tramos de este cliente.** Se traían los de todos y se filtraba
  // acá: con el chat abierto en «ver lo anterior», el sondeo de cada seis
  // segundos bajaba años de conversación de la agencia entera para dibujar la
  // de uno.
  const [viejos, vivos] = await Promise.all([
    tramos.losQueEmpiezanCon(prefijoDe(clienteId)),
    leerConversacion(clienteId),
  ]);

  const todos = Object.values(viejos)
    .flatMap((hilo) => hilo.mensajes)
    .concat(vivos);

  // Sin repetidos: si se cortó la luz entre escribir el tramo y sacarlos del
  // hilo vivo, los mismos mensajes están en los dos lados.
  const porId = new Map(todos.filter(esMensaje).map((m) => [m.id, m]));
  return enOrden([...porId.values()]);
}

/**
 * Anota en la conversación algo que hizo la aplicación.
 *
 * **La promesa estaba escrita en cuatro lugares y no la cumplía nadie.** El
 * tipo `Quien` tiene `"sistema"`, la pantalla lo dibuja distinto —centrado, en
 * gris, sin burbuja— y `DECISIONES` lo explica, pero no había una sola llamada
 * que escribiera uno: la rama existía para un caso que no ocurría nunca.
 *
 * Se anotan los **hitos de a tanda**: la entrega y el envío de una revisión.
 * Uno por pieza aprobada convertiría la conversación en un registro, que es lo
 * contrario de lo que es: un lugar donde dos personas hablan, con las marcas
 * justas para saber de qué.
 *
 * No devuelve nada y no falla hacia afuera: que no se pueda anotar una marca
 * no puede tumbar la entrega que acaba de pasar.
 */
export async function anotarHito(clienteId: string, texto: string): Promise<void> {
  try {
    await agregarMensaje(clienteId, "sistema", "Mesa de trabajo", texto);
  } catch {
    // Queda sin la marca. Lo que importaba ya se guardó.
  }
}

/**
 * Agrega un mensaje y devuelve la conversación entera.
 *
 * Devuelve todo y no solo el mensaje nuevo para que quien escribió vea al
 * instante lo que el otro lado dijo mientras tanto.
 *
 * **Se escribe en un solo paso.** Antes era leer, sumar y guardar: el cliente
 * y la agencia escribiendo en la misma fracción de segundo leían lo mismo, y
 * el segundo en guardar se llevaba puesto el mensaje del primero —que no
 * llegaba nunca, sin error y sin aviso—.
 */
export async function agregarMensaje(
  clienteId: string,
  de: Quien,
  quien: string,
  texto: string
): Promise<Mensaje[]> {
  const limpio = texto.trim().slice(0, LARGO_MAXIMO);
  if (!limpio) return leerConversacion(clienteId);

  const nuevo: Mensaje = {
    id: randomUUID(),
    de,
    quien,
    texto: limpio,
    cuando: new Date().toISOString(),
  };

  // **Se conserva lo que ya tenía.** Devolvía un objeto nuevo con solo los
  // mensajes, así que cada mensaje enviado borraba `tieneAnteriores`: la marca
  // que existe para no volver a escanear los tramos se perdía en cuanto
  // alguien escribía, y el escaneo caro volvía a correr.
  const hilo = await almacen.cambiar(clienteId, (actual) => ({
    ...actual,
    mensajes: [...(actual?.mensajes ?? []).filter(esMensaje), nuevo],
  }));

  const mensajes = hilo?.mensajes ?? [nuevo];
  if (mensajes.length <= TOPE_VIVO + MARGEN) return mensajes;

  return mudarLoViejo(clienteId, mensajes);
}

/**
 * Manda los más viejos a un tramo aparte y devuelve el hilo vivo que quedó.
 *
 * Si algo falla, **no se pierde nada y no se avisa**: la conversación ya quedó
 * guardada, el mensaje llegó, y hacer fallar el envío por no haber podido
 * ordenar sería romper lo que sí funcionó. Se vuelve a intentar con el mensaje
 * siguiente.
 */
async function mudarLoViejo(clienteId: string, mensajes: Mensaje[]): Promise<Mensaje[]> {
  const viejos = mensajes.slice(0, mensajes.length - TOPE_VIVO);
  if (viejos.length === 0) return mensajes;

  try {
    await tramos.guardar(nombreDeTramo(clienteId, viejos[0]), { mensajes: viejos });

    const mudados = new Set(viejos.map((m) => m.id));
    const quedo = await almacen.cambiar(clienteId, (actual) => ({
      // Por identificador y no por posición: entre el tramo y esto pudo entrar
      // otro mensaje, y cortar por número se lo llevaría puesto.
      mensajes: (actual?.mensajes ?? []).filter((m) => !mudados.has(m.id)),
      // Se anota acá mismo, que es el único momento en que pasa a ser cierto.
      tieneAnteriores: true,
    }));
    return quedo?.mensajes ?? mensajes;
  } catch {
    return mensajes;
  }
}

// ---------------------------------------------------------------------------
// Lo que falta leer
//
// El número que se muestra al lado de «Conversación» es **lo que no leíste**,
// no cuántos mensajes hay. Un contador que dice «14» para siempre no dice
// nada: el que importa es el que baja a cero cuando mirás.
//
// Se guarda hasta qué momento leyó cada lado. Un mensaje cuenta como sin leer
// si es del otro y es posterior a esa marca. Los avisos de la aplicación no
// cuentan: no son alguien hablando.

type Lado = "agencia" | "cliente";
type Marcas = Record<Lado, Record<string, string>>;

const VACIAS: Marcas = { agencia: {}, cliente: {} };

const esMarcas = (v: unknown): v is Marcas =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const marcas = documento<Marcas>("leidos", esMarcas, VACIAS);

async function leerMarcas(): Promise<Marcas> {
  const guardadas = await marcas.leer();
  const lado = (cual: Lado): Record<string, string> => {
    const x = (guardadas as Record<string, unknown>)[cual];
    if (!x || typeof x !== "object") return {};
    return Object.fromEntries(
      Object.entries(x as Record<string, unknown>).filter(
        ([, v]) => typeof v === "string"
      ) as Array<[string, string]>
    );
  };
  return { agencia: lado("agencia"), cliente: lado("cliente") };
}

export async function marcarLeido(lado: Lado, clienteId: string): Promise<void> {
  // En un solo paso: las marcas de los dos lados viven en el mismo documento, y
  // el cliente y la agencia mirando a la vez perdían una de las dos.
  const ahora = new Date().toISOString();
  await marcas.cambiar((actual) => ({
    ...VACIAS,
    ...actual,
    [lado]: { ...(actual?.[lado] ?? {}), [clienteId]: ahora },
  }));
}

/** Cuántos mensajes del otro lado quedaron sin leer, por cliente. */
export async function sinLeerPorCliente(lado: Lado): Promise<Record<string, number>> {
  const [hilos, leidas] = await Promise.all([almacen.todo(), leerMarcas()]);
  const delOtro = lado === "agencia" ? "cliente" : "agencia";

  const salida: Record<string, number> = {};
  for (const [clienteId, hilo] of Object.entries(hilos)) {
    const desde = leidas[lado][clienteId] ?? "";
    salida[clienteId] = hilo.mensajes.filter(
      (m) => esMensaje(m) && m.de === delOtro && m.cuando > desde
    ).length;
  }
  // Los tramos viejos no se miran: lo que quedó sin leer de hace trescientos
  // mensajes ya no es una notificación, y leerlos todos para contar cero sería
  // pagar justo el precio que el techo vino a sacar.
  return salida;
}
