// Los clientes, que son las carpetas que alguien le compartió al robot.
//
// **La lista no se carga: se descubre.** Compartirle una carpeta al robot
// desde Drive es el único trámite; a partir de ahí el cliente aparece solo en
// la app de gestión. Es la misma idea que con las carpetas de trabajo: el
// trabajo ya está hecho cuando se comparte, y pedir que además alguien lo
// escriba en una pantalla es pedir el paso que se olvida.
//
// Lo que sí se guarda de cada cliente son dos cosas que Drive no sabe:
//
//   - **Si está habilitado.** Una carpeta compartida puede serlo por otra
//     razón, y la agencia tiene que poder decir «esta no».
//   - **Su link.** Un pedazo de texto al azar, largo, que va en la dirección
//     del portal. Es lo que el cliente recibe por WhatsApp.
//
// Hoy todo eso vive en `datos/clientes.json`, al lado de la aplicación.
// Cuando exista Supabase se cambia el cuerpo de este módulo y no se toca
// ninguna pantalla.

import { randomBytes } from "node:crypto";
import { coleccion } from "@/lib/almacen";
import { carpetasCompartidas, type CarpetaDrive } from "@/lib/google";

export type AjustesDeCliente = {
  habilitado: boolean;
  /** Lo que va en `/t/<esto>`. Se genera al descubrir el cliente. */
  token: string;
  /**
   * La palabra que el cliente escribe para entrar.
   *
   * La elige la agencia y se la pasa por otro lado —no por el mismo mensaje
   * que lleva el link, que sería como mandar la llave pegada a la puerta—.
   * Vacío significa que todavía no se le puso: el portal no deja entrar.
   */
  tag: string;
};

export type Cliente = AjustesDeCliente & {
  id: string;
  nombre: string;
  enlaceDrive?: string;
};

/**
 * 24 caracteres al azar: 96 bits.
 *
 * Adivinarlo probando no es una estrategia. El link es la mitad del acceso; la
 * otra mitad es el tag del cliente.
 */
function nuevoToken(): string {
  return randomBytes(12).toString("base64url");
}

function esAjuste(v: unknown): v is AjustesDeCliente {
  if (!v || typeof v !== "object") return false;
  const x = v as Record<string, unknown>;
  return typeof x.token === "string" && x.token.length > 0;
}

const almacen = coleccion<AjustesDeCliente>("clientes", esAjuste);

/** Lo guardado, con los huecos completados. */
async function leerGuardado(): Promise<Record<string, AjustesDeCliente>> {
  const todo = await almacen.todo();
  const salida: Record<string, AjustesDeCliente> = {};
  for (const [id, v] of Object.entries(todo)) {
    salida[id] = {
      habilitado: typeof v.habilitado === "boolean" ? v.habilitado : true,
      token: v.token,
      tag: typeof v.tag === "string" ? v.tag : "",
    };
  }
  return salida;
}

/**
 * Todos los clientes que el robot ve, con lo que la agencia decidió de cada uno.
 *
 * Un cliente nuevo —una carpeta recién compartida— llega **habilitado**, con
 * su link ya generado. Compartir es el acto deliberado; obligar a habilitarlo
 * después sería el trámite doble que este proyecto viene a sacar del medio.
 * Apagarlo es lo que hay que hacer a propósito.
 */
export async function todosLosClientes(): Promise<Cliente[]> {
  const carpetas = await carpetasCompartidas();
  const guardado = await leerGuardado();

  // Los clientes recién descubiertos se guardan juntos: es una carpeta nueva
  // compartida, o cinco de una, y de a uno serían cinco escrituras.
  const nuevos: Record<string, AjustesDeCliente> = {};
  const clientes: Cliente[] = carpetas.map((carpeta: CarpetaDrive) => {
    let ajustes = guardado[carpeta.id];
    if (!ajustes) {
      // Sin tag, el portal no deja entrar: es lo que hay que completar.
      ajustes = { habilitado: true, token: nuevoToken(), tag: "" };
      guardado[carpeta.id] = ajustes;
      nuevos[carpeta.id] = ajustes;
    }
    return {
      id: carpeta.id,
      nombre: carpeta.name,
      enlaceDrive: carpeta.webViewLink,
      ...ajustes,
    };
  });

  // El link se genera una sola vez y se recuerda: si cambiara en cada lectura,
  // el que el cliente tiene guardado dejaría de funcionar.
  if (Object.keys(nuevos).length > 0) await almacen.guardarVarios(nuevos);

  return clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function clientesHabilitados(): Promise<Cliente[]> {
  return (await todosLosClientes()).filter((c) => c.habilitado);
}

export async function clientePorId(id: string): Promise<Cliente | null> {
  return (await todosLosClientes()).find((c) => c.id === id) ?? null;
}

export async function habilitarCliente(id: string, habilitado: boolean): Promise<void> {
  const guardado = await leerGuardado();
  const actual = guardado[id];
  await almacen.guardar(id, {
    habilitado,
    token: actual?.token ?? nuevoToken(),
    tag: actual?.tag ?? "",
  });
}

/** Le pone o le cambia el tag a un cliente. */
export async function ponerTag(id: string, tag: string): Promise<void> {
  const guardado = await leerGuardado();
  const actual = guardado[id];
  await almacen.guardar(id, {
    habilitado: actual?.habilitado ?? true,
    token: actual?.token ?? nuevoToken(),
    tag: tag.trim().slice(0, 60),
  });
}

/**
 * Le da un link nuevo a un cliente.
 *
 * Es la forma de cortar el acceso a quien tenga el viejo —alguien que se fue
 * de la empresa del cliente, un link reenviado a quien no correspondía—.
 */
export async function renovarLink(id: string): Promise<string> {
  const guardado = await leerGuardado();
  const token = nuevoToken();
  await almacen.guardar(id, {
    habilitado: guardado[id]?.habilitado ?? true,
    token,
    tag: guardado[id]?.tag ?? "",
  });
  return token;
}
