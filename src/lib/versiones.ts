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
 * **Lo que protege el nombre no es el separador, es que no siga un dígito.**
 * Pedía un separador —espacio, guion o guion bajo— y con eso `V2banner.pdf`,
 * escrito por alguien apurado, quedaba como una pieza aparte. Lo que había que
 * evitar era comerse un año: `V2025 balance` no puede ser la versión 202 de
 * «5 balance». Eso lo resuelve `(?!\d)`, que exige que el número termine ahí.
 */
const PREFIJO = /^v\s*(\d{1,3})(?!\d)[ _-]*/i;

export type NombreDeArchivo = {
  /** Lo que identifica a la pieza: el nombre sin el sufijo, con extensión. */
  base: string;
  /** Qué vuelta es. Sin sufijo, es la primera. */
  version: number;
  /** El nombre lindo para mostrar, sin el sufijo ni la extensión. */
  titulo: string;
  /**
   * Si el nombre lleva escrita una marca de versión.
   *
   * **No es lo mismo que `version > 1`.** «stickers.pdf» es la vuelta uno
   * porque no dice nada, y «V1_stickers.pdf» también es la uno, pero lo dice.
   * Esa diferencia decide si el archivo puede sumarse a una pieza de otra
   * extensión: escribir el número es la única señal de intención que hay.
   */
  marcado: boolean;
};

/**
 * Lo que tiene pinta de extensión: letras y números, sin espacios, con al
 * menos una letra. «.09» (una fecha en un Google Doc) o «. Corrientes» no lo
 * son.
 */
const PARECE_EXTENSION = /^\.[a-z0-9]*[a-z][a-z0-9]*$/i;

/** Si lo que sigue al último punto no parece extensión, es parte del título. */
function colaQueNoEsExtension(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  if (punto <= 0) return "";
  const cola = nombre.slice(punto);
  return PARECE_EXTENSION.test(cola) ? "" : cola;
}

export function leerNombre(nombre: string): NombreDeArchivo {
  const punto = nombre.lastIndexOf(".");
  // Un punto al principio no es una extensión, es un archivo oculto.
  const hayExtension = punto > 0;
  const cuerpo = hayExtension ? nombre.slice(0, punto) : nombre;
  const extension = hayExtension ? nombre.slice(punto) : "";

  // **La base se sigue calculando con el último punto, parezca extensión o
  // no.** Es la identidad de la pieza, y cambiarla ahora haría que lo anotado
  // bajo «Informe.1» deje de encontrarse. Lo que se corrige es solo el título:
  // en «Acta 12.09» el título era «Acta 12», igual para todas las actas del
  // mes, y eso las hacía pasar por un renombre partido que «unir» juntaba.
  const cola = colaQueNoEsExtension(nombre);

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
  //
  // **Y «V0» tampoco es una versión.** La primera vuelta es la V1 —el archivo
  // sin marca— así que un cero no numera nada: es parte del nombre. Sin esto,
  // el cliente veía «V0 › V999 › Final» en su camino, dos números que no
  // existen en el vocabulario de nadie. Se deja como está escrito, que se ve y
  // se corrige renombrando.
  if (marca && (limpio.trim() === "" || Number(marca[1]) === 0)) {
    return { base: nombre, version: 1, titulo: cuerpo + cola, marcado: false };
  }

  return {
    base: limpio + extension,
    version: marca ? Number(marca[1]) : 1,
    // Con la marca atrás el número se leyó antes del punto —«Informe v2.1»—,
    // y lo que sigue es ambiguo: se deja el título como siempre.
    titulo: limpio + (atras ? "" : cola),
    marcado: Boolean(marca),
  };
}

/**
 * Cómo tiene que llamarse un archivo para ser una vuelta de otra pieza.
 *
 * **Es el arreglo del renombre que parte un trabajo en dos.** Un trabajo se
 * arma juntando los archivos que, después de la marca de versión, dicen lo
 * mismo: sacarle la marca a uno —«V4_stickers.jpeg» → «stickers.jpeg»— lo saca
 * del grupo y funda otro trabajo. La aplicación no muda lo anotado de un lado
 * al otro, que sería lo más delicado que podría hacer; le devuelve la marca al
 * archivo, que es de donde salió el problema, y el grupo se rehace solo.
 *
 * Conserva la extensión del archivo: una vuelta puede estar en otro formato
 * —un JPG para mirar rápido, el PDF para imprenta— y eso es válido.
 */
export function comoVueltaDe(
  nombreDelArchivo: string,
  /** Cómo se llama la pieza a la que se suma, sin marca ni extensión. */
  titulo: string,
  /** Qué número de vuelta le toca. */
  version: number
): string {
  const punto = nombreDelArchivo.lastIndexOf(".");
  // Un Doc «Acta 12.09» no tiene extensión: repetir «.09» al final daría
  // «Acta 12.09.09», que ya es otro nombre.
  const extension =
    punto > 0 && !colaQueNoEsExtension(nombreDelArchivo) ? nombreDelArchivo.slice(punto) : "";

  const adelante = `V${version}_${titulo}${extension}`;

  // **Lo escrito tiene que volver a leerse como esa vuelta de esa pieza**, o
  // unir contesta que sí y el trabajo sigue partido. La marca adelante se come
  // los separadores que la siguen, así que con «_portada» saldría
  // «V2__portada», que se lee como «portada». En ese caso se escribe atrás,
  // donde el separador del título no se toca. Si la de adelante se lee bien,
  // que es lo de siempre, se deja esa: no cambia nada de lo que ya andaba.
  const seLeeBien = (nombre: string) => {
    const leido = leerNombre(nombre);
    return leido.titulo === titulo && leido.version === version && leido.marcado;
  };
  if (seLeeBien(adelante)) return adelante;

  const atras = `${titulo}_V${version}${extension}`;
  return seLeeBien(atras) ? atras : adelante;
}

export type ConNombre = { name: string };

export type Agrupado<T> = {
  /** El nombre de la pieza, sin sufijo ni extensión. */
  titulo: string;
  /**
   * Cómo se identifica la pieza: el nombre de su vuelta **más baja**.
   *
   * Sale de acá y no se vuelve a calcular afuera, porque **cuál archivo manda
   * dejó de ser obvio**: una pieza puede tener vueltas de distinta extensión,
   * y calcularlo en dos lados es como un día una pantalla pregunta por
   * «stickers.pdf» y la otra por «stickers.jpeg».
   *
   * **La más baja y no la que llegó primero.** Si dependiera del orden en que
   * Drive devuelve los archivos, la identidad de una pieza podría cambiar sola
   * al subir una vuelta nueva —Drive ordena por nombre— y con ella se perdería
   * de vista todo lo anotado: la historia, las rondas, lo que pidió el
   * cliente. No se borraría; dejaría de encontrarse, que es peor.
   */
  base: string;
  /** De la más vieja a la más nueva. La última es la que se está mirando. */
  versiones: Array<{ numero: number; archivo: T }>;
  /**
   * Hay otra pieza en la carpeta que se llama igual y está en otro formato.
   *
   * **Casi siempre es un renombre que salió mal.** Un trabajo se arma juntando
   * los archivos que después de la marca de versión dicen lo mismo, así que
   * sacarle la marca a uno —«V4_stickers.jpeg» → «stickers.jpeg»— lo saca del
   * grupo y funda otro. Lo anotado se queda con el grupo que conservó el
   * nombre, aunque sea el que tiene menos archivos, y el cliente puede
   * terminar mirando un archivo distinto del que estaba revisando.
   *
   * La aplicación **no lo arregla sola**: mudar lo anotado de un trabajo a
   * otro es lo más delicado que tiene, y un renombre raro podría llevarse una
   * historia a un lugar inesperado. Lo dice, y lo arregla una persona
   * renombrando, que es de donde salió.
   */
  comparteNombre: boolean;
};

/**
 * Junta los archivos de una carpeta en piezas, agrupando las versiones.
 *
 * **La marca de versión manda sobre la extensión.** «V3_stickers.jpeg» es la
 * tercera vuelta de «stickers.pdf», aunque cambie el formato: el diseñador
 * exporta en lo que le sirve para esa vuelta —un JPG para mirar rápido, el PDF
 * para imprenta— y escribir «V3» adelante es decir, explícitamente, que eso es
 * una vuelta de aquello. Antes la extensión partía la pieza en dos, y el
 * resultado era el peor posible: la vuelta nueva se guardaba **en otro lado**,
 * la pantalla seguía mostrando la vieja, y nada decía por qué.
 *
 * **Sin marca, la extensión sigue contando.** «stickers.pdf» y «stickers.jpg»,
 * los dos sin número, son dos piezas: es el mismo trabajo entregado en dos
 * formatos —uno para mirar, otro para imprimir— y juntarlos sería mentir sobre
 * qué se está aprobando. La diferencia entre los dos casos es que en uno
 * alguien escribió un número y en el otro no, y eso no es una casualidad del
 * nombre: es la única señal de intención que hay.
 *
 * Conserva el orden en que llegaron los archivos —Drive los devuelve por
 * nombre—, tomando el lugar de la primera versión de cada pieza. Así la lista
 * no se reordena sola cuando alguien sube una vuelta nueva.
 */
export function agruparVersiones<T extends ConNombre>(
  archivos: T[],
  /**
   * Los archivos cuya marca de versión es parte del nombre, por su id: alguien
   * dijo que «Hario V60.jpg» es un trabajo y no la vuelta 60 de «Hario». Se
   * leen enteros, como un archivo sin marca.
   */
  enteros: ReadonlySet<string> = new Set()
): Array<Agrupado<T>> {
  type Leido = { archivo: T; base: string; titulo: string; version: number; marcado: boolean };

  const leidos: Leido[] = archivos.map((archivo) => {
    const id = (archivo as { id?: string }).id;
    const { base, version, titulo, marcado } =
      id !== undefined && enteros.has(id) ? leerEntero(archivo.name) : leerNombre(archivo.name);
    return { archivo, base, titulo, version, marcado };
  });

  // **Las mayúsculas no parten una pieza.** «banner dia del padre.pdf» y
  // «V2 Banner Dia Del Padre.pdf» son lo mismo escrito por dos personas, y
  // separarlos le mostraba al cliente dos trabajos donde hay uno, sin poder
  // comparar. Se agrupa sin distinguir caja; el nombre que se muestra sigue
  // siendo el de la primera vuelta, tal como lo escribieron.
  //
  // **Tampoco la forma en que se escribió una tilde.** Algunas subidas desde
  // macOS guardan «ñ» como «n» más la tilde suelta (NFD): se ve igual y daba
  // otra clave, así que la pieza se partía en dos sin ningún aviso. Se
  // normaliza solo para comparar; `base` y `titulo` quedan como vinieron,
  // porque son la identidad de piezas que ya tienen cosas anotadas.
  const clave = (s: string) => s.normalize("NFC").toLowerCase();

  const porBase = new Map<string, Agrupado<T>>();
  const orden: string[] = [];

  const abrir = (suya: string, leido: Leido) => {
    porBase.set(suya, {
      titulo: leido.titulo,
      base: leido.base,
      versiones: [],
      comparteNombre: false,
    });
    orden.push(suya);
  };

  // Primero las que no llevan marca: son las que fundan una pieza y le dan su
  // nombre. Recién después se reparten las marcadas, que necesitan saber qué
  // piezas existen para elegir a cuál sumarse.
  for (const leido of leidos.filter((l) => !l.marcado)) {
    const suya = clave(leido.base);
    if (!porBase.has(suya)) abrir(suya, leido);
    porBase.get(suya)!.versiones.push({ numero: leido.version, archivo: leido.archivo });
  }

  for (const leido of leidos.filter((l) => l.marcado)) {
    const mismoNombre = orden.filter(
      (otra) => clave(porBase.get(otra)!.titulo) === clave(leido.titulo)
    );

    // Su propia extensión primero; si no hay ninguna con ese nombre todavía,
    // funda la suya; si hay una sola, se suma a esa aunque cambie el formato;
    // si hay varias y ninguna es la suya, **no adivina**: con «stickers.pdf» y
    // «stickers.jpg» al lado, sumar «V3_stickers.png» a una de las dos sería
    // elegir por el usuario, y elegir mal significa guardar la vuelta nueva
    // debajo del trabajo equivocado.
    const propia = clave(leido.base);
    const elegida =
      porBase.has(propia) && mismoNombre.includes(propia)
        ? propia
        : mismoNombre.length === 1
          ? mismoNombre[0]
          : propia;

    if (!porBase.has(elegida)) abrir(elegida, leido);
    porBase.get(elegida)!.versiones.push({ numero: leido.version, archivo: leido.archivo });
  }

  for (const pieza of porBase.values()) {
    // Dos archivos pueden reclamar el mismo número —«9304.jpeg» y
    // «9304 V1.jpeg»—. Se ordena de forma estable para que el resultado no
    // dependa del orden en que Drive los devolvió.
    pieza.versiones.sort((a, b) => a.numero - b.numero);

    // Y recién acá se fija la identidad: la de la vuelta más baja, que es la
    // misma cualquiera sea el orden en que llegaron los archivos.
    const primera = pieza.versiones[0].archivo;
    const id = (primera as { id?: string }).id;
    pieza.base = (id !== undefined && enteros.has(id) ? leerEntero : leerNombre)(primera.name).base;
  }

  // Dos piezas con el mismo nombre y distinto formato son casi siempre un
  // renombre que partió un trabajo en dos. Se marcan las dos: desde afuera no
  // se puede decir cuál es «la buena».
  const cuantasConEseNombre = new Map<string, number>();
  for (const pieza of porBase.values()) {
    const suyo = clave(pieza.titulo);
    cuantasConEseNombre.set(suyo, (cuantasConEseNombre.get(suyo) ?? 0) + 1);
  }
  for (const pieza of porBase.values()) {
    pieza.comparteNombre = (cuantasConEseNombre.get(clave(pieza.titulo)) ?? 0) > 1;
  }

  return orden.map((clave) => porBase.get(clave)!);
}

/** Un nombre leído entero: la marca que tenga es parte del nombre. */
function leerEntero(nombre: string): NombreDeArchivo {
  const punto = nombre.lastIndexOf(".");
  const conExtension = punto > 0 && !colaQueNoEsExtension(nombre);
  return {
    base: nombre,
    version: 1,
    titulo: conExtension ? nombre.slice(0, punto) : nombre,
    marcado: false,
  };
}

/**
 * Un archivo que dice ser una vuelta —V2, V3 o más— de algún trabajo.
 *
 * **Estos no se suman solos a nada.** Que el nombre coincida es una pista, no
 * una decisión: «V2 logo final.jpg» puede ser la vuelta dos de «logo», y
 * «Hario V60.jpg» no es la vuelta sesenta de nadie. Espera a que alguien de la
 * agencia diga de qué trabajo es, y desde ahí se le sigue el rastro por su id,
 * aunque después lo renombren.
 */
export function esVueltaSuelta(nombre: string): boolean {
  const leido = leerNombre(nombre);
  return leido.marcado && leido.version > 1;
}

/**
 * De qué trabajo es una vuelta, según lo que decidió una persona.
 *
 * - `pieza`: el nombre del trabajo (su identidad, sin la carpeta) cuando se
 *   decidió. `raices`: los archivos que tenía ese trabajo entonces. Se busca
 *   primero por los archivos —sobrevive a que alguien renombre la V1— y si ya
 *   no está ninguno, por el nombre.
 * - `version`: qué vuelta es. Sin ella, la que dice el nombre.
 * - `pieza: null`: no es una vuelta de nada; la marca es parte del nombre y el
 *   archivo es un trabajo propio.
 */
export type Asignacion =
  | { pieza: string; raices: string[]; version?: number }
  | { pieza: null };

/** Una vuelta que nadie asignó todavía, con el trabajo que sugiere su nombre. */
export type Pendiente<T> = {
  archivo: T;
  /** El número que dice el nombre. */
  numero: number;
  /** La identidad del trabajo con el que coincide el nombre, si alguno. */
  sugerida?: string;
};

/**
 * Los trabajos de una carpeta, con las vueltas donde alguien las puso.
 *
 * Los archivos sin marca —y los que dicen V1— fundan trabajos, como siempre.
 * Las vueltas (V2 o más) van al trabajo que se les asignó; las que nadie
 * asignó quedan **pendientes**: no son parte de ningún trabajo, no se
 * entregan y el cliente no las ve, hasta que alguien diga de cuál son.
 *
 * Un archivo sin marca también puede estar asignado a otro trabajo: es lo que
 * hace «Es el mismo trabajo: unirlos» con «stickers.jpeg» al lado de
 * «stickers.pdf». Lo asignado manda sobre lo que diga el nombre.
 */
export function armarTrabajos<T extends ConNombre & { id: string }>(
  archivos: T[],
  asignaciones: ReadonlyMap<string, Asignacion>
): { agrupadas: Array<Agrupado<T>>; pendientes: Array<Pendiente<T>> } {
  const enteros = new Set(
    archivos
      .filter((a) => esVueltaSuelta(a.name) && asignaciones.get(a.id)?.pieza === null)
      .map((a) => a.id)
  );
  const vueltas = archivos.filter(
    (a) =>
      typeof asignaciones.get(a.id)?.pieza === "string" ||
      (esVueltaSuelta(a.name) && !enteros.has(a.id))
  );
  const agrupadas = agruparVersiones(
    archivos.filter((a) => !vueltas.includes(a)),
    enteros
  );

  const clave = (s: string) => s.normalize("NFC").toLowerCase();
  // Lo que diría el nombre solo: es la sugerida de cada pendiente.
  const porNombre = agruparVersiones(archivos);
  const pendientes: Array<Pendiente<T>> = [];
  const tocadas = new Set<Agrupado<T>>();

  for (const archivo of vueltas) {
    const asignada = asignaciones.get(archivo.id);
    const numero = leerNombre(archivo.name).version;

    if (!asignada || asignada.pieza === null) {
      const grupo = porNombre.find((g) => g.versiones.some((v) => v.archivo.id === archivo.id));
      const sugerida = grupo
        ? agrupadas.find((p) =>
            p.versiones.some((v) => grupo.versiones.some((g) => g.archivo.id === v.archivo.id))
          )
        : undefined;
      pendientes.push({ archivo, numero, sugerida: sugerida?.base });
      continue;
    }

    let destino =
      agrupadas.find((p) => p.versiones.some((v) => asignada.raices.includes(v.archivo.id))) ??
      agrupadas.find((p) => clave(p.base) === clave(asignada.pieza));
    // **El trabajo sigue existiendo aunque ya no quede su V1.** Borraron el
    // original y quedó la V2: sigue siendo la V2 de «logo», con todo lo que
    // tenía anotado, y no un trabajo nuevo que arranca de cero.
    if (!destino) {
      destino = {
        titulo: leerNombre(asignada.pieza).titulo,
        base: asignada.pieza,
        versiones: [],
        comparteNombre: false,
      };
      agrupadas.push(destino);
    }
    destino.versiones.push({ numero: asignada.version ?? numero, archivo });
    tocadas.add(destino);
  }

  for (const pieza of tocadas) pieza.versiones.sort((a, b) => a.numero - b.numero);
  return { agrupadas, pendientes };
}

/**
 * Las vueltas que el cliente puede ver: **hasta la que se le entregó**.
 *
 * Entregar es lo que decide qué ve el cliente. Si el equipo sube la V3
 * mientras el cliente revisa la V2, la V3 no aparece hasta que alguien la
 * entregue.
 *
 * **Primero por el archivo, después por el número.** El número sale del
 * nombre, y dos archivos pueden decir el mismo —«9304.jpeg» y «9304 V1.jpeg»,
 * o una V2 vuelta a subir—: con el número solo, el que se mostraba podía ser
 * uno que nadie entregó. Si se sabe cuál archivo se entregó y sigue ahí, se
 * muestra ese y lo anterior. Las piezas entregadas antes de que eso se
 * guardara, o cuyo archivo ya no está, siguen yendo por el número.
 *
 * Puede devolver una lista vacía —la entregada ya no está y todo lo que queda
 * es más nuevo—; qué hacer entonces lo decide quien pregunta.
 */
export function hastaLoEntregado<T extends { id: string }>(
  versiones: Array<{ numero: number; archivo: T }>,
  entregado: { version?: number; archivo?: string }
): Array<{ numero: number; archivo: T }> {
  const exacta = entregado.archivo
    ? versiones.find((v) => v.archivo.id === entregado.archivo)
    : undefined;
  if (exacta) return versiones.filter((v) => v === exacta || v.numero < exacta.numero);
  if (entregado.version === undefined) return versiones;
  return versiones.filter((v) => v.numero <= entregado.version!);
}

/**
 * Lo raro en los nombres de una pieza: lo que conviene mirar antes de entregar.
 *
 * **La aplicación entiende las vueltas por el nombre, y no adivina.** Eso la
 * hace predecible, y también quiere decir que un nombre escrito de otra forma
 * cambia lo que se muestra sin que nadie lo note. Esto no corrige nada —el
 * nombre es lo que manda, y cambiar cómo se lee movería piezas que ya tienen
 * cosas anotadas—: dice lo que leyó, para que lo arregle quien nombra.
 *
 *   - **Vuelta repetida**: dos archivos dicen ser la misma vuelta. Uno solo
 *     es el que se muestra y se entrega, y cuál depende del orden.
 *   - **Salto**: la pieza arranca en la V3 o más, o pasa de la V1 a la V4. A
 *     veces es que borraron las anteriores; otras, que el número es parte
 *     del nombre —«Hario V60», «V4x4 camioneta»— y se leyó como una vuelta.
 */
export type RarezasDeNombres = {
  repetida?: { numero: number; nombres: string[]; tomada: string };
  salto?: { desde: number | null; hasta: number; nombre: string };
};

/** Desde cuánto un salto de números deja de ser un descuido y pide mirarlo. */
const SALTO_RARO = 3;

export function rarezasDeNombres(
  versiones: Array<{ numero: number; archivo: ConNombre }>
): RarezasDeNombres {
  const salida: RarezasDeNombres = {};

  for (let i = 0; i < versiones.length && !salida.repetida; i++) {
    const iguales = versiones.filter((v) => v.numero === versiones[i].numero);
    if (iguales.length > 1) {
      salida.repetida = {
        numero: versiones[i].numero,
        nombres: iguales.map((v) => v.archivo.name),
        // Vienen ordenadas por número y, a igual número, de forma estable: la
        // que queda última es la que la aplicación toma como esa vuelta.
        tomada: iguales[iguales.length - 1].archivo.name,
      };
    }
  }

  const primera = versiones[0];
  if (primera && primera.numero >= SALTO_RARO) {
    salida.salto = { desde: null, hasta: primera.numero, nombre: primera.archivo.name };
  } else {
    for (let i = 1; i < versiones.length; i++) {
      if (versiones[i].numero - versiones[i - 1].numero >= SALTO_RARO) {
        salida.salto = {
          desde: versiones[i - 1].numero,
          hasta: versiones[i].numero,
          nombre: versiones[i].archivo.name,
        };
        break;
      }
    }
  }

  return salida;
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
 * Cómo se llama la pieza que lleva ese identificador.
 *
 * Es la vuelta de `identidadDePieza`, y está acá al lado por eso: son las dos
 * mitades de la misma decisión, y separadas es donde un día una parte por los
 * dos puntos y la otra por otra cosa.
 *
 * Se parte por los **primeros** dos puntos: el identificador de Drive no los
 * tiene, así que lo que venga después es el nombre entero, tenga los que tenga.
 */
export function nombreDePieza(id: string): string {
  const corte = id.indexOf("::");
  return corte === -1 ? id : id.slice(corte + 2);
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
export function conSusArchivos<
  T extends ConNombre & { id: string; modifiedTime?: string },
>(
  carpetaId: string,
  agrupadas: Array<Agrupado<T>>
): Array<{ id: string; archivos: string[]; masVieja?: string; version: number }> {
  return agrupadas.map((p) => {
    const fechas = p.versiones
      .map((v) => v.archivo.modifiedTime)
      .filter((f): f is string => Boolean(f));

    return {
      // La identidad la decide el agrupador y no el nombre del primer archivo:
      // desde que una pieza puede tener vueltas de distinta extensión, «el
      // nombre del primero» y «el nombre de la pieza» dejaron de ser lo mismo.
      id: `${carpetaId}::${p.base}`,
      archivos: p.versiones.map((v) => v.archivo.id),
      // En qué vuelta va, según el nombre del archivo más alto. Sale de acá
      // porque es donde ya está resuelto cuál es «el último»: calcularlo de
      // nuevo en cada pantalla es como se separan dos respuestas.
      version: p.versiones[p.versiones.length - 1]?.numero ?? 1,
      // **Desde cuándo existe algo de esta pieza.** Sirve para una sola
      // pregunta, y es importante: ¿puede lo anotado ser de estos archivos?
      // Un trabajo no pudo entregarse antes de que existiera el archivo que se
      // entregó.
      masVieja: fechas.length > 0 ? fechas.sort()[0] : undefined,
    };
  });
}
