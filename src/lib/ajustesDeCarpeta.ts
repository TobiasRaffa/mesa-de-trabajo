// Qué se muestra de cada carpeta, y cómo.
//
// La agencia arma carpetas en Drive —«Logos», «Calendario septiembre»,
// «Banners»— y decide dos cosas sobre cada una: **si el cliente la ve** y **si
// se mira como lista o como mes**. Eso no puede vivir en Drive, porque Drive
// no tiene dónde anotarlo.
//
// Hoy se guarda en un archivo al lado de la aplicación. Es lo que corresponde
// mientras la aplicación corre en una computadora: se puede abrir con el
// Bloc de notas, se puede copiar, y no hace falta base de datos para empezar
// a usarla. **Cuando exista Supabase se cambia el cuerpo de este módulo y no
// se toca ninguna pantalla**: por eso todo pasa por acá.
//
// La regla por omisión es «se muestra, como lista». Una carpeta nueva en Drive
// aparece sola, sin configurar nada; ocultarla es la acción deliberada. Al
// revés —tener que habilitar cada carpeta— convertiría cada trabajo nuevo en
// un trámite, que es justo lo que el portal viene a sacar del medio.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { esDiaValido } from "@/lib/publicaciones";

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
  /**
   * Quién del equipo lleva este trabajo.
   *
   * Es a quién se le avisa cuando el cliente decide algo. Vacío significa que
   * no se le avisa a nadie en particular —el aviso queda igual en la bandeja,
   * pero nadie lo recibe en su correo—.
   */
  asignada?: string;
  /**
   * Hasta cuándo tiene el cliente para revisar, en `AAAA-MM-DD`.
   *
   * Es de la carpeta entera. Una pieza puede tener el suyo propio si hace
   * falta correrle la fecha a una sola: el de la pieza gana.
   *
   * **El plazo avisa, no decide.** Que se cumpla no aprueba ni cierra nada:
   * dispara un aviso y sigue esperando a una persona.
   */
  vence?: string;
};

export type Ajustes = {
  carpetas: Record<string, AjustesDeCarpeta>;
};

const POR_OMISION: AjustesDeCarpeta = { visible: true, vista: "lista" };

const CARPETA_DE_DATOS = path.join(process.cwd(), "datos");
const ARCHIVO = path.join(CARPETA_DE_DATOS, "ajustes.json");

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

/** Lo guardado, o vacío si todavía no se configuró nada. */
export async function leerAjustes(): Promise<Ajustes> {
  try {
    const crudo = await readFile(ARCHIVO, "utf8");
    const datos = JSON.parse(crudo) as unknown;
    return { carpetas: normalizar(datos) };
  } catch {
    // No existe todavía, o alguien lo dejó a medio escribir. En los dos casos
    // la respuesta correcta es «no hay nada configurado», que es un estado
    // válido: se muestra todo como lista.
    return { carpetas: {} };
  }
}

/**
 * Acepta solo lo que tiene la forma esperada.
 *
 * El archivo se puede editar a mano, así que lo que sale de él es tan poco
 * confiable como lo que llega por la red.
 */
function normalizar(datos: unknown): Record<string, AjustesDeCarpeta> {
  const salida: Record<string, AjustesDeCarpeta> = {};
  if (!datos || typeof datos !== "object") return salida;

  const carpetas = (datos as { carpetas?: unknown }).carpetas;
  if (!carpetas || typeof carpetas !== "object") return salida;

  for (const [id, valor] of Object.entries(carpetas as Record<string, unknown>)) {
    if (!valor || typeof valor !== "object") continue;
    const v = valor as {
      visible?: unknown;
      vista?: unknown;
      token?: unknown;
      asignada?: unknown;
      vence?: unknown;
    };
    salida[id] = {
      visible: typeof v.visible === "boolean" ? v.visible : POR_OMISION.visible,
      vista: v.vista === "calendario" ? "calendario" : "lista",
      token: typeof v.token === "string" && v.token ? v.token : undefined,
      asignada: typeof v.asignada === "string" && v.asignada ? v.asignada : undefined,
      vence: esDiaValido(v.vence) ? v.vence : undefined,
    };
  }
  return salida;
}

export async function ajustesDe(carpetaId: string): Promise<AjustesDeCarpeta> {
  const { carpetas } = await leerAjustes();
  return carpetas[carpetaId] ?? POR_OMISION;
}

/**
 * Guarda los ajustes de una carpeta.
 *
 * Escribe primero un archivo al lado y después lo renombra encima del bueno.
 * Renombrar es atómico: si se corta la luz en el medio, queda el archivo
 * viejo entero en vez de uno nuevo por la mitad —que es como se pierde una
 * configuración—.
 */
export async function guardarAjustesDe(
  carpetaId: string,
  ajustes: AjustesDeCarpeta
): Promise<void> {
  const actuales = await leerAjustes();
  const siguiente: Ajustes = {
    carpetas: { ...actuales.carpetas, [carpetaId]: ajustes },
  };

  await mkdir(CARPETA_DE_DATOS, { recursive: true });
  const temporal = `${ARCHIVO}.${process.pid}.tmp`;
  await writeFile(temporal, JSON.stringify(siguiente, null, 2), "utf8");
  await rename(temporal, ARCHIVO);
}

/** Deja solo las carpetas que el cliente puede ver. */
export async function soloLasVisibles<T extends { id: string; name: string }>(
  carpetas: T[]
): Promise<T[]> {
  const { carpetas: guardadas } = await leerAjustes();
  return carpetas.filter(
    (c) => !esCarpetaReservada(c.name) && (guardadas[c.id] ?? POR_OMISION).visible
  );
}

/**
 * El link propio de una carpeta, generándolo si todavía no tiene.
 *
 * Se genera cuando alguien lo pide y no antes: una carpeta que nadie va a
 * compartir por separado no necesita link, y generarlos todos de entrada
 * llenaría el archivo de tokens que no se usan nunca.
 */
export async function linkDeCarpeta(carpetaId: string): Promise<string> {
  const ajustes = await ajustesDe(carpetaId);
  if (ajustes.token) return ajustes.token;

  const token = randomBytes(12).toString("base64url");
  await guardarAjustesDe(carpetaId, { ...ajustes, token });
  return token;
}
