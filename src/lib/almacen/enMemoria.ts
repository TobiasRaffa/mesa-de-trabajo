// El almacén de las pruebas: el mismo contrato, guardado en un objeto.
//
// **Existe porque estaba escrito seis veces a mano.** Cada prueba que necesita
// guardar algo se armaba su propio doble con `vi.mock("@/lib/almacen")`, y
// ninguno estaba completo: varios no tenían `cambiar`, que es justamente la
// única primitiva atómica del contrato. El efecto era peor que la repetición:
// **el código que pasaba a usar `cambiar` —lo correcto— rompía las pruebas**,
// y el que seguía con leer-y-guardar —lo que pierde datos— pasaba en verde. Un
// doble incompleto no es un atajo, es un incentivo al revés.
//
// Cumple el contrato entero y valida como los de verdad, así que una prueba que
// pasa acá dice algo sobre lo que va a pasar en producción.

import type { Almacen, Coleccion, Documento } from "@/lib/almacen/contrato";

export type AlmacenEnMemoria = Almacen & {
  /** Lo guardado de una colección, para mirarlo desde la prueba. */
  ver(coleccion: string): Record<string, unknown>;
  /** Deja todo vacío. Va en un `beforeEach`. */
  vaciar(): void;
};

export function almacenEnMemoria(): AlmacenEnMemoria {
  const colecciones = new Map<string, Record<string, unknown>>();

  const datosDe = (nombre: string) => {
    let datos = colecciones.get(nombre);
    if (!datos) {
      datos = {};
      colecciones.set(nombre, datos);
    }
    return datos;
  };

  return {
    ver: datosDe,
    // **Se vacía el contenido, no el mapa.** Cada colección se queda con el
    // objeto que le tocó al construirse, así que soltar la entrada del mapa no
    // la desconecta de nada: seguía escribiendo y leyendo en el de antes, y una
    // prueba creía arrancar limpia con lo de la anterior todavía adentro.
    vaciar: () => {
      for (const datos of colecciones.values()) {
        for (const clave of Object.keys(datos)) delete datos[clave];
      }
    },

    coleccion<T>(nombre: string, valido: (valor: unknown) => valor is T): Coleccion<T> {
      const datos = datosDe(nombre);

      // Lo que no valida se saltea al leer **pero sigue guardado**, igual que
      // en las dos implementaciones de verdad: una escritura no puede borrar
      // en silencio lo que esta versión del código no sabe leer.
      const todo = async (): Promise<Record<string, T>> => {
        const salida: Record<string, T> = {};
        for (const [id, valor] of Object.entries(datos)) {
          if (valido(valor)) salida[id] = valor;
        }
        return salida;
      };

      return {
        todo,
        async losQueEmpiezanCon(prefijo: string) {
          const todos = await todo();
          return Object.fromEntries(
            Object.entries(todos).filter(([id]) => id.startsWith(prefijo))
          );
        },
        async uno(id) {
          return (await todo())[id];
        },
        async guardar(id, valor) {
          datos[id] = valor;
        },
        async guardarVarios(cambios) {
          for (const [id, valor] of Object.entries(cambios)) {
            if (valor === undefined) delete datos[id];
            else datos[id] = valor;
          }
        },
        async borrar(id) {
          delete datos[id];
        },
        async cambiar(id, como) {
          const habia = datos[id];
          const nuevo = como(valido(habia) ? habia : undefined);
          if (nuevo === undefined) delete datos[id];
          else datos[id] = nuevo;
          return nuevo;
        },
      };
    },

    documento<T>(
      nombre: string,
      valido: (valor: unknown) => valor is T,
      porOmision: T
    ): Documento<T> {
      const datos = datosDe(`documento:${nombre}`);

      const leer = async (): Promise<T> =>
        valido(datos.valor) ? datos.valor : porOmision;

      return {
        leer,
        async escribir(valor) {
          datos.valor = valor;
        },
        async cambiar(como) {
          const nuevo = como(await leer());
          datos.valor = nuevo;
          return nuevo;
        },
      };
    },
  };
}

/**
 * La instancia que usan las pruebas.
 *
 * Una sola por archivo de prueba —cada uno corre con su propio registro de
 * módulos—, para que el doble que ve el código bajo prueba y el que mira la
 * prueba para comprobar qué quedó guardado sean **el mismo**.
 */
export const memoriaDePruebas = almacenEnMemoria();
