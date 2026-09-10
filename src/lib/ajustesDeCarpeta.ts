// Qué se muestra de cada carpeta, y cómo.
//
// La agencia arma carpetas en Drive —«Logos», «Calendario septiembre»,
// «Banners»— y decide dos cosas sobre cada una: **si el cliente la ve** y **si
// se mira como lista o como mes**. Eso no puede vivir en Drive, porque Drive
// no tiene dónde anotarlo.
//
// Dónde se guarda no es asunto de este módulo: se lo pide al almacén, que hoy
// escribe archivos y mañana habla con Supabase. Acá vive **qué significa** un
// ajuste de carpeta y qué se asume cuando falta.
//
// La regla por omisión es «se muestra, como lista». Una carpeta nueva en Drive
// aparece sola, sin configurar nada; ocultarla es la acción deliberada. Al
// revés —tener que habilitar cada carpeta— convertiría cada trabajo nuevo en
// un trámite, que es justo lo que el portal viene a sacar del medio.

import { randomBytes } from "node:crypto";
import { coleccion } from "@/lib/almacen";

export type Vista = "lista" | "calendario";

export type AjustesDeCarpeta = {
  visible: boolean;
  vista: Vista;
  /**
   * El link propio de esta carpeta: `/t/<esto>` muestra esta sola.
   *
   * Uno por carpeta y estable. Sirve para mandarle a un cliente el link de
   * «Calendario septiembre» sin que de paso vea «Rediseño de identidad».
   * Se genera la primera vez que alguien lo pide.
   */
  token?: string;
};

const POR_OMISION: AjustesDeCarpeta = { visible: true, vista: "lista" };

/**
 * Carpetas con nombre reservado: no son trabajos y el cliente no las revisa
 * como piezas.
 *
 * `Entregas finales` es a dónde va lo aprobado. Se compara sin distinguir
 * mayúsculas ni espacios de más, porque el nombre lo escribe una persona a
 * mano en Drive, cliente por cliente.
 */
const RESERVADAS = ["entregas finales", "facturas"];

export function esCarpetaReservada(nombre: string): boolean {
  return RESERVADAS.includes(nombre.trim().toLowerCase().replace(/\s+/g, " "));
}

/**
 * Acepta solo lo que tiene la forma esperada.
 *
 * Lo que sale del almacén es tan poco confiable como lo que llega por la red:
 * lo pudo escribir una versión anterior, o alguien a mano.
 */
function esAjuste(v: unknown): v is AjustesDeCarpeta {
  return Boolean(v) && typeof v === "object";
}

const almacen = coleccion<Record<string, unknown>>("ajustes", esAjuste);

function normalizar(v: Record<string, unknown> | undefined): AjustesDeCarpeta {
  if (!v) return POR_OMISION;
  return {
    visible: typeof v.visible === "boolean" ? v.visible : POR_OMISION.visible,
    vista: v.vista === "calendario" ? "calendario" : "lista",
    token: typeof v.token === "string" && v.token ? v.token : undefined,
  };
}

export async function ajustesDe(carpetaId: string): Promise<AjustesDeCarpeta> {
  return normalizar(await almacen.uno(carpetaId));
}

export async function guardarAjustesDe(
  carpetaId: string,
  ajustes: AjustesDeCarpeta
): Promise<void> {
  await almacen.guardar(carpetaId, { ...ajustes });
}

/**
 * El link propio de una carpeta, generándolo si todavía no tiene.
 *
 * Se genera cuando alguien lo pide y no antes: una carpeta que nadie va a
 * compartir por separado no necesita link, y generarlos todos de entrada
 * llenaría el almacén de tokens que no se usan nunca.
 */
export async function linkDeCarpeta(carpetaId: string): Promise<string> {
  const ajustes = await ajustesDe(carpetaId);
  if (ajustes.token) return ajustes.token;

  const token = randomBytes(12).toString("base64url");
  await guardarAjustesDe(carpetaId, { ...ajustes, token });
  return token;
}

/** Deja solo las carpetas que el cliente puede ver. */
export async function soloLasVisibles<T extends { id: string; name: string }>(
  carpetas: T[]
): Promise<T[]> {
  const guardadas = await almacen.todo();
  return carpetas.filter(
    (c) => !esCarpetaReservada(c.name) && normalizar(guardadas[c.id]).visible
  );
}
