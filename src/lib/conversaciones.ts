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

/** Nadie escribe un mensaje más largo que esto sin querer romper algo. */
export const LARGO_MAXIMO = 4000;

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

/** Una conversación es un documento: el hilo entero de un cliente. */
type Hilo = { mensajes: Mensaje[] };

const esHilo = (v: unknown): v is Hilo =>
  Boolean(v) && typeof v === "object" && Array.isArray((v as Hilo).mensajes);

const almacen = coleccion<Hilo>("conversaciones", esHilo);

export async function leerConversacion(clienteId: string): Promise<Mensaje[]> {
  const hilo = await almacen.uno(clienteId);
  // Lo que sale del almacén se valida igual que lo que llega por la red: un
  // mensaje con la forma rota reventaría la pantalla en vez de no aparecer.
  return (hilo?.mensajes ?? []).filter(esMensaje);
}

/**
 * Agrega un mensaje y devuelve la conversación entera.
 *
 * Devuelve todo y no solo el mensaje nuevo para que quien escribió vea al
 * instante lo que el otro lado dijo mientras tanto.
 */
export async function agregarMensaje(
  clienteId: string,
  de: Quien,
  quien: string,
  texto: string
): Promise<Mensaje[]> {
  const limpio = texto.trim().slice(0, LARGO_MAXIMO);
  if (!limpio) return leerConversacion(clienteId);

  const mensajes = [
    ...(await leerConversacion(clienteId)),
    { id: randomUUID(), de, quien, texto: limpio, cuando: new Date().toISOString() },
  ];
  await almacen.guardar(clienteId, { mensajes });
  return mensajes;
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
  const actuales = await leerMarcas();
  actuales[lado][clienteId] = new Date().toISOString();
  await marcas.escribir(actuales);
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
  return salida;
}
