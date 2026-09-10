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

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const CARPETA_DE_DATOS = path.join(process.cwd(), "datos");

export type AlmacenHeredable<T> = {
  /** Lo puesto a mano en cada id. Sin entrada significa «hereda». */
  leerVarios(ids: string[]): Promise<Record<string, T | null>>;
  leerUno(id: string): Promise<T | null | undefined>;
  /** Pone un valor y deja heredando a todo lo que esté debajo. */
  poner(id: string, valor: T | null, debajo?: string[]): Promise<void>;
};

export function almacenHeredable<T>(
  nombreDeArchivo: string,
  esValido: (valor: unknown) => valor is T
): AlmacenHeredable<T> {
  const ARCHIVO = path.join(CARPETA_DE_DATOS, nombreDeArchivo);

  async function leerTodo(): Promise<Record<string, T | null>> {
    try {
      const datos = JSON.parse(await readFile(ARCHIVO, "utf8")) as unknown;
      if (!datos || typeof datos !== "object") return {};

      const salida: Record<string, T | null> = {};
      for (const [id, valor] of Object.entries(datos as Record<string, unknown>)) {
        // El archivo se puede editar a mano: se acepta solo lo que tiene forma.
        if (valor === null || esValido(valor)) salida[id] = valor as T | null;
      }
      return salida;
    } catch {
      return {};
    }
  }

  async function escribir(datos: Record<string, T | null>): Promise<void> {
    await mkdir(CARPETA_DE_DATOS, { recursive: true });
    const temporal = `${ARCHIVO}.${process.pid}.tmp`;
    await writeFile(temporal, JSON.stringify(datos, null, 2), "utf8");
    await rename(temporal, ARCHIVO);
  }

  return {
    async leerVarios(ids) {
      const todo = await leerTodo();
      const salida: Record<string, T | null> = {};
      for (const id of ids) if (id in todo) salida[id] = todo[id];
      return salida;
    },

    async leerUno(id) {
      const todo = await leerTodo();
      return id in todo ? todo[id] : undefined;
    },

    async poner(id, valor, debajo = []) {
      if (valor !== null && !esValido(valor)) return;
      const todo = await leerTodo();
      todo[id] = valor;
      for (const hijo of debajo) delete todo[hijo];
      await escribir(todo);
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
