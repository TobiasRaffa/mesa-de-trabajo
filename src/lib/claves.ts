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

// El largo mínimo vive en el dominio porque además lo necesita el campo donde
// se escribe, que corre en el navegador. Se reexporta para no obligar a nadie a
// cambiar de puerta.
export { LARGO_MINIMO_DE_CLAVE } from "@/dominio/claves";

const esTexto = (v: unknown): v is string => typeof v === "string";
const almacen = coleccion<string>("claves", esTexto);

/** Cómo se escribe una huella guardada: el método, la sal y el resultado. */
const armar = (sal: Buffer, huella: Buffer) =>
  `scrypt$${sal.toString("base64")}$${huella.toString("base64")}`;

export async function ponerClave(personaId: string, clave: string): Promise<void> {
  const sal = randomBytes(16);
  const huella = await derivar(clave, sal, LARGO);
  await almacen.guardar(personaId, armar(sal, huella));
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
  if (!guardado) return false;

  const [metodo, salEnTexto, huellaEnTexto] = guardado.split("$");
  if (metodo !== "scrypt" || !salEnTexto || !huellaEnTexto) return false;

  const esperada = Buffer.from(huellaEnTexto, "base64");
  if (esperada.length !== LARGO) return false;

  const obtenida = await derivar(clave, Buffer.from(salEnTexto, "base64"), LARGO);
  return timingSafeEqual(esperada, obtenida);
}
