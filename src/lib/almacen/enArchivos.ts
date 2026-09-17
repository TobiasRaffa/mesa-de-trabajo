// El almacén de hoy: un archivo JSON por colección, al lado de la aplicación.
//
// Es lo que corresponde mientras corre en una computadora: se abre con el Bloc
// de notas, se copia con arrastrar la carpeta, y no hace falta base de datos
// para empezar a usarla.
//
// **No sirve en internet**, y conviene tenerlo claro desde ahora: en Netlify el
// disco es de solo lectura y se borra en cada despliegue. Subir la aplicación
// con esto sería subirla sin memoria. Por eso existe el contrato: el día del
// despliegue se cambia una línea, no nueve módulos.
//
// Todas las escrituras van a un archivo temporal y después se renombra encima
// del bueno. Renombrar es atómico: si se corta la luz en el medio queda el
// archivo viejo entero, en vez de uno nuevo por la mitad —que es como se
// pierde una configuración sin que nadie se entere—.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Almacen, Coleccion, Documento } from "@/lib/almacen/contrato";

const CARPETA = path.join(process.cwd(), "datos");

async function leerCrudo(archivo: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(archivo, "utf8"));
  } catch {
    // No existe todavía, o quedó a medio escribir. En los dos casos la
    // respuesta correcta es «no hay nada», que es un estado válido.
    return null;
  }
}

/**
 * Una fila de espera por archivo.
 *
 * **Cada guardado lee el archivo entero, le pega el cambio y lo vuelve a
 * escribir.** Con dos cosas pasando a la vez —el cliente aprueba una pieza
 * mientras la agencia entrega otra— las dos leen lo mismo, las dos escriben, y
 * la segunda pisa a la primera: un cambio desaparece sin error, sin aviso y
 * sin rastro. Es la peor clase de falla que puede tener esto, porque lo que se
 * pierde es trabajo de alguien.
 *
 * Acá corre un solo proceso, así que alcanza con hacer cola: cada operación que
 * escribe espera a la anterior del mismo archivo. Lo que se serializa es el par
 * leer+escribir, que es donde está la carrera.
 *
 * **Supabase no lo necesita**: ahí cada documento es una fila y guardar uno no
 * toca a los demás. Por eso vive acá y no en el contrato.
 */
const filas = new Map<string, Promise<unknown>>();

function enFila<T>(archivo: string, tarea: () => Promise<T>): Promise<T> {
  const anterior = filas.get(archivo) ?? Promise.resolve();
  // Se encadena con `then` en las dos ramas: si una falla, la siguiente igual
  // tiene que correr. Una cola que se traba con el primer error es peor que no
  // tenerla.
  const proxima = anterior.then(tarea, tarea);
  filas.set(
    archivo,
    proxima.catch(() => undefined)
  );
  return proxima;
}

async function escribirCrudo(archivo: string, datos: unknown): Promise<void> {
  await mkdir(CARPETA, { recursive: true });
  const temporal = `${archivo}.${process.pid}.tmp`;
  await writeFile(temporal, JSON.stringify(datos, null, 2), "utf8");
  await rename(temporal, archivo);
}

export const enArchivos: Almacen = {
  coleccion<T>(nombre: string, valido: (valor: unknown) => valor is T): Coleccion<T> {
    const archivo = path.join(CARPETA, `${nombre}.json`);

    async function todo(): Promise<Record<string, T>> {
      const crudo = await leerCrudo(archivo);
      if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return {};

      const salida: Record<string, T> = {};
      for (const [id, valor] of Object.entries(crudo as Record<string, unknown>)) {
        if (valido(valor)) salida[id] = valor;
      }
      return salida;
    }

    return {
      todo,
      async uno(id) {
        return (await todo())[id];
      },
      // Las tres que escriben van en fila: leen y escriben sin que nadie se
      // meta en el medio.
      async guardar(id, valor) {
        await enFila(archivo, async () => {
          await escribirCrudo(archivo, { ...(await todo()), [id]: valor });
        });
      },
      async guardarVarios(cambios) {
        await enFila(archivo, async () => {
          const actual: Record<string, T> = await todo();
          for (const [id, valor] of Object.entries(cambios)) {
            if (valor === undefined) delete actual[id];
            else actual[id] = valor;
          }
          await escribirCrudo(archivo, actual);
        });
      },
      async borrar(id) {
        await enFila(archivo, async () => {
          const actual = await todo();
          delete actual[id];
          await escribirCrudo(archivo, actual);
        });
      },
      // Leer y escribir adentro de la misma vuelta de la fila: nadie puede
      // guardar entre lo que esto lee y lo que esto escribe.
      async cambiar(id, como) {
        return enFila(archivo, async () => {
          const actual = await todo();
          const nuevo = como(actual[id]);
          if (nuevo === undefined) delete actual[id];
          else actual[id] = nuevo;
          await escribirCrudo(archivo, actual);
          return nuevo;
        });
      },
    };
  },

  documento<T>(
    nombre: string,
    valido: (valor: unknown) => valor is T,
    porOmision: T
  ): Documento<T> {
    const archivo = path.join(CARPETA, `${nombre}.json`);

    async function leer(): Promise<T> {
      const crudo = await leerCrudo(archivo);
      return valido(crudo) ? crudo : porOmision;
    }

    return {
      leer,
      async escribir(valor) {
        // También en fila: si no, un `escribir` suelto se mete entre el leer y
        // el escribir de un `cambiar` y se pierde uno de los dos.
        await enFila(archivo, () => escribirCrudo(archivo, valor));
      },
      async cambiar(como) {
        return enFila(archivo, async () => {
          const nuevo = como(await leer());
          await escribirCrudo(archivo, nuevo);
          return nuevo;
        });
      },
    };
  },
};
