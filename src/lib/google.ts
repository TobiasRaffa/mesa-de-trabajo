// Acceso a Google Drive con la cuenta de servicio.
// Todo esto corre SOLO en el servidor: la llave nunca llega al navegador.

import crypto from "node:crypto";
import { credencialesDeGoogle } from "@/lib/entorno";
import { urlConTamano } from "@/lib/miniaturas";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE = "https://www.googleapis.com/drive/v3";

const b64url = (b: crypto.BinaryLike) =>
  Buffer.from(b as never)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// El token dura una hora; lo guardamos en memoria para no pedirlo en cada pantalla.
let cache: { token: string; vence: number } | null = null;

async function tokenDeGoogle(): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  if (cache && cache.vence > ahora + 60) return cache.token;

  const { email, llave } = credencialesDeGoogle();

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: TOKEN_URL,
      iat: ahora,
      exp: ahora + 3600,
    })
  );
  const firma = b64url(
    crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(llave)
  );

  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${firma}`,
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error("Google rechazó la autenticación: " + JSON.stringify(data));

  cache = { token: data.access_token, vence: ahora + 3500 };
  return data.access_token;
}

/**
 * Memoria corta de lo que Drive contestó.
 *
 * **Es lo que hace que la aplicación no se sienta lenta.** Cada listado es un
 * viaje a Google de dos o tres décimas, y las pantallas repiten las mismas
 * preguntas todo el tiempo: pasar de Clientes al Tablero y volver le
 * preguntaba a Google exactamente lo mismo tres veces. Con esto, la segunda
 * vez es instantánea.
 *
 * **Medio minuto, y por qué ese número.** Es el equilibrio entre dos cosas que
 * se contradicen: que moverse por la aplicación sea inmediato, y que un
 * archivo recién subido a Drive aparezca sin tener que esperar. Medio minuto
 * cubre el ir y venir entre pantallas —que es lo que pasa todo el tiempo— y no
 * llega a ser una espera cuando alguien sube algo y va a buscarlo.
 *
 * Lo que la aplicación misma cambia en Drive no espera: `moverArchivo` borra
 * esta memoria. Lo único que puede tardar hasta medio minuto es lo que se hizo
 * **afuera**, en Drive, que es donde no podemos enterarnos.
 */
const RECUERDO_MS = 30 * 1000;

const recordado = new Map<string, { valor: unknown; vence: number }>();

async function conMemoria<T>(clave: string, traer: () => Promise<T>): Promise<T> {
  const ahora = Date.now();
  const guardado = recordado.get(clave);
  if (guardado && guardado.vence > ahora) return guardado.valor as T;

  const valor = await traer();
  recordado.set(clave, { valor, vence: ahora + RECUERDO_MS });
  return valor;
}

/**
 * Olvida lo recordado de Drive.
 *
 * Se llama cuando la aplicación misma movió algo: esperar medio minuto para
 * ver el efecto de algo que uno acaba de hacer es peor que el viaje que se
 * ahorra.
 */
export function olvidarDrive(): void {
  recordado.clear();
}

export type ArchivoDrive = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  /** Cambia cuando el archivo se modifica. Sirve para invalidar caches. */
  modifiedTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
};

// Lista los archivos de una carpeta, ordenados por nombre.
// Las miniaturas vienen con la respuesta y caducan en horas: no se guardan.
export async function listarCarpeta(folderId: string): Promise<ArchivoDrive[]> {
  return conMemoria(`listar:${folderId}`, () => pedirListado(folderId));
}

async function pedirListado(folderId: string): Promise<ArchivoDrive[]> {
  const token = await tokenDeGoogle();
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent(
    "files(id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink)"
  );
  const url = `${DRIVE}/files?q=${q}&fields=${fields}&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const data = await r.json();
  if (!r.ok) throw new Error("Drive: " + (data.error?.message ?? "error desconocido"));
  return data.files ?? [];
}

const CARPETA = "application/vnd.google-apps.folder";

export type CarpetaDrive = {
  id: string;
  name: string;
  /** Para abrirla en Drive. Solo sirve a quien ya tenga acceso desde Google. */
  webViewLink?: string;
  modifiedTime?: string;
};

/**
 * Las carpetas de trabajo que hay adentro de la del cliente.
 *
 * Es la lista que la agencia arma en Drive —«Logos», «Calendario septiembre»,
 * «Banners»— y que después elige mostrar o no. Se filtra por tipo del lado de
 * Google y no acá: traer los archivos para descartarlos sería pedir de más.
 */
export async function subcarpetasDe(folderId: string): Promise<CarpetaDrive[]> {
  return conMemoria(`sub:${folderId}`, () => pedirSubcarpetas(folderId));
}

async function pedirSubcarpetas(folderId: string): Promise<CarpetaDrive[]> {
  const token = await tokenDeGoogle();
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType = '${CARPETA}' and trashed=false`
  );
  const fields = encodeURIComponent("files(id,name,webViewLink,modifiedTime)");
  const url = `${DRIVE}/files?q=${q}&fields=${fields}&orderBy=name&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const data = await r.json();
  if (!r.ok) throw new Error("Drive: " + (data.error?.message ?? "error desconocido"));
  return data.files ?? [];
}

/**
 * Las carpetas que alguien le compartió al robot.
 *
 * Es la lista de clientes: el robot no tiene Drive propio, así que todo lo que
 * ve es algo que alguien decidió compartirle. Se piden solo carpetas —un
 * archivo suelto compartido por error no es un cliente—.
 */
export async function carpetasCompartidas(): Promise<CarpetaDrive[]> {
  return conMemoria("compartidas", pedirCompartidas);
}

async function pedirCompartidas(): Promise<CarpetaDrive[]> {
  const token = await tokenDeGoogle();
  const q = encodeURIComponent(
    `sharedWithMe and mimeType = '${CARPETA}' and trashed=false`
  );
  const fields = encodeURIComponent("files(id,name,webViewLink,modifiedTime)");
  const url = `${DRIVE}/files?q=${q}&fields=${fields}&orderBy=name&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const data = await r.json();
  if (!r.ok) throw new Error("Drive: " + (data.error?.message ?? "error desconocido"));
  return data.files ?? [];
}

/** Los archivos de una carpeta, sin las subcarpetas. */
export async function archivosDe(folderId: string): Promise<ArchivoDrive[]> {
  const todo = await listarCarpeta(folderId);
  return todo.filter((f) => f.mimeType !== CARPETA);
}

/** Nombre y link de una carpeta puntual. */
export async function datosDeCarpeta(folderId: string): Promise<CarpetaDrive> {
  return conMemoria(`carpeta:${folderId}`, () => pedirDatosDeCarpeta(folderId));
}

async function pedirDatosDeCarpeta(folderId: string): Promise<CarpetaDrive> {
  const token = await tokenDeGoogle();
  const fields = encodeURIComponent("id,name,webViewLink,modifiedTime");
  const url = `${DRIVE}/files/${encodeURIComponent(folderId)}?fields=${fields}&supportsAllDrives=true`;

  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const data = await r.json();
  if (!r.ok) throw new Error("Drive: " + (data.error?.message ?? "no encontré la carpeta"));
  return data;
}

// Mueve un archivo de una carpeta a otra. Es lo único que escribimos en Drive.
export async function moverArchivo(fileId: string, desde: string, hacia: string) {
  // Lo recordado quedó viejo en el momento en que esto cambia algo.
  olvidarDrive();
  const token = await tokenDeGoogle();
  const url = `${DRIVE}/files/${fileId}?addParents=${hacia}&removeParents=${desde}&fields=id,name,parents&supportsAllDrives=true`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + token },
  });
  const data = await r.json();
  if (!r.ok) throw new Error("Drive: " + (data.error?.message ?? "no pude mover el archivo"));
  return data;
}


export type MetadatosArchivo = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  thumbnailLink?: string;
  modifiedTime?: string;
  webViewLink?: string;
};

// Datos de un archivo puntual, incluidas las carpetas que lo contienen.
// Los `parents` son lo que permite verificar que el pedido sea legítimo.
/**
 * Le cambia el nombre a un archivo en Drive.
 *
 * **Es la única escritura de nombres que hace la aplicación**, y existe para
 * una sola cosa: volver a juntar un trabajo que un renombre partió en dos. Lo
 * pide una persona, con el botón de «unir», después de mirar los dos.
 *
 * Se escribe en el Drive del cliente, así que lo que se manda es exactamente
 * lo que se calculó: nada de armar el nombre acá adentro.
 */
export async function renombrarArchivo(fileId: string, nombre: string): Promise<void> {
  // Lo recordado quedó viejo en el momento en que esto cambia algo.
  olvidarDrive();
  const token = await tokenDeGoogle();
  const r = await fetch(
    `${DRIVE}/files/${fileId}?fields=id,name&supportsAllDrives=true`,
    {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ name: nombre }),
    }
  );
  const data = await r.json();
  if (!r.ok) {
    throw new Error("Drive: " + (data.error?.message ?? "no pude renombrar el archivo"));
  }
}

export async function metadatosArchivo(fileId: string): Promise<MetadatosArchivo> {
  return conMemoria(`archivo:${fileId}`, () => pedirMetadatos(fileId));
}

async function pedirMetadatos(fileId: string): Promise<MetadatosArchivo> {
  const token = await tokenDeGoogle();
  const fields = encodeURIComponent(
    "id,name,mimeType,parents,thumbnailLink,modifiedTime,webViewLink"
  );
  const url = `${DRIVE}/files/${encodeURIComponent(fileId)}?fields=${fields}&supportsAllDrives=true`;

  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const data = await r.json();
  if (!r.ok) throw new Error("Drive: " + (data.error?.message ?? "no encontré el archivo"));
  return data;
}

/**
 * Un comentario dejado en Drive, encima del archivo.
 *
 * Es lo que pasa de verdad: alguien abre el PDF en Drive y escribe ahí, con
 * las herramientas de Google, señalando un pedazo del diseño. Eso existía y la
 * aplicación no se enteraba, así que la mitad de las devoluciones vivía en un
 * lado y la otra mitad en el otro.
 */
export type ComentarioDeDrive = {
  id: string;
  /** Quién lo escribió, como lo muestra Google. */
  quien: string;
  /**
   * Su dirección, si Google la da.
   *
   * **Suele no darla.** Drive la omite salvo que quien pregunta ya la pueda
   * ver por otro lado, así que esto no se puede dar por hecho: lo único
   * seguro es el nombre.
   */
  correo?: string;
  texto: string;
  /** ISO. */
  cuando: string;
  /** Alguien lo marcó como resuelto en Drive. */
  resuelto: boolean;
  /** El pedazo del archivo sobre el que se escribió, si lo hay. */
  sobre?: string;
  /**
   * En qué hoja del PDF se escribió, si Drive lo dice.
   *
   * Un comentario en la hoja 7 de un PDF de veinte, sin decir la hoja, manda a
   * buscarlo a mano por todo el archivo. Es dato de Drive: lo trae en `anchor`,
   * que es una cadena opaca y puede venir vacía o con otra forma.
   */
  hoja?: number;
  /** Lo que vino en `anchor`, tal cual. Para el diagnóstico. */
  ancla?: string;
  /** Las respuestas, en orden. */
  respuestas: Array<{ quien: string; texto: string; cuando: string }>;
};

/**
 * Los comentarios de un archivo de Drive.
 *
 * **Se leen, no se escriben.** La aplicación no contesta comentarios: si hay
 * que contestar, contesta una persona, en Drive o por el chat del portal.
 *
 * No se recuerdan: un comentario nuevo aparece en el momento en que alguien
 * lo escribe, y esperar medio minuto para ver lo que el cliente acaba de
 * dejar sería justo lo que esto viene a resolver.
 *
 * Nunca lanza: un archivo sin comentarios, uno que Google no deja leer, o
 * Drive caído, devuelven una lista vacía. Esto acompaña a una pantalla que
 * tiene otras cosas para mostrar.
 */
export async function comentariosDeArchivo(
  fileId: string
): Promise<ComentarioDeDrive[]> {
  // **Con la misma memoria corta que los listados.** Desde que lo escrito en
  // Drive se pasa a la lista de cambios del cliente, esto se pregunta en cada
  // carga del portal y de la gestión, una vez por pieza: una carpeta de diez
  // piezas eran diez viajes a Google por pantalla. Medio minuto es lo mismo
  // que tarda en aparecer un archivo recién subido, así que un comentario
  // recién escrito no tarda más que eso.
  return conMemoria(`comentarios:${fileId}`, async () => {
    const r = await leerComentarios(fileId);
    return r.ok ? r.comentarios : [];
  });
}

/**
 * Lo mismo, pero diciendo por qué falló.
 *
 * **«Ninguno» y «no me dejaron leer» se ven igual** desde afuera, y esa es la
 * peor clase de silencio: la pantalla queda idéntica y nadie se entera de que
 * el permiso está mal. Esta versión existe para el diagnóstico, que es el
 * lugar donde esa diferencia se tiene que poder ver.
 */
export async function leerComentarios(
  fileId: string
): Promise<
  { ok: true; comentarios: ComentarioDeDrive[] } | { ok: false; motivo: string }
> {
  try {
    const token = await tokenDeGoogle();
    // Drive v3 obliga a pedir los campos: sin esto contesta comentarios vacíos.
    const fields = encodeURIComponent(
      "comments(id,content,createdTime,resolved,anchor," +
        "author(displayName,emailAddress)," +
        "quotedFileContent/value,replies(content,createdTime,author/displayName))"
    );
    const url =
      `${DRIVE}/files/${encodeURIComponent(fileId)}/comments` +
      `?fields=${fields}&pageSize=100&includeDeleted=false`;

    const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return {
        ok: false,
        motivo: String(data?.error?.message ?? `Google contestó ${r.status}`),
      };
    }

    // Lo que contesta Google es tan poco confiable como cualquier cosa que
    // llegue por la red: se lee campo por campo y lo que no esté se completa.
    type Autor = { displayName?: unknown; emailAddress?: unknown };
    type Crudo = {
      id?: unknown;
      content?: unknown;
      createdTime?: unknown;
      resolved?: unknown;
      anchor?: unknown;
      author?: Autor;
      quotedFileContent?: { value?: unknown };
      replies?: unknown;
    };

    const quienEs = (a?: Autor) =>
      typeof a?.displayName === "string" && a.displayName ? a.displayName : "Alguien";

    const crudos: Crudo[] = Array.isArray(data?.comments) ? data.comments : [];
    const comentarios = crudos.map((x) => ({
      id: String(x.id ?? ""),
      quien: quienEs(x.author),
      correo:
        typeof x.author?.emailAddress === "string" && x.author.emailAddress
          ? x.author.emailAddress
          : undefined,
      texto: String(x.content ?? ""),
      cuando: String(x.createdTime ?? ""),
      resuelto: x.resolved === true,
      hoja: typeof x.anchor === "string" ? hojaDelAncla(x.anchor) : undefined,
      ancla: typeof x.anchor === "string" && x.anchor ? x.anchor : undefined,
      sobre:
        typeof x.quotedFileContent?.value === "string" && x.quotedFileContent.value
          ? x.quotedFileContent.value
          : undefined,
      respuestas: (Array.isArray(x.replies) ? (x.replies as Crudo[]) : []).map((r2) => ({
        quien: quienEs(r2.author),
        texto: String(r2.content ?? ""),
        cuando: String(r2.createdTime ?? ""),
      })),
    }));

    return { ok: true, comentarios };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : "Drive no contestó." };
  }
}

/**
 * En qué hoja del PDF está anclado un comentario.
 *
 * **`anchor` es, por contrato, una cadena opaca**: Google dice que representa
 * una región del archivo y no promete ninguna forma. Hoy viene un JSON con la
 * hoja adentro; mañana puede venir otra cosa, y eso no puede romper la lectura
 * de comentarios entera.
 *
 * Por eso esto no interpreta la estructura: busca un número de hoja donde
 * suele estar y, si no lo encuentra, **no contesta nada**. Inventar una hoja
 * es peor que no decirla: manda a mirar la página equivocada con la misma
 * seguridad que si estuviera bien.
 */
export function hojaDelAncla(ancla: string): number | undefined {
  if (!ancla) return undefined;

  let dato: unknown;
  try {
    dato = JSON.parse(ancla);
  } catch {
    return undefined;
  }

  // Cualquier `{ page: 3 }` o `{ page: { n: 3 } }` que haya adentro, a
  // cualquier profundidad: lo que importa es el número, no dónde vive.
  let encontrada: number | undefined;

  const mirar = (v: unknown): void => {
    if (encontrada !== undefined || !v || typeof v !== "object") return;

    if (Array.isArray(v)) {
      for (const x of v) mirar(x);
      return;
    }

    for (const [clave, valor] of Object.entries(v as Record<string, unknown>)) {
      if (clave === "page" || clave === "pageNumber") {
        const n =
          typeof valor === "number"
            ? valor
            : valor && typeof valor === "object"
              ? (valor as Record<string, unknown>).n
              : undefined;
        // Las hojas se cuentan desde 1. Un cero es que se leyó otra cosa.
        if (typeof n === "number" && Number.isInteger(n) && n >= 1) {
          encontrada = n;
          return;
        }
      }
      mirar(valor);
    }
  };

  mirar(dato);
  return encontrada;
}

// Trae los bytes de una miniatura.
//
// Tiene que pasar por acá y no ir directo al navegador: Google devuelve 429
// cuando el pedido llega con cabecera `Referer`, o sea desde una página web.
// Pedida desde el servidor, sin `Referer`, responde siempre.
export async function bytesDeMiniatura(
  link: string,
  px: number
): Promise<{ bytes: ArrayBuffer; tipo: string }> {
  const token = await tokenDeGoogle();
  const url = urlConTamano(link, px);

  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) throw new Error(`Google devolvió ${r.status} al pedir la miniatura.`);

  return {
    bytes: await r.arrayBuffer(),
    tipo: r.headers.get("content-type") ?? "image/jpeg",
  };
}

/**
 * Abre el archivo original de Drive para pasárselo al navegador.
 *
 * Devuelve la respuesta cruda y no los bytes a propósito: un archivo de diseño
 * puede pesar cientos de megas, y cargarlo entero en memoria para después
 * reenviarlo es la forma más rápida de tumbar el servidor. Quien llame se
 * queda con `.body`, que es un caño, y lo conecta con la respuesta al cliente
 * sin que nada se junte en el medio.
 */
export async function abrirArchivo(fileId: string): Promise<Response> {
  const token = await tokenDeGoogle();
  const url = `${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;

  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) throw new Error(`Google devolvió ${r.status} al pedir el archivo.`);
  return r;
}
