// Cómo se marca que un archivo es la segunda vuelta de otro.
//
// **Se marca con el nombre, y nada más.** Se escribe `V2` —y después `V3`—
// **adelante o atrás** del nombre. El archivo original no lleva nada.
//
//     9304.jpeg                       ← la primera versión
//     V2 9304.jpeg                    ← la segunda: es la misma pieza
//     9304 V2.jpeg                    ← lo mismo, escrito al final
//
//     banner dia del padre.pdf        ← la primera
//     V2 banner dia del padre.pdf     ← la segunda
//
// **Adelante también, porque así lo escriben.** Al principio solo se leía el
// final del nombre, y en el estudio se nombra al revés: «V2 banner dia del
// padre». Con la regla vieja eso no era una vuelta nueva sino una pieza
// distinta, y el cliente terminaba con dos trabajos donde había uno solo, sin
// poder comparar. Se cambió por eso y no por gusto: la regla la escribe quien
// nombra los archivos, no quien escribe el código.
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
 * La marca de versión al final del nombre, antes de la extensión.
 *
 * Acepta las formas en que la gente lo escribe de verdad: con espacio, guion
 * o guion bajo, y la uve en cualquier caja. `v1` también vale, aunque no haga
 * falta escribirlo.
 */
const SUFIJO = /[ _-]+v\s*(\d{1,3})$/i;

/**
 * La misma marca, al principio: «V2 banner dia del padre».
 *
 * Pide un separador después del número —espacio, guion o guion bajo— para no
 * comerse el nombre: sin eso, `V2025 balance` sería la versión 2025 de
 * «025 balance», que no es nada.
 */
const PREFIJO = /^v\s*(\d{1,3})[ _-]+/i;

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

  // Primero adelante, que es como se escribe acá; si no, al final. Nunca las
  // dos: «V2 banner V3» no tiene una respuesta correcta, y elegir una en
  // silencio sería inventarla. Gana la de adelante y la otra queda como parte
  // del nombre, que es visible y se puede corregir.
  const adelante = cuerpo.match(PREFIJO);
  const atras = adelante ? null : cuerpo.match(SUFIJO);

  const limpio = adelante
    ? cuerpo.slice(adelante[0].length)
    : atras
      ? cuerpo.slice(0, cuerpo.length - atras[0].length)
      : cuerpo;

  const marca = adelante ?? atras;

  // «V2.jpeg» a secas no es la versión dos de nada: sin nombre al lado, la
  // marca *es* el nombre.
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

// ---------------------------------------------------------------------------

/**
 * **Cómo se llama una pieza, para nosotros.**
 *
 * Una pieza no es un archivo: es el trabajo que la agencia llama «9304» dentro
 * de una carpeta, y del que hay una o varias vueltas. `9304.jpeg` y
 * `9304 V2.jpeg` son dos archivos y **una sola** pieza.
 *
 * Durante un tiempo la pieza se guardó con el identificador de Drive de su
 * última vuelta, y eso tenía una consecuencia fea: al subir la V2, el
 * identificador cambiaba, y lo anotado —los cambios que pidió el cliente, la
 * historia, en qué ronda iba— quedaba guardado bajo un nombre que ya nadie
 * preguntaba. No se perdía; dejaba de encontrarse. Y pasaba justo cuando el
 * diseñador estaba trabajando esos cambios.
 *
 * La identidad es la carpeta más el nombre sin el sufijo de versión, que es
 * exactamente lo que ya define una pieza cuando se agrupan las vueltas. No se
 * inventa nada nuevo: se nombra lo que ya estaba.
 *
 * Los dos puntos separan porque un identificador de Drive no los tiene, así
 * que no hay forma de que una carpeta y un nombre se confundan con otro par.
 */
export function identidadDePieza(carpetaId: string, nombreDelArchivo: string): string {
  return `${carpetaId}::${leerNombre(nombreDelArchivo).base}`;
}

/**
 * Las piezas de una carpeta, cada una con los archivos de Drive que la forman.
 *
 * Es lo que hay que pasarle a `estadosDe`, y existe como una sola función
 * porque el cálculo tiene dos mitades que **tienen que coincidir**: el nombre
 * de la pieza sale de su primera vuelta, y los archivos son todas. Escrito
 * seis veces —una por pantalla—, la séptima se olvida de una mitad, y esa
 * mitad es la que decide si una pieza vuelve a empezar.
 */
export function conSusArchivos<T extends ConNombre & { id: string }>(
  carpetaId: string,
  agrupadas: Array<Agrupado<T>>
): Array<{ id: string; archivos: string[] }> {
  return agrupadas.map((p) => ({
    id: identidadDePieza(carpetaId, p.versiones[0].archivo.name),
    archivos: p.versiones.map((v) => v.archivo.id),
  }));
}
