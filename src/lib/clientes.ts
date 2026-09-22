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
  /**
   * Si a este cliente se le muestran los links a Drive.
   *
   * **Apagado por omisión, y con razón.** El portal existe para que el cliente
   * no necesite Drive: los archivos se ven y se bajan por nuestro servidor,
   * con nuestro permiso. Un link a Drive solo funciona si la agencia además le
   * compartió la carpeta desde Google, y si no lo hizo, el cliente toca el
   * botón y aterriza en una pantalla de Google pidiéndole permiso que no tiene
   * —que es peor que no tener el botón—.
   *
   * Se prende cuando la agencia sí le compartió la carpeta. Como eso pasa
   * afuera de la aplicación, no hay forma de saberlo solo: hay que decirlo.
   */
  verEnDrive: boolean;
  /**
   * El teléfono por donde se le escribe, para el aviso de entrega.
   *
   * **No es para que la aplicación le escriba.** Eso no pasa acá y no va a
   * pasar: con esto se arma un link de WhatsApp con el mensaje escrito, y
   * quien entrega decide si lo manda, qué dice y cuándo. Vacío significa que
   * nadie lo cargó todavía; entonces queda el botón de copiar y nada más.
   *
   * Se guarda tal como lo escriben. Los signos y espacios se sacan al armar
   * el link, no al guardarlo: corregirle el teléfono a alguien mientras lo
   * escribe es la clase de ayuda que termina borrando un número bueno.
   */
  telefono: string;
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

/**
 * Un cliente recién descubierto.
 *
 * Está escrito una sola vez porque la lista de campos crece —primero fue el
 * link, después el tag, después los links a Drive, ahora el teléfono— y
 * escrita dos veces, la segunda se olvida. Sin tag, el portal no deja entrar:
 * es lo que hay que completar.
 */
function clienteNuevo(): AjustesDeCliente {
  return {
    habilitado: true,
    token: nuevoToken(),
    tag: "",
    verEnDrive: false,
    telefono: "",
  };
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
      verEnDrive: v.verEnDrive === true,
      telefono: typeof v.telefono === "string" ? v.telefono : "",
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

  // Los clientes recién descubiertos: los que Drive comparte y todavía no
  // tienen ficha guardada. Se les genera el link una sola vez.
  const nuevas = carpetas.filter((c) => !guardado[c.id]);

  // **Cada uno se guarda con `cambiar`, no con un escritura ciega.** El link se
  // genera la primera vez que se ve el cliente, y si dos pedidos lo descubren a
  // la vez —abrir la app en dos pestañas al compartir la carpeta— cada uno
  // fabricaba un token distinto y el segundo pisaba al primero. `cambiar` con
  // `?? clienteNuevo()` crea solo si no había, así que el token que gana es uno
  // y ese es el que se devuelve: se lee el que quedó de verdad en la base, no
  // el que este pedido acababa de inventar.
  await Promise.all(
    nuevas.map(async (carpeta) => {
      const quedo = await almacen.cambiar(carpeta.id, (habia) => habia ?? clienteNuevo());
      if (quedo) guardado[carpeta.id] = quedo;
    })
  );

  const clientes: Cliente[] = carpetas.map((carpeta: CarpetaDrive) => ({
    id: carpeta.id,
    nombre: carpeta.name,
    enlaceDrive: carpeta.webViewLink,
    ...(guardado[carpeta.id] ?? clienteNuevo()),
  }));

  return clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function clientesHabilitados(): Promise<Cliente[]> {
  return (await todosLosClientes()).filter((c) => c.habilitado);
}

export async function clientePorId(id: string): Promise<Cliente | null> {
  return (await todosLosClientes()).find((c) => c.id === id) ?? null;
}

/**
 * Cambia una cosa de un cliente y deja el resto como estaba.
 *
 * Antes cada función escribía el objeto entero, enumerando todos los campos.
 * Eso significa que agregar un campo nuevo los rompe a todos a la vez, y de la
 * peor manera: compilan, corren, y borran en silencio lo que no nombraron.
 * Acá se lee lo que hay y se le pega el cambio encima.
 */
async function cambiar(id: string, parche: Partial<AjustesDeCliente>): Promise<void> {
  // Se parte de lo que hay, entero, y se le pega el cambio encima. Enumerar
  // los campos acá era exactamente lo que este comentario decía que no había
  // que hacer: al agregar el teléfono, esta función compiló, corrió, y habría
  // borrado el teléfono de todos en la primera vez que alguien tocara otra
  // cosa. Un campo nuevo ya no obliga a tocar nada de acá.
  // **En un solo paso, con `cambiar`.** Leer y después guardar son dos, y en
  // el medio entra cualquier otra escritura: poner el tag mientras otra
  // persona apaga el cliente hacía que uno de los dos cambios desapareciera
  // sin error y sin rastro.
  await almacen.cambiar(id, (habia) => ({ ...(habia ?? clienteNuevo()), ...parche }));
}

/**
 * Le anota el teléfono por donde se le escribe.
 *
 * Se guarda como lo escribieron: los signos y los espacios se sacan al armar
 * el link de WhatsApp, no al guardarlo.
 */
export async function ponerTelefono(id: string, telefono: string): Promise<void> {
  await cambiar(id, { telefono: telefono.trim().slice(0, 40) });
}

export async function habilitarCliente(id: string, habilitado: boolean): Promise<void> {
  await cambiar(id, { habilitado });
}

/** Le pone o le cambia el tag a un cliente. */
export async function ponerTag(id: string, tag: string): Promise<void> {
  await cambiar(id, { tag: tag.trim().slice(0, 60) });
}

/**
 * Si a este cliente se le muestran los links a Drive.
 *
 * Lo decide la agencia porque es la única que lo sabe: compartir la carpeta
 * pasa en Drive, afuera de la aplicación.
 */
export async function mostrarDriveA(id: string, verEnDrive: boolean): Promise<void> {
  await cambiar(id, { verEnDrive });
}

/**
 * Le da un link nuevo a un cliente.
 *
 * Es la forma de cortar el acceso a quien tenga el viejo —alguien que se fue
 * de la empresa del cliente, un link reenviado a quien no correspondía—.
 */
export async function renovarLink(id: string): Promise<string> {
  const token = nuevoToken();
  await cambiar(id, { token });
  return token;
}
