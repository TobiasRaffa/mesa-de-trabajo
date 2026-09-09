// Cómo se marca que un archivo es la segunda vuelta de otro.
//
// **Se marca con el nombre, y nada más.** Al final del nombre se agrega
// ` V2`, y para la siguiente ` V3`. El archivo original no lleva nada.
//
//     9304.jpeg        ← la primera versión
//     9304 V2.jpeg     ← la segunda: es la misma pieza
//     9304 V3.jpeg     ← la tercera
//
// Es a propósito lo más barato que se podía elegir: renombrar al guardar es
// algo que un diseñador ya hace sin pensar, y no obliga a abrir la aplicación
// para avisar nada. La agencia sube el archivo a la misma carpeta y el portal
// entiende solo que es una vuelta nueva de la pieza, la muestra como la
// actual, y habilita el botón de comparar con la anterior.
//
// Dos cosas que quedan fuera a propósito:
//
//   - **La extensión cuenta.** `9304.jpg` y `9304.png` son dos piezas, no dos
//     versiones. Es común entregar el mismo trabajo en dos formatos —uno para
//     mirar y otro para imprimir— y juntarlos sería mentir sobre qué se está
//     aprobando.
//   - **No se adivina nada más.** Solo el sufijo de versión. Si el nombre
//     cambia, es otra pieza; que dos trabajos distintos se junten sin que
//     nadie lo pida sería mucho peor que no agruparlos.

/**
 * Reconoce el sufijo de versión al final del nombre, antes de la extensión.
 *
 * Acepta las formas en que la gente lo escribe de verdad: con espacio, guion
 * o guion bajo, y la uve en cualquier caja. `v1` también vale, aunque no haga
 * falta escribirlo.
 */
const SUFIJO = /[ _-]+v\s*(\d{1,3})$/i;

export type NombreDeArchivo = {
  /** Lo que identifica a la pieza: el nombre sin el sufijo, con extensión. */
  base: string;
  /** Qué vuelta es. Sin sufijo, es la primera. */
  version: number;
  /** El nombre lindo para mostrar, sin el sufijo ni la extensión. */
  titulo: string;
};

export function leerNombre(nombre: string): NombreDeArchivo {
  const punto = nombre.lastIndexOf(".");
  // Un punto al principio no es una extensión, es un archivo oculto.
  const hayExtension = punto > 0;
  const cuerpo = hayExtension ? nombre.slice(0, punto) : nombre;
  const extension = hayExtension ? nombre.slice(punto) : "";

  const marca = cuerpo.match(SUFIJO);
  const limpio = marca ? cuerpo.slice(0, cuerpo.length - marca[0].length) : cuerpo;

  // «V2.jpeg» a secas no es la versión dos de nada: sin nombre delante, el
  // sufijo *es* el nombre.
  if (marca && limpio.trim() === "") {
    return { base: nombre, version: 1, titulo: cuerpo };
  }

  return {
    base: limpio + extension,
    version: marca ? Number(marca[1]) : 1,
    titulo: limpio,
  };
}

export type ConNombre = { name: string };

export type Agrupado<T> = {
  /** El nombre de la pieza, sin sufijo ni extensión. */
  titulo: string;
  /** De la más vieja a la más nueva. La última es la que se está mirando. */
  versiones: Array<{ numero: number; archivo: T }>;
};

/**
 * Junta los archivos de una carpeta en piezas, agrupando las versiones.
 *
 * Conserva el orden en que llegaron los archivos —Drive los devuelve por
 * nombre—, tomando el lugar de la primera versión de cada pieza. Así la lista
 * no se reordena sola cuando alguien sube una vuelta nueva.
 */
export function agruparVersiones<T extends ConNombre>(archivos: T[]): Array<Agrupado<T>> {
  const porBase = new Map<string, Agrupado<T>>();

  for (const archivo of archivos) {
    const { base, version, titulo } = leerNombre(archivo.name);
    const pieza = porBase.get(base);

    if (pieza) {
      pieza.versiones.push({ numero: version, archivo });
    } else {
      porBase.set(base, { titulo, versiones: [{ numero: version, archivo }] });
    }
  }

  for (const pieza of porBase.values()) {
    // Dos archivos pueden reclamar el mismo número —«9304.jpeg» y
    // «9304 V1.jpeg»—. Se ordena de forma estable para que el resultado no
    // dependa del orden en que Drive los devolvió.
    pieza.versiones.sort((a, b) => a.numero - b.numero);
  }

  return [...porBase.values()];
}
