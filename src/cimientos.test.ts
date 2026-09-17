// Los cimientos: las reglas que no se ven en ninguna pantalla.
//
// Cada prueba de este archivo existe porque **algo se rompió de esa manera**, y
// arreglarlo una vez no alcanza: mientras la forma equivocada siga siendo
// posible, se vuelve a hacer. Acá está anotado qué pasó en cada caso.
//
// Son pruebas toscas —leen los archivos como texto, preguntan cosas simples— y
// eso es a propósito: una regla lista se le escapa el caso raro, que es
// justamente el que rompe.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const FUENTE = path.join(RAIZ, "src");

function archivosBajo(carpeta: string, extensiones = /\.(ts|tsx)$/): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(carpeta)) {
    const completo = path.join(carpeta, entrada);
    if (statSync(completo).isDirectory()) salida.push(...archivosBajo(completo, extensiones));
    else if (extensiones.test(entrada)) salida.push(completo);
  }
  return salida;
}

const TODOS = archivosBajo(FUENTE);
const SIN_PRUEBAS = TODOS.filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));
const relativo = (f: string) => path.relative(RAIZ, f).replace(/\\/g, "/");

// ---------------------------------------------------------------------------

/**
 * Resuelve un import `@/loquesea` al archivo real.
 *
 * Prueba las cuatro formas en que puede estar escrito en disco. Devuelve
 * `null` para lo que no es nuestro —`react`, `node:fs`, `next/link`—.
 */
function resolver(especificador: string): string | null {
  if (!especificador.startsWith("@/")) return null;
  const base = path.join(FUENTE, especificador.slice(2));
  for (const intento of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    try {
      if (statSync(intento).isFile()) return intento;
    } catch {}
  }
  return null;
}

/** Lo que un archivo importa **de verdad**, sin contar los tipos. */
function importaDe(archivo: string): { modulos: string[]; deNode: boolean } {
  const texto = readFileSync(archivo, "utf8");
  const modulos: string[] = [];
  let deNode = false;

  // `import ... from "x"` y `import "x"`, en una o varias líneas.
  for (const m of texto.matchAll(/import\s+([\s\S]*?)from\s+["']([^"']+)["']/g)) {
    const especificadores = m[1];
    const modulo = m[2];

    if (modulo.startsWith("node:")) {
      deNode = true;
      continue;
    }

    // Un import de tipos desaparece al compilar: no arrastra nada al paquete
    // del navegador. `import type {...}` y `{ type A, type B }` cuentan igual.
    const soloTipos =
      /^\s*type\s/.test(especificadores) ||
      (especificadores.includes("{") &&
        especificadores
          .replace(/[\s\S]*\{([\s\S]*)\}[\s\S]*/, "$1")
          .split(",")
          .filter((x) => x.trim())
          .every((x) => x.trim().startsWith("type ")));

    if (!soloTipos) modulos.push(modulo);
  }

  return { modulos, deNode };
}

const esCliente = (archivo: string) =>
  /^\s*["']use client["']/.test(readFileSync(archivo, "utf8"));
const esServidor = (archivo: string) =>
  /^\s*["']use server["']/.test(readFileSync(archivo, "utf8"));

// ---------------------------------------------------------------------------

describe("nada del servidor llega al navegador", () => {
  /**
   * Pasó, y no fue barato: el desplegable de días importaba sus constantes de
   * `plazos.ts`, que lee y escribe archivos. Turbopack falló con «the chunking
   * context does not support external modules (request: node:fs/promises)» y
   * **se cayó la compilación entera**, con un mensaje que no nombra ni al
   * archivo culpable ni al que lo importó.
   *
   * El recorrido se corta en los archivos `"use server"`: una acción de
   * servidor importada desde el navegador no arrastra sus dependencias, Next
   * la reemplaza por una referencia.
   */
  it.each(TODOS.filter(esCliente).map(relativo))(
    "%s no alcanza ningún módulo que use node:",
    (relativoDelCliente) => {
      const inicio = path.join(RAIZ, relativoDelCliente);
      const vistos = new Set<string>([inicio]);
      const camino = new Map<string, string[]>([[inicio, [relativoDelCliente]]]);
      const pendientes = [inicio];

      while (pendientes.length > 0) {
        const actual = pendientes.shift()!;
        const { modulos, deNode } = importaDe(actual);

        expect(
          deNode ? camino.get(actual)!.join("  →  ") : null,
          "Esta cadena termina en un módulo que usa node:, y eso rompe la " +
            "compilación del navegador. Lo que una pantalla necesita saber va " +
            "en un módulo que no toque el servidor."
        ).toBeNull();

        for (const modulo of modulos) {
          const destino = resolver(modulo);
          if (!destino || vistos.has(destino)) continue;
          // Una acción de servidor es una puerta, no una dependencia.
          if (esServidor(destino)) continue;
          vistos.add(destino);
          camino.set(destino, [...camino.get(actual)!, relativo(destino)]);
          pendientes.push(destino);
        }
      }
    }
  );
});

describe("ningún archivo del proyecto queda invisible para git", () => {
  /**
   * Pasó: una regla `datos/` sin anclar tapó también `src/admin/datos` y
   * `src/portal/datos`, que son código fuente. Un archivo se creó y **nunca se
   * commiteó**, sin error ni aviso: `git status` simplemente no lo mostraba.
   */
  it("no hay fuentes ignoradas por .gitignore", () => {
    const rutas = SIN_PRUEBAS.map(relativo);
    let ignorados: string[] = [];
    try {
      // `--no-index` es lo que hace que esto sirva: sin él, `check-ignore`
      // saltea los archivos que ya están rastreados y la regla mala pasa
      // desapercibida hasta que alguien crea un archivo nuevo ahí.
      // Devuelve 1 cuando no ignora ninguno: eso es lo bueno.
      const salida = execFileSync("git", ["check-ignore", "--no-index", "--", ...rutas], {
        cwd: RAIZ,
        encoding: "utf8",
      });
      ignorados = salida.split("\n").filter(Boolean);
    } catch {
      ignorados = [];
    }

    expect(
      ignorados,
      "Estos archivos existen pero git no los ve, así que no se commitean y " +
        "nadie se entera. Suele ser una regla de .gitignore sin anclar: " +
        "`datos/` tapa cualquier carpeta con ese nombre, `/datos/` solo la raíz."
    ).toEqual([]);
  });
});

describe("las acciones del portal no reciben de quién son", () => {
  /**
   * Pasó: `moverPieza(clienteId, ...)` recibía el cliente del navegador y le
   * creía. Un pedido armado a mano podía aprobar la pieza de un cliente
   * diciendo ser otro, y el archivo terminaba en las «Entregas finales» del
   * otro.
   *
   * De afuera se acepta la referencia mínima —esta carpeta, esta pieza— y todo
   * lo demás se deduce en el servidor.
   */
  it("ninguna acción del portal toma un clienteId", () => {
    const texto = readFileSync(path.join(FUENTE, "portal", "acciones.ts"), "utf8");
    const culpables: string[] = [];

    for (const m of texto.matchAll(/export async function (\w+)\(([\s\S]*?)\)\s*:/g)) {
      if (/\bclienteId\s*:/.test(m[2])) culpables.push(m[1]);
    }

    expect(
      culpables,
      "Estas acciones reciben el cliente del navegador. Se deduce de la " +
        "carpeta con clienteDeCarpeta(), que no se puede falsear."
    ).toEqual([]);
  });
});

describe("las cabeceras de seguridad siguen puestas", () => {
  /**
   * Se agregaron después de sondear la aplicación y encontrar que no había
   * ninguna. Sin una prueba, desaparecen el día que alguien reordene el
   * archivo de configuración y nadie lo note hasta que sea tarde.
   */
  const config = readFileSync(path.join(RAIZ, "next.config.ts"), "utf8");

  it.each([
    ["frame-ancestors", "que la aplicación no se pueda meter en un iframe ajeno"],
    ["Referrer-Policy", "que la dirección con el link del cliente no viaje a otros sitios"],
    ["X-Content-Type-Options", "que el navegador no adivine el tipo de un archivo"],
    ["base-uri", "que nadie pueda cambiar de dónde cuelgan las direcciones relativas"],
    ["form-action", "que un formulario no se pueda mandar a otro servidor"],
  ])("%s sigue configurada", (cabecera) => {
    expect(config).toContain(cabecera);
  });
});

describe("no hay caracteres de control escondidos en el fuente", () => {
  /**
   * Pasó dos veces, y las dos por la misma razón: escribir archivos con
   * secuencias de escape que la herramienta del medio interpretó. Una vez
   * `\n` quedó como salto real y dejó una función sin hacer nada; otra, `\a`
   * se convirtió en el carácter 7 y dejó `datos\ajustes.json` escrito como
   * `datos␇justes.json`.
   *
   * Son invisibles al leer el archivo. Esta prueba los ve.
   */
  // Se arma desde un texto con escapes y no se escribe tal cual: escrita,
  // la clase sería invisible en el fuente y cualquier herramienta que toque
  // el archivo se la podría comer. Es exactamente lo que se está probando.
  const CONTROL = new RegExp("[\u0000-\u0008\u000b\u000c\u000e-\u001f]");

  const revisables = [
    ...SIN_PRUEBAS,
    ...archivosBajo(path.join(FUENTE, "app"), /\.css$/),
    path.join(RAIZ, "COMO-USAR.md"),
    path.join(RAIZ, "DECISIONES.md"),
    path.join(RAIZ, "PREPARAR-DRIVE.md"),
  ];

  it("ningún archivo tiene uno", () => {
    const culpables = revisables
      .filter((f) => CONTROL.test(readFileSync(f, "utf8")))
      .map(relativo);

    expect(
      culpables,
      "Estos archivos tienen caracteres de control invisibles. Suele ser una " +
        "secuencia de escape que se interpretó al escribir el archivo."
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

/**
 * Las mismas fronteras que vigila ESLint, revisadas leyendo el texto.
 *
 * Está repetido a propósito. `no-restricted-imports` **no se suma** entre
 * bloques de configuración: para un archivo que cae en dos, gana el último y
 * el primero desaparece sin decir nada. Eso ya pasó —la regla de Drive dejó
 * muda a la frontera portal↔administración— y no se notó, porque el guardián
 * seguía ahí, en verde, sin revisar nada.
 *
 * Esta prueba no sabe de configuraciones ni de precedencias: abre los archivos
 * y busca el texto. Es tosca, y esa es la idea.
 */
describe("las fronteras, revisadas a mano", () => {
  const bajo = (carpeta: string) =>
    SIN_PRUEBAS.filter((f) => relativo(f).startsWith(carpeta));

  const importa = (texto: string, expresion: RegExp) =>
    texto.split("\n").some((linea) => expresion.test(linea));

  it("el portal no importa nada de administración", () => {
    const culpables = [...bajo("src/portal/"), ...bajo("src/app/(portal)/")]
      .filter((f) => importa(readFileSync(f, "utf8"), /from\s+["'](@\/admin|.*\/admin\/)/))
      .map(relativo);

    expect(
      culpables,
      "Un descuido acá deja que una pantalla del portal lea datos de la agencia."
    ).toEqual([]);
  });

  it("administración no importa nada del portal", () => {
    const culpables = [...bajo("src/admin/"), ...bajo("src/app/(admin)/")]
      .filter((f) => importa(readFileSync(f, "utf8"), /from\s+["'](@\/portal|.*\/portal\/)/))
      .map(relativo);

    expect(culpables).toEqual([]);
  });

  it("solo el almacén toca el disco", () => {
    const permitidos = ["src/lib/almacen/"];
    const culpables = SIN_PRUEBAS.filter(
      (f) =>
        !permitidos.some((p) => relativo(f).startsWith(p)) &&
        importa(readFileSync(f, "utf8"), /from\s+["']node:fs/)
    ).map(relativo);

    expect(
      culpables,
      "Escribir archivos a mano no funciona en internet: en Netlify el disco " +
        "es de solo lectura y se borra en cada despliegue. Todo lo que se " +
        "guarda pasa por coleccion() o documento() de @/lib/almacen, que es " +
        "lo único que hay que cambiar para mudarse a Supabase."
    ).toEqual([]);
  });

  it("nadie le pregunta a Drive en crudo, salvo quien envuelve la respuesta", () => {
    const permitidos = ["src/lib/piezas.ts", "src/lib/google.ts"];
    const culpables = SIN_PRUEBAS.filter((f) => {
      if (permitidos.includes(relativo(f))) return false;
      const texto = readFileSync(f, "utf8");
      // El diagnóstico sí pregunta en crudo, y lo dice: muestra qué hay en
      // Drive, no qué piezas hay. Se anota con la excepción de ESLint al lado.
      if (texto.includes("eslint-disable-next-line no-restricted-imports")) return false;
      return importa(texto, /import\s*\{[^}]*\b(archivosDe|listarCarpeta)\b[^}]*\}\s*from/);
    }).map(relativo);

    expect(
      culpables,
      "archivosDe le pregunta a Drive, y Drive no lista las piezas que quedaron " +
        "fuera de su carpeta: las que se mudaron a «Entregas finales» cuando " +
        "aprobar las mudaba. La pregunta correcta es piezasDeLaCarpeta() de " +
        "@/lib/piezas."
    ).toEqual([]);
  });

  it("el dominio no depende de nada", () => {
    const culpables = bajo("src/dominio/")
      .filter((f) =>
        importa(readFileSync(f, "utf8"), /from\s+["'](@\/(lib|portal|admin)|node:)/)
      )
      .map(relativo);

    expect(
      culpables,
      "Si el dominio necesitara Drive o el almacén, dejaría de poder probarse " +
        "sin infraestructura, que es todo su valor."
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

/**
 * Que exista una puerta, y que nada la esquive.
 *
 * Estas pruebas nacen de tres agujeros que estuvieron abiertos a la vez y que
 * eran el mismo: **«quién entró» no existía como concepto**.
 *
 *   - `/gestion` no pedía nada. La contraseña cuidaba dos acciones sueltas y
 *     todo el resto —el árbol de clientes, los chats, el tablero— abría con
 *     escribir la dirección.
 *   - Las acciones del portal no leían la galleta de nadie. Con un
 *     identificador de carpeta de Drive se podía aprobar una pieza, mover el
 *     archivo, cerrar una revisión y escribir en el chat firmando como el
 *     cliente.
 *   - Los archivos y las miniaturas se servían a cualquiera, y un cliente se
 *     bajaba los de otro.
 *
 * Lo que los tres tienen en común: **una puerta que hay que acordarse de poner
 * es una puerta que alguna vez falta**. Por eso ahora la puerta está en un solo
 * lugar por mundo, y esto verifica que siga estando.
 */
describe("las puertas", () => {
  const leer = (relativo: string) => readFileSync(path.join(RAIZ, relativo), "utf8");

  it("el proxy marca gestión entera y el diagnóstico", () => {
    // Va en src/ y no en la raíz: la documentación de Next pide que quede al
    // mismo nivel que `app`, y acá `app` vive dentro de `src`. Puesto en la
    // raíz el archivo se ignora en silencio -- ninguna pantalla se protege y
    // nada avisa. Pasó, y por eso esta prueba nombra la ruta exacta.
    const proxy = leer("src/proxy.ts");

    // La puerta de gestión se sacó a pedido: adentro de la agencia era
    // fastidio y nada más. Lo que quedó es una marca de «este navegador es el
    // del equipo», y las rutas que sirven archivos la usan para saber quién
    // pide. Sin ella, gestión se queda sin miniaturas.
    for (const ruta of ['"/gestion"', '"/gestion/:path*"', '"/diagnostico"']) {
      expect(
        proxy,
        `El proxy no cubre ${ruta}, así que ahí no se marca el navegador del equipo.`
      ).toContain(ruta);
    }

    expect(
      proxy,
      "La marca se firma con la clave del equipo, no se inventa."
    ).toContain("valorDeGalletaDeGestion");
  });

  it("toda acción del portal pregunta quién entró", () => {
    const fuente = leer("src/portal/acciones.ts");

    // Se corta el archivo en bloques, uno por función exportada, y se revisa
    // cada bloque por separado: que el archivo mencione la comprobación en
    // algún lado no dice nada sobre la función que se agregó ayer.
    const partes = fuente.split(/^export async function /m).slice(1);
    expect(partes.length, "No encontré ninguna acción exportada.").toBeGreaterThan(0);

    const sinPuerta = partes
      .filter((bloque) => !bloque.includes("quienEntro("))
      .map((bloque) => bloque.slice(0, bloque.indexOf("(")));

    expect(
      sinPuerta,
      "Estas acciones del portal no verifican quién las llama. Una acción de " +
        "servidor es un endpoint público: que el navegador no dibuje el botón " +
        "no impide que alguien haga el pedido igual. Empezá por quienEntro()."
    ).toEqual([]);
  });

  it("ninguna ruta de API sirve datos sin saber quién pregunta", () => {
    const rutas = archivosBajo(path.join(FUENTE, "app", "api")).filter((f) =>
      f.endsWith("route.ts")
    );
    expect(rutas.length, "No encontré ninguna ruta de API.").toBeGreaterThan(0);

    const sinPuerta = rutas
      .filter((f) => {
        // Se sacan los imports antes de buscar. La primera versión de esta
        // prueba no lo hacía, y no atrapaba nada: al borrar la llamada, el
        // import quedaba y el nombre seguía apareciendo en el archivo. Se
        // descubrió rompiéndola a propósito, que es para lo que sirve hacerlo.
        const cuerpo = readFileSync(f, "utf8")
          .split("\n")
          .filter((linea) => !linea.trimStart().startsWith("import "))
          .join("\n");
        // Las tres formas de preguntar quién está del otro lado. `quienPide`
        // es la general —contesta «cliente», «agencia» o «nadie»—; las otras
        // dos son de cuando solo puede haber un cliente mirando.
        return !["quienPide(", "clienteQueEntro(", "entroAlCliente("].some((c) =>
          cuerpo.includes(c)
        );
      })
      .map(relativo);

    expect(
      sinPuerta,
      "Estas rutas devuelven datos sin comprobar la galleta del cliente. " +
        "Alcanzaba con conocer un identificador de Drive —que lo ve cualquiera " +
        "a quien le compartieron la carpeta— para bajarse el archivo sin haber " +
        "escrito nunca una clave."
    ).toEqual([]);
  });

  it("quién entró se decide en un solo lugar", () => {
    // Dos implementaciones de «quién es este» se separan con el tiempo, y la
    // que se quede vieja va a ser la que autoriza.
    const acceso = leer("src/lib/acceso.ts");
    expect(acceso).toContain("export async function clienteQueEntro");
    expect(
      acceso.slice(acceso.indexOf("export async function entroAlCliente")),
      "entroAlCliente tiene que apoyarse en clienteQueEntro, no repetirlo."
    ).toContain("clienteQueEntro(galletas)");
  });
});

// ---------------------------------------------------------------------------

/**
 * Quién hizo cada cosa sale de un solo lugar.
 *
 * Todavía no hay login, así que hoy todo queda firmado «El equipo». Lo que
 * importa es que **pase por `firmaDeAgencia()`**: el día que exista el login se
 * cambia esa función y todo queda firmado con el nombre de quien lo hizo, sin
 * tocar ninguna acción.
 *
 * Una acción que escriba el nombre a mano no se va a enterar de ese día. Y no
 * se nota mirando la pantalla: sigue diciendo «El equipo», que es exactamente
 * lo que decía antes.
 */
describe("las reglas del negocio no se escriben dos veces", () => {
  it("cuántas rondas entran lo dice el dominio y nadie más", () => {
    // Estuvo escrito en cinco lugares: las acciones de gestión, dos veces las
    // del portal, lo que el portal le muestra al cliente, y el dominio. El día
    // que se pueda poner por cliente —que es donde se negocia de verdad—
    // cambiar una y olvidar las otras deja al portal dejando pedir un cambio
    // que el servidor rechaza, o al revés. Y no se nota: no falla nada, le
    // falla al cliente.
    const culpables = SIN_PRUEBAS.filter((f) => {
      if (relativo(f) === "src/dominio/pieza.ts") return false;
      return readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
        .some(
          (l) =>
            /rondasIncluidas\s*[:=]\s*\d/.test(l) || /RONDAS_INCLUIDAS\s*=\s*\d/.test(l)
        );
    }).map(relativo);

    expect(
      culpables,
      "Estos archivos escriben a mano cuántas rondas entran. Tiene que salir de " +
        "RONDAS_INCLUIDAS_POR_DEFECTO en @/dominio/pieza, que es el único lugar " +
        "que va a cambiar el día que se negocie por cliente."
    ).toEqual([]);
  });
});

describe("quién hizo cada cosa", () => {
  it("ninguna acción escribe el autor a mano", () => {
    const culpables = SIN_PRUEBAS.filter((f) => {
      if (relativo(f) === "src/lib/sesion.ts") return false;
      const texto = readFileSync(f, "utf8");

      // Solo los archivos que **anotan** un autor. La primera versión miraba
      // todos, y atrapó el título «El equipo» de una pantalla: un guardián que
      // atrapa lo que no es enseña a ignorarlo.
      if (!/\banotar\(|\bagregarMensaje\(/.test(texto)) return false;

      // Las líneas de código, no los comentarios: el nombre aparece escrito en
      // varias explicaciones y ahí no hace daño.
      return texto
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
        .some((l) => /["'`]El equipo["'`]/.test(l));
    }).map(relativo);

    expect(
      culpables,
      "Estos archivos escriben el nombre del autor a mano. Tiene que salir de " +
        "firmaDeAgencia() en @/lib/sesion: es el único lugar que cambia el día " +
        "que exista el login, y lo que no pase por ahí va a quedar firmado mal."
    ).toEqual([]);
  });

  it("la sesión sigue siendo el único lugar que sabe quién es quién", () => {
    const sesion = readFileSync(path.join(FUENTE, "lib", "sesion.ts"), "utf8");
    expect(sesion).toContain("export async function quienSoy");
    expect(sesion).toContain("export async function firmaDeAgencia");
  });
});

/**
 * **La ventana del trabajo tiene tres zonas, y los botones van en una sola.**
 *
 * Es lo que más veces se rompió de esta aplicación. Los botones se van
 * acomodando al lado de lo que hacen —«Abrir en Drive» debajo de la foto,
 * «Configurar» debajo del detalle— y el resultado es que dónde está cada cosa
 * depende de qué pieza se esté mirando y de cuánto detalle tenga. Se acomodó
 * cuatro veces y volvió cuatro veces, porque nada en el código decía que
 * estuviera mal: era una preferencia que vivía en la cabeza de alguien.
 *
 * Ahora lo dice esto. El medio se lee; la barra de abajo se toca.
 */
describe("la ventana del trabajo no vuelve a mezclar mirar con hacer", () => {
  const VENTANA = path.join(FUENTE, "admin", "ResumenDeTrabajo.tsx");
  const ventana = readFileSync(VENTANA, "utf8");

  /** Todo lo que en JSX significa «esto se toca». */
  const SE_TOCA = [/<button/, /<Boton\b/, /<BotonEnlace\b/, /onClick=/];

  /**
   * El cuerpo de una función de este archivo, sin sus comentarios.
   *
   * Corta en la próxima declaración de primer nivel, que en este archivo
   * siempre arranca en la columna cero.
   */
  const cuerpoDe = (texto: string, nombre: string): string => {
    const desde = texto.indexOf("function " + nombre + "(");
    expect(
      desde,
      "No existe " + nombre + ": si se renombró, esta prueba dejó de mirar nada."
    ).toBeGreaterThan(-1);

    const lineas = texto.slice(desde).split("\n");
    const hasta = lineas.findIndex(
      (l, i) => i > 0 && /^(function |export |\/\*\*)/.test(l)
    );

    return (hasta === -1 ? lineas : lineas.slice(0, hasta))
      .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
      .join("\n");
  };

  it("el medio de la ventana no tiene ni un botón", () => {
    // `Ficha` es lo único que se dibuja en la parte que se desplaza.
    const culpables = SE_TOCA.filter((r) => r.test(cuerpoDe(ventana, "Ficha"))).map(String);

    expect(
      culpables,
      "La parte del medio de la ventana volvió a tener botones. Ahí va la " +
        "previsualización y los detalles, y nada más: todo lo que se toca va " +
        "junto en el <footer>, que es lo único que no se corre de lugar " +
        "cuando el detalle es largo."
    ).toEqual([]);
  });

  it("lo que se anota de una pieza tampoco", () => {
    const detalle = readFileSync(path.join(FUENTE, "admin", "DetalleDePieza.tsx"), "utf8");
    const culpables = SE_TOCA.filter((r) => r.test(detalle)).map(String);

    expect(
      culpables,
      "DetalleDePieza volvió a tener botones. Se dibuja en el medio de la " +
        "ventana: sus acciones —configurar, otorgar la revisión extra— viven " +
        "en la barra de abajo de ResumenDeTrabajo."
    ).toEqual([]);
  });

  it("los botones están todos adentro de la barra de abajo", () => {
    const abre = ventana.indexOf("<footer");
    const cierra = ventana.indexOf("</footer>");
    expect(abre, "La ventana se quedó sin <footer>.").toBeGreaterThan(-1);

    const barra = ventana.slice(abre, cierra);
    for (const cual of ["Abrir en Drive", "Comparar con la v", "Configurar", "<Entregar"]) {
      expect(barra, "«" + cual + "» se fue de la barra de abajo.").toContain(cual);
    }
  });

  it("el encabezado tiene el título, abrir la carpeta y cerrar", () => {
    const encabezado = ventana.slice(
      ventana.indexOf("<header"),
      ventana.indexOf("</header>")
    );
    expect(encabezado).toContain("<h2");
    expect(encabezado).toContain("Abrir la carpeta");
    expect(encabezado).toContain("IconoCerrar");
  });
});

/**
 * **Cuándo algo quieto alarma se decide en un solo lugar.**
 *
 * Los dos números —a los dos días avisa, a los tres alarma— estaban escritos a
 * mano en tres pantallas: el tablero, la ventana de un trabajo y el árbol. Con
 * eso alcanza para que un día el mismo archivo se vea naranja en una pantalla
 * y rojo en la de al lado, y para que nadie sepa cuál de las dos tiene razón.
 */
describe("el semáforo de lo que está quieto no se escribe dos veces", () => {
  it("nadie decide por su cuenta a partir de cuántos días se pone rojo", () => {
    // **Atrapa la copia, no la palabra.** La primera versión miraba cualquier
    // comparación contra un número y señalaba `dias.ts` —que valida que el
    // plazo esté entre 1 y 30, otra regla— y `fechas.ts`. Un guardián que
    // atrapa lo que no es enseña a ignorarlo. Lo que de verdad no puede
    // volver a pasar es que una pantalla decida **y pinte** por su cuenta.
    const culpables = SIN_PRUEBAS.filter((f) => {
      const relativoF = relativo(f);
      if (relativoF === "src/dominio/espera.ts" || relativoF === "src/ui/tonos.ts") {
        return false;
      }

      const cuerpo = readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
        .join("\n");

      const compara = /\bdias\b[^\n]{0,24}[><]=?\s*\d/.test(cuerpo);
      const pinta = /text-(alerta|espera)\b/.test(cuerpo);
      return compara && pinta;
    }).map(relativo);

    expect(
      culpables,
      "Estos archivos deciden a mano a partir de cuántos días algo se pone " +
        "naranja o rojo. Tiene que salir de comoVaLaEspera() en " +
        "@/dominio/espera y pintarse con @/ui/tonos: con una copia más, la " +
        "misma cantidad de días se ve de dos colores según la pantalla."
    ).toEqual([]);
  });

  it("los colores de la espera salen de un solo módulo", () => {
    const culpables = SIN_PRUEBAS.filter((f) => {
      if (relativo(f) === "src/ui/tonos.ts") return false;
      return /function tonoDeEspera|function tonoDelNombre/.test(readFileSync(f, "utf8"));
    }).map(relativo);

    expect(
      culpables,
      "Estos archivos tienen su propia copia de los colores de la espera. " +
        "Salen de @/ui/tonos: con una copia más, la misma cantidad de días se " +
        "ve de dos colores según en qué pantalla esté."
    ).toEqual([]);
  });
});
