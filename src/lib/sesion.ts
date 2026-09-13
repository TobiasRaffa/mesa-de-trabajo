// Quién de la agencia está usando la aplicación.
//
// **Es identificación, no login.** No hay contraseña por persona: se elige el
// nombre de una lista y queda anotado en ese navegador. Quien se sienta en esa
// computadora ya está adentro de la oficina; lo que faltaba no era una puerta,
// era que la aplicación supiera **quién**.
//
// Por qué importa: los mensajes de la agencia salían todos firmados «El
// equipo», y el cliente no sabía con quién estaba hablando. La primera versión
// puso un desplegable en el chat para elegir quién firma, y eso está mal por
// dos razones: hay que acordarse de mirarlo cada vez, y el día que se firme
// mal no hay a quién preguntarle.
//
// **Vive en una galleta y no en `localStorage`** porque el servidor la
// necesita: es él quien escribe el mensaje, y tiene que saber de quién es sin
// que el navegador se lo diga en cada pedido.
//
// **No está firmada, y eso es correcto acá.** Una firma protegería contra
// alguien que se hace pasar por otro, y hoy no hay nada que proteger: gestión
// abre sin contraseña, así que quien quisiera hacerse pasar por otro puede
// simplemente elegirlo de la lista. Firmarla daría una sensación de seguridad
// que no existe. Lo que sí se hace es comprobar que sea alguien del equipo de
// verdad: un identificador inventado no firma nada.
//
// Cuando exista el login —con Supabase, con un correo y una contraseña por
// persona— esto es lo único que cambia: de dónde sale el identificador. Todo
// lo que lo usa se queda igual.

import { cookies } from "next/headers";
import { personaPorId, type Persona } from "@/lib/equipo";

export const GALLETA_DE_QUIEN = "mdt_quien";

/** Un mes. Se elige una vez y no se vuelve a pensar. */
export const DURACION_DE_SESION = 60 * 60 * 24 * 30;

/**
 * Quién está usando esto, o `null` si todavía no lo dijo.
 *
 * Devuelve la persona entera y no su identificador: quien pregunta casi
 * siempre quiere el nombre o el correo, y hacerle buscar la persona después
 * sería repartir la misma búsqueda por toda la aplicación.
 */
export async function quienSoy(): Promise<Persona | null> {
  const id = (await cookies()).get(GALLETA_DE_QUIEN)?.value;
  if (!id) return null;
  // Se comprueba contra el equipo: alguien que ya no está deja de firmar.
  return personaPorId(id);
}

/** Cómo se firma lo que no lo manda una persona en particular. */
export const LA_AGENCIA = "El equipo";

/** El nombre con el que firmar, con el de la agencia como respaldo. */
export async function firmaDeAgencia(): Promise<string> {
  return (await quienSoy())?.nombre ?? LA_AGENCIA;
}
