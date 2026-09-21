// Las contraseñas del equipo.
//
// **Viven aparte de la ficha de cada persona, y eso no es orden: es la
// defensa.** La lista del equipo se le pasa entera a pantallas que corren en
// el navegador —el árbol de clientes la usa para el desplegable de «quién lo
// lleva»—, así que todo lo que esté adentro de `Persona` termina en el
// paquete que se descarga. Guardar el hash ahí sería repartirlo en cada carga
// de página. Acá no puede pasar: este módulo no lo importa ninguna pantalla, y
// hay un guardián que lo verifica.
//
// **Nunca se guarda la contraseña, solo una huella.** Con `scrypt`, que está
// en Node y no agrega una dependencia: derivar la huella cuesta a propósito,
// así que probar millones de contraseñas contra el archivo robado deja de ser
// gratis. Cada una lleva su propia sal, para que dos personas con la misma
// contraseña no tengan la misma huella.

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { coleccion } from "@/lib/almacen";

const derivar = promisify(scrypt) as (
  clave: string,
  sal: Buffer,
  largo: number
) => Promise<Buffer>;

/** Cuánto ocupa la huella. 32 bytes es lo que recomienda la propia función. */
const LARGO = 32;

/**
 * La sal contra la que se deriva cuando no hay nadie.
 *
 * Es de esta corrida y no una constante escrita en el código: no protege nada
 * —lo que se busca es que tarde, no que sea secreta— pero tampoco hace falta
 * que sea la misma para siempre.
 */
const SAL_DE_MENTIRA = randomBytes(16);

// El largo mínimo vive en el dominio porque además lo necesita el campo donde
// se escribe, que corre en el navegador. Se reexporta para no obligar a nadie a
// cambiar de puerta.
export { LARGO_MINIMO_DE_CLAVE } from "@/dominio/claves";

const esTexto = (v: unknown): v is string => typeof v === "string";
const almacen = coleccion<string>("claves", esTexto);

/**
 * Cómo se escribe una huella guardada: el método, la sal, el resultado y
 * **desde cuándo vale**.
 *
 * La fecha es lo que echa a las sesiones viejas: una galleta emitida antes de
 * que esta contraseña existiera es de alguien que entró con la anterior —o con
 * ninguna, si se la reiniciaron—, y no tiene por qué seguir adentro.
 */
const armar = (sal: Buffer, huella: Buffer, desde: number) =>
  `scrypt$${sal.toString("base64")}$${huella.toString("base64")}$${desde}`;

export async function ponerClave(personaId: string, clave: string): Promise<void> {
  const sal = randomBytes(16);
  const huella = await derivar(clave, sal, LARGO);
  await almacen.guardar(personaId, armar(sal, huella, Date.now()));
}

/**
 * Desde cuándo vale la contraseña de alguien, en milisegundos desde 1970.
 *
 * `null` si no tiene ninguna: sin contraseña no hay sesión que valga. Una
 * huella de antes de que se anotara la fecha vale desde siempre (cero).
 */
export async function claveDesde(personaId: string): Promise<number | null> {
  const guardado = await almacen.uno(personaId);
  if (!guardado) return null;
  const desde = Number(guardado.split("$")[3] ?? 0);
  return Number.isFinite(desde) ? desde : 0;
}

/** Saca la contraseña de alguien. Vuelve a no poder entrar. */
export async function sacarClave(personaId: string): Promise<void> {
  await almacen.borrar(personaId);
}

export async function tieneClave(personaId: string): Promise<boolean> {
  return Boolean(await almacen.uno(personaId));
}

/**
 * Quiénes pueden entrar hoy.
 *
 * Sirve para una sola pregunta y es importante: **¿hay alguien con contraseña?**
 * Mientras no haya nadie, la puerta no se podría abrir nunca, así que acepta
 * la llave del equipo para poder cargar la primera. Ese camino se cierra solo
 * en cuanto alguien tiene la suya.
 */
export async function hayAlguienConClave(): Promise<boolean> {
  return Object.keys(await almacen.todo()).length > 0;
}

/**
 * Si esta contraseña es la de esa persona.
 *
 * Compara en tiempo constante: `===` tarda distinto según cuántos bytes
 * coinciden, y esa diferencia se puede medir para ir adivinando de a poco.
 */
export async function claveCorrecta(personaId: string, clave: string): Promise<boolean> {
  const guardado = await almacen.uno(personaId);
  // **Sin huella se deriva igual, contra una de mentira.** Salir por acá sin
  // derivar nada tarda microsegundos; derivar tarda decenas de milisegundos a
  // propósito. Esa diferencia se mide desde afuera, y convierte la pantalla de
  // entrar en la forma cómoda de averiguar qué correos existen —justo lo que
  // el mensaje único de la puerta viene a evitar—.
  if (!guardado) {
    await derivar(clave, SAL_DE_MENTIRA, LARGO);
    return false;
  }

  const [metodo, salEnTexto, huellaEnTexto] = guardado.split("$");
  if (metodo !== "scrypt" || !salEnTexto || !huellaEnTexto) return false;

  const esperada = Buffer.from(huellaEnTexto, "base64");
  if (esperada.length !== LARGO) return false;

  const obtenida = await derivar(clave, Buffer.from(salEnTexto, "base64"), LARGO);
  return timingSafeEqual(esperada, obtenida);
}
