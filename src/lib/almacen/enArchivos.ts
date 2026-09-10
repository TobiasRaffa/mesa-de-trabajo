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
      async guardar(id, valor) {
        await escribirCrudo(archivo, { ...(await todo()), [id]: valor });
      },
      async guardarVarios(cambios) {
        const actual: Record<string, T> = await todo();
        for (const [id, valor] of Object.entries(cambios)) {
          if (valor === undefined) delete actual[id];
          else actual[id] = valor;
        }
        await escribirCrudo(archivo, actual);
      },
      async borrar(id) {
        const actual = await todo();
        delete actual[id];
        await escribirCrudo(archivo, actual);
      },
    };
  },

  documento<T>(
    nombre: string,
    valido: (valor: unknown) => valor is T,
    porOmision: T
  ): Documento<T> {
    const archivo = path.join(CARPETA, `${nombre}.json`);
    return {
      async leer() {
        const crudo = await leerCrudo(archivo);
        return valido(crudo) ? crudo : porOmision;
      },
      async escribir(valor) {
        await escribirCrudo(archivo, valor);
      },
    };
  },
};
