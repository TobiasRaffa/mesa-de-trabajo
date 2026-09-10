// Validación de las variables de entorno.
//
// Existe para que una configuración incompleta falle de una manera que se
// entienda. Sin esto, una variable olvidada en el panel de Netlify se
// manifiesta como un error críptico de Google en medio de una pantalla, y
// se pierden horas buscando en el lugar equivocado.

export type VariableRequerida = {
  nombre: string;
  /** Para qué sirve, en castellano, para que el mensaje de error enseñe algo. */
  para: string;
};

const REQUERIDAS: VariableRequerida[] = [
  { nombre: "GOOGLE_SA_EMAIL", para: "identificar a la cuenta de servicio ante Google" },
  { nombre: "GOOGLE_SA_KEY", para: "firmar el pedido de acceso a Google" },
];

/** Las que faltan o están vacías. Lista vacía significa que está todo. */
export function variablesFaltantes(): VariableRequerida[] {
  return REQUERIDAS.filter(({ nombre }) => !process.env[nombre]?.trim());
}

/**
 * Las que en la máquina son opcionales y en internet no.
 *
 * Sin `CLAVE_DE_ADMIN` no hay contraseña que comparar, así que gestión queda
 * cerrada para todos —falla del lado seguro, pero falla—. Sin
 * `SECRETO_DE_SESION`, cada instancia de Netlify que arranque en frío puede
 * generar la suya y los clientes se caen al saltar de una a otra.
 *
 * Acá no valían de nada como advertencia en una tabla del documento de
 * despliegue: una configuración de seguridad que depende de que alguien se
 * acuerde de completar una fila es la fila que se olvida.
 */
const REQUERIDAS_EN_INTERNET: VariableRequerida[] = [
  { nombre: "CLAVE_DE_ADMIN", para: "la contraseña con la que entra el equipo a gestión" },
  { nombre: "SECRETO_DE_SESION", para: "firmar las galletas, igual en todas las máquinas" },
];

/**
 * Corta la compilación si falta algo que en internet no puede faltar.
 *
 * Es el mismo freno que impide desplegar sin Supabase, y por el mismo motivo:
 * el despliegue saldría verde y el problema aparecería después, con gente
 * usándolo. Falla acá, que es cuando todavía no hay nadie.
 */
export function revisarLoQueInternetExige(): void {
  if (!process.env.NETLIFY) return;

  const faltan = REQUERIDAS_EN_INTERNET.filter(
    ({ nombre }) => !process.env[nombre]?.trim()
  );
  if (faltan.length === 0) return;

  const lista = faltan.map((v) => `  - ${v.nombre}: ${v.para}`).join("\n");
  throw new Error(
    `Faltan variables que en internet no pueden faltar:\n${lista}\n\n` +
      `Se cargan en Netlify, en Site configuration -> Environment variables. ` +
      `Está explicado en DESPLIEGUE.md.`
  );
}

/**
 * Deja la llave privada como la espera el módulo de criptografía: con saltos
 * de línea de verdad.
 *
 * Hace falta porque la misma llave llega de dos formas según dónde corra:
 *
 *   - En la máquina, desde `.env.local` entre comillas, ya con saltos reales.
 *   - En Netlify, pegada en un panel web, donde lo habitual es escribirla en
 *     una sola línea con la secuencia `\n` escrita literalmente.
 *
 * Si no se contemplan las dos, funciona en un lado y falla en el otro con un
 * error de Google que no explica nada. Convertir es inofensivo cuando no hay
 * nada que convertir, así que se hace siempre.
 */
export function normalizarLlave(bruta: string): string {
  return bruta.replace(/\\n/g, "\n").trim();
}

/**
 * Devuelve las credenciales de Google, o falla con un mensaje que dice qué
 * hacer y dónde.
 */
export function credencialesDeGoogle(): { email: string; llave: string } {
  const faltantes = variablesFaltantes().filter((v) => v.nombre.startsWith("GOOGLE_"));

  if (faltantes.length > 0) {
    const lista = faltantes.map((v) => `  - ${v.nombre}: ${v.para}`).join("\n");
    throw new Error(
      `Faltan variables de entorno:\n${lista}\n\n` +
        `En tu máquina se cargan desde .env.local. En Netlify se configuran en ` +
        `Site settings → Environment variables.`
    );
  }

  return {
    email: process.env.GOOGLE_SA_EMAIL!.trim(),
    llave: normalizarLlave(process.env.GOOGLE_SA_KEY!),
  };
}
