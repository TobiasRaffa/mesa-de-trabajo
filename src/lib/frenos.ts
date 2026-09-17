// El freno de los que prueban.
//
// **Sin esto, adivinar una contraseña contra esta aplicación es gratis.** Ocho
// intentos por minuto y por correo hacen que probar un diccionario tarde años;
// sin freno, tarda una tarde. Lo mismo del otro lado del mostrador, con la
// clave que escribe el cliente después de abrir su link.
//
// **Vivía en memoria, y en internet eso no frena nada.** Andaba bien en la
// computadora de la oficina, donde corre un proceso solo. En Netlify cada
// pedido puede caer en otra máquina, cada una con su propia cuenta en cero: el
// que prueba mil contraseñas no toca ocho veces la misma cuenta, toca una vez
// mil cuentas distintas. El freno estaba puesto y no frenaba, que es peor que
// no tenerlo, porque nadie lo mira.
//
// Ahora la cuenta vive donde vive todo: en el almacén, que es el mismo para
// todas las máquinas. Y se suma con `cambiar`, en un solo paso: leer, sumar
// uno y guardar en tres pasos deja que ocho intentos simultáneos cuenten como
// uno, que es exactamente lo que haría quien viene a probar en serio.
//
// **Es un contador, no un registro.** Es lo único de toda la aplicación que se
// borra de verdad: en cuanto alguien entra bien, su cuenta desaparece. No hay
// nada que conservar —no cuenta una historia de nadie— y dejarlo sería juntar
// para siempre la lista de todos los correos que alguien probó alguna vez.

import { coleccion } from "@/lib/almacen";

type Cuenta = {
  cuantos: number;
  /** Hasta cuándo vale, en milisegundos desde 1970. */
  hasta: number;
};

const esCuenta = (v: unknown): v is Cuenta =>
  Boolean(v) &&
  typeof v === "object" &&
  typeof (v as Cuenta).cuantos === "number" &&
  typeof (v as Cuenta).hasta === "number";

const almacen = coleccion<Cuenta>("frenos", esCuenta);

export type Limite = {
  /** Cuántos intentos fallidos se aguantan antes de frenar. */
  tope: number;
  /** Cuánto dura el freno, en milisegundos. */
  espera: number;
};

/**
 * Si está frenado ahora mismo.
 *
 * **No cuenta.** Preguntar no es intentar: si preguntar sumara, la pantalla se
 * frenaría sola con solo mirarla.
 */
export async function frenado(quien: string, limite: Limite): Promise<boolean> {
  const cuenta = await almacen.uno(quien);
  if (!cuenta || cuenta.hasta < Date.now()) return false;
  return cuenta.cuantos >= limite.tope;
}

/**
 * Anota que erró.
 *
 * La ventana se corre con cada error: quien sigue probando no espera a que se
 * le venza la primera, espera a partir de la última. Si no, alcanzaría con
 * probar ocho, esperar el minuto y volver a probar ocho, para siempre.
 */
export async function anotarError(quien: string, limite: Limite): Promise<void> {
  const ahora = Date.now();
  await almacen.cambiar(quien, (actual) => ({
    cuantos: actual && actual.hasta >= ahora ? actual.cuantos + 1 : 1,
    hasta: ahora + limite.espera,
  }));
  await barrerVencidas(ahora);
}

/** Entró bien: la cuenta se va. */
export async function olvidarErrores(quien: string): Promise<void> {
  await almacen.borrar(quien);
}

/**
 * Saca las cuentas ya vencidas.
 *
 * Se hace acá, del lado del que erró, porque es el único camino por el que
 * esta colección crece: quien entra bien borra la suya. Sin esto, la lista de
 * correos que alguien probó alguna vez quedaría guardada para siempre —y no
 * hay ninguna razón para conservarla—.
 */
async function barrerVencidas(ahora: number): Promise<void> {
  const todas = await almacen.todo();
  const vencidas = Object.entries(todas).filter(([, c]) => c.hasta < ahora);
  if (vencidas.length === 0) return;

  await almacen.guardarVarios(
    Object.fromEntries(vencidas.map(([quien]) => [quien, undefined]))
  );
}
