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

export const REQUERIDAS: VariableRequerida[] = [
  { nombre: "GOOGLE_SA_EMAIL", para: "identificar a la cuenta de servicio ante Google" },
  { nombre: "GOOGLE_SA_KEY", para: "firmar el pedido de acceso a Google" },
];

/** Las que faltan o están vacías. Lista vacía significa que está todo. */
export function variablesFaltantes(): VariableRequerida[] {
  return REQUERIDAS.filter(({ nombre }) => !process.env[nombre]?.trim());
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
