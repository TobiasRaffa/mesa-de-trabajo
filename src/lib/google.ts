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

export async function tokenDeGoogle(): Promise<string> {
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

/** Los archivos de una carpeta, sin las subcarpetas. */
export async function archivosDe(folderId: string): Promise<ArchivoDrive[]> {
  const todo = await listarCarpeta(folderId);
  return todo.filter((f) => f.mimeType !== CARPETA);
}

/** Nombre y link de una carpeta puntual. */
export async function datosDeCarpeta(folderId: string): Promise<CarpetaDrive> {
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
};

// Datos de un archivo puntual, incluidas las carpetas que lo contienen.
// Los `parents` son lo que permite verificar que el pedido sea legítimo.
export async function metadatosArchivo(fileId: string): Promise<MetadatosArchivo> {
  const token = await tokenDeGoogle();
  const fields = encodeURIComponent("id,name,mimeType,parents,thumbnailLink");
  const url = `${DRIVE}/files/${encodeURIComponent(fileId)}?fields=${fields}&supportsAllDrives=true`;

  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const data = await r.json();
  if (!r.ok) throw new Error("Drive: " + (data.error?.message ?? "no encontré el archivo"));
  return data;
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
