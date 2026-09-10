// Un ajuste que se hereda de arriba hacia abajo.
//
//     Cliente ─────────► el valor que se le puso
//       └ Carpeta ─────► hereda el del cliente, salvo que tenga el suyo
//           └ Archivo ─► hereda el de su carpeta, salvo que tenga el suyo
//
// Y **lo de arriba borra lo de abajo**: poner un valor en el cliente vuelve a
// dejar a todas sus carpetas y archivos heredando. Sin eso, cambiar el plazo
// del cliente dejaría carpetas con el valor viejo y nadie sabría de dónde
// salió.
//
// Está acá y no repetido porque son dos ajustes con exactamente la misma
// regla —el tiempo de revisión y quién lo lleva— y ya se sabe cómo termina
// eso: se escriben dos veces, después una de las dos se arregla y la otra no.
//
// «No está» y «está puesto en nada» son cosas distintas. Un responsable puesto
// en «nadie» a nivel carpeta **no** hereda al del cliente: alguien decidió que
// esa carpeta no la lleva nadie. Por eso el valor guardado puede ser `null` y
// eso no es lo mismo que la ausencia de la clave.

import { coleccion } from "@/lib/almacen";

export type AlmacenHeredable<T> = {
  /** Lo puesto a mano en cada id. Sin entrada significa «hereda». */
  leerVarios(ids: string[]): Promise<Record<string, T | null>>;
  leerUno(id: string): Promise<T | null | undefined>;
  /** Pone un valor y deja heredando a todo lo que esté debajo. */
  poner(id: string, valor: T | null, debajo?: string[]): Promise<void>;
};

/**
 * `null` es un valor puesto a mano; la ausencia de la clave es «hereda». Se
 * guarda envuelto porque el almacén no distingue «guardado como nada» de «no
 * guardado», y esa diferencia es justamente la regla.
 */
type Envuelto<T> = { valor: T | null };

export function almacenHeredable<T>(
  nombre: string,
  esValido: (valor: unknown) => valor is T
): AlmacenHeredable<T> {
  const esEnvuelto = (v: unknown): v is Envuelto<T> => {
    if (!v || typeof v !== "object" || !("valor" in v)) return false;
    const dentro = (v as { valor: unknown }).valor;
    return dentro === null || esValido(dentro);
  };

  const almacen = coleccion<Envuelto<T>>(nombre, esEnvuelto);

  return {
    async leerVarios(ids) {
      const todo = await almacen.todo();
      const salida: Record<string, T | null> = {};
      for (const id of ids) if (id in todo) salida[id] = todo[id].valor;
      return salida;
    },

    async leerUno(id) {
      const guardado = await almacen.uno(id);
      return guardado ? guardado.valor : undefined;
    },

    async poner(id, valor, debajo = []) {
      if (valor !== null && !esValido(valor)) return;
      const cambios: Record<string, Envuelto<T> | undefined> = { [id]: { valor } };
      for (const hijo of debajo) cambios[hijo] = undefined;
      await almacen.guardarVarios(cambios);
    },
  };
}

/** El valor que corre: el propio, si no el de arriba, si no el de más arriba. */
export function heredado<T>(
  ...niveles: Array<T | null | undefined>
): T | null | undefined {
  // `!==  undefined` y no `??`: un `null` puesto a mano es una decisión
  // —«esta carpeta no la lleva nadie»— y no tiene que caer al de arriba.
  for (const nivel of niveles) if (nivel !== undefined) return nivel;
  return undefined;
}
