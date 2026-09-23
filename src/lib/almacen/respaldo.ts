// El respaldo de todos los días.
//
// Todo lo que la agencia carga —clientes, en qué quedó cada pieza, los chats,
// el calendario— vive en una sola tabla. Un error de la aplicación, una fila
// borrada a mano en el panel de Supabase o un script corrido donde no era, y
// no hay de dónde volver a sacarlo: el plan gratis de Supabase no guarda
// copias.
//
// Así que la tarea de cada mañana deja una: la tabla entera, comprimida, en un
// depósito privado de Supabase Storage (`respaldos`), con la fecha en el
// nombre. Se guardan las últimas `CUANTOS_SE_GUARDAN`; las más viejas se
// borran solas, que un respaldo que llena el espacio disponible termina
// rompiendo lo que venía a cuidar.
//
// **Cuida de los errores, no de perder el proyecto.** Está en el mismo
// Supabase que la tabla: si se borrara el proyecto entero, se iría con él.
// Para eso está bajarse uno de vez en cuando (`supabase/restaurar-respaldo.mjs
// --bajar`), y lo explica DESPLIEGUE.md.
//
// **No es una foto instantánea.** Se lee de a mil filas; algo que se escriba
// justo mientras tanto puede quedar en el estado de antes o de después. Para
// volver atrás un error de ayer es más que suficiente.

import { gzipSync } from "node:zlib";
import { credenciales, todasLasFilas } from "@/lib/almacen/enSupabase";

/** El depósito. Privado: no tiene link público y solo lo lee la llave de servicio. */
export const DEPOSITO = "respaldos";

/** Cuántos días hacia atrás se puede volver. */
export const CUANTOS_SE_GUARDAN = 30;

export type Respaldo = { archivo: string; filas: number; borrados: number };

/** El nombre del respaldo de ese día, con la fecha de Buenos Aires. */
export function nombreDelRespaldo(ahora: Date): string {
  // `en-CA` escribe las fechas como AAAA-MM-DD, que ordenadas como texto
  // quedan en orden de fecha: es lo que permite saber cuáles son las viejas.
  const dia = ahora.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  return `respaldo-${dia}.json.gz`;
}

/** Los que sobran: los más viejos, pasados los que se guardan. */
export function losQueSobran(nombres: string[], cuantos = CUANTOS_SE_GUARDAN): string[] {
  const respaldos = nombres.filter((n) => /^respaldo-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort();
  return respaldos.slice(0, Math.max(0, respaldos.length - cuantos));
}

async function alDeposito(ruta: string, init: RequestInit): Promise<Response> {
  const cred = credenciales();
  if (!cred) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY.");
  return fetch(`${cred.url}/storage/v1/${ruta}`, {
    ...init,
    headers: { apikey: cred.llave, Authorization: `Bearer ${cred.llave}`, ...init.headers },
    cache: "no-store",
  });
}

async function fallo(r: Response, que: string): Promise<Error> {
  const detalle = await r.text().catch(() => "");
  return new Error(`${que}: Supabase Storage devolvió ${r.status}: ${detalle.slice(0, 200)}`);
}

async function subir(archivo: string, contenido: Buffer): Promise<void> {
  const mandar = () =>
    alDeposito(`object/${DEPOSITO}/${archivo}`, {
      method: "POST",
      headers: { "Content-Type": "application/gzip", "x-upsert": "true" },
      body: new Uint8Array(contenido),
    });

  let r = await mandar();
  // **La primera vez el depósito no existe**, y se crea acá en vez de pedirle
  // a nadie que lo cree a mano: es un paso menos el día del despliegue.
  if (!r.ok && (r.status === 404 || (await r.clone().text()).includes("not found"))) {
    const creado = await alDeposito("bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: DEPOSITO, name: DEPOSITO, public: false }),
    });
    if (!creado.ok && creado.status !== 409) throw await fallo(creado, "Crear el depósito");
    r = await mandar();
  }
  if (!r.ok) throw await fallo(r, "Subir el respaldo");
}

async function losQueHay(): Promise<string[]> {
  const r = await alDeposito(`object/list/${DEPOSITO}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1000, offset: 0 }),
  });
  if (!r.ok) throw await fallo(r, "Listar los respaldos");
  return ((await r.json()) as Array<{ name: string }>).map((o) => o.name);
}

async function borrar(nombres: string[]): Promise<void> {
  if (nombres.length === 0) return;
  const r = await alDeposito(`object/${DEPOSITO}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: nombres }),
  });
  if (!r.ok) throw await fallo(r, "Borrar respaldos viejos");
}

/**
 * Guarda el respaldo de hoy y borra los que sobran.
 *
 * Correrlo dos veces el mismo día reemplaza el de ese día: no se juntan
 * copias. Lanza si no pudo guardar, para que la tarea lo cuente como falla;
 * que no se puedan borrar los viejos, en cambio, no es motivo para dar por
 * perdido el de hoy, que ya quedó guardado.
 */
export async function respaldar(ahora = new Date()): Promise<Respaldo> {
  const filas = await todasLasFilas();
  const archivo = nombreDelRespaldo(ahora);
  const contenido = gzipSync(JSON.stringify({ hecho: ahora.toISOString(), filas }));
  await subir(archivo, contenido);

  let borrados = 0;
  try {
    const sobran = losQueSobran(await losQueHay());
    await borrar(sobran);
    borrados = sobran.length;
  } catch (e) {
    console.error("[respaldo] No se pudieron borrar los viejos:", e);
  }
  return { archivo, filas: filas.length, borrados };
}
