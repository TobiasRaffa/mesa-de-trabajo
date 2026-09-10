// Qué almacén se usa. **Esta es la línea que cambia al mudarse.**
//
// No hace falta elegir a mano: si están las dos variables de Supabase, se usa
// Supabase; si no, los archivos. Así la misma compilación corre en la
// computadora sin configurar nada y en internet con las variables puestas, y
// nadie tiene que acordarse de cambiar un interruptor antes de desplegar
// —que es exactamente el paso que se olvida—.

import type { Almacen } from "@/lib/almacen/contrato";
import { enArchivos } from "@/lib/almacen/enArchivos";
import { enSupabase, supabaseConfigurado } from "@/lib/almacen/enSupabase";

export type { Coleccion, Documento } from "@/lib/almacen/contrato";
export { supabaseConfigurado };

/**
 * En internet, sin Supabase, la aplicación no arranca. A propósito.
 *
 * Guardar en archivos **no funciona** en Netlify: el disco es de solo lectura
 * y se borra en cada despliegue. Si esto no estuviera, el despliegue saldría
 * verde, la aplicación abriría, y cada cosa que la agencia cargara se
 * perdería sin un solo error —la peor forma de fallar que hay: la silenciosa—.
 *
 * Falla en la compilación, que es cuando todavía no hay nadie usándola.
 */
if (process.env.NETLIFY && !supabaseConfigurado()) {
  throw new Error(
    "Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY. " +
      "En internet no se puede guardar en archivos: el disco de Netlify es de " +
      "solo lectura y se borra en cada despliegue. Cargá las dos variables en " +
      "Netlify (Site configuration -> Environment variables) y volvé a " +
      "desplegar. Está explicado en DESPLIEGUE.md."
  );
}

const elegido: Almacen = supabaseConfigurado() ? enSupabase : enArchivos;

/** Dónde se guarda, en palabras. Para la pantalla de diagnóstico. */
export const dondeSeGuarda = supabaseConfigurado() ? "Supabase" : "archivos";

export const coleccion = elegido.coleccion.bind(elegido);
export const documento = elegido.documento.bind(elegido);
