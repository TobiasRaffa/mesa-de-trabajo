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
import { seccionDeLaRuta } from "@/dominio/roles";
import { ENTRADA } from "@/proxy";

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

/**
 * El archivo sin sus líneas de `import`.
 *
 * Buscar un nombre en el texto entero no prueba nada: al borrar la llamada, el
 * import queda y el nombre sigue apareciendo. Se descubrió rompiendo una de
 * estas pruebas a propósito, que es para lo que sirve hacerlo.
 */
const sinImports = (texto: string) =>
  texto
    .split(/\r?\n/)
    .filter((linea) => !linea.trimStart().startsWith("import "))
    .join("\n");

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

  it("el proxy cierra gestión entera y el diagnóstico", () => {
    // Va en src/ y no en la raíz: la documentación de Next pide que quede al
    // mismo nivel que `app`, y acá `app` vive dentro de `src`. Puesto en la
    // raíz el archivo se ignora en silencio -- ninguna pantalla se protege y
    // nada avisa. Pasó, y por eso esta prueba nombra la ruta exacta.
    const proxy = leer("src/proxy.ts");

    for (const ruta of ['"/gestion"', '"/gestion/:path*"', '"/diagnostico"']) {
      expect(
        proxy,
        `El proxy no cubre ${ruta}, así que ahí se entra sin sesión.`
      ).toContain(ruta);
    }

    expect(
      proxy,
      "La puerta tiene que mirar la galleta de sesión, no dejar pasar a todos."
    ).toContain("quienLleva(");
  });

  it("la puerta separa por sección, no solo por «entró o no entró»", () => {
    // Que la barra lateral no dibuje «Facturas» no protege nada: la dirección
    // se escribe a mano. La protección es esta, y está acá por la misma razón
    // que la puerta entera: es el único lugar por el que pasa todo, incluido
    // lo que todavía no existe.
    const proxy = leer("src/proxy.ts");

    expect(proxy, "La puerta no mira de qué sección es la dirección.").toContain(
      "seccionDeLaRuta("
    );
    expect(
      proxy,
      "La puerta no compara contra las secciones de quien entró: sabe quién es " +
        "y le abre todo igual."
    ).toContain("sesion.secciones.includes(");
  });

  it("ninguna pantalla de gestión se queda sin sección", () => {
    // **Es la mitad que hace que separar por sección se sostenga.** Una
    // dirección que nadie clasificó no es de ninguna sección, y la puerta la
    // trata como «acá no entra nadie»: se cierra para todos, incluida quien
    // administra. Eso es lo correcto —lo contrario sería abrirla para todos—
    // pero sin este aviso el error aparece cuando alguien no puede trabajar.
    const paginas = archivosBajo(path.join(FUENTE, "app", "(admin)")).filter((f) =>
      /[/\\]page\.tsx$/.test(f)
    );
    expect(paginas.length, "No encontré ninguna pantalla de gestión.").toBeGreaterThan(0);

    const sinSeccion = paginas
      .map((f) => {
        // De la carpeta a la dirección: se sacan los grupos `(admin)` y los
        // tramos variables `[clienteId]` se reemplazan por algo cualquiera.
        const ruta =
          "/" +
          path
            .relative(path.join(FUENTE, "app"), path.dirname(f))
            .replace(/\\/g, "/")
            .split("/")
            .filter((t) => t && !t.startsWith("("))
            .map((t) => (t.startsWith("[") ? "cualquiera" : t))
            .join("/");
        return ruta;
      })
      .filter((ruta) => ruta !== ENTRADA && seccionDeLaRuta(ruta) === null);

    expect(
      sinSeccion,
      "Estas pantallas no están en ninguna sección, así que no entra nadie: " +
        "ni quien administra. Clasificalas en `src/dominio/roles.ts`."
    ).toEqual([]);
  });

  it("las acciones de Admin preguntan si quien las llama entra a Admin", () => {
    // **El segundo cerrojo, y hace falta que sea segundo.** El primero es la
    // puerta: una acción se manda a la dirección de la pantalla que la dibujó,
    // así que el POST de dar de alta gente llega a `/gestion/admin` y se
    // rebota ahí. Pero eso depende de en qué pantalla se dibujó el formulario,
    // que es una decisión de quien arma la pantalla: el día que un formulario
    // del equipo aparezca en una pantalla que casi todos abren, la puerta lo
    // dejaría pasar y cualquiera se daría a sí mismo el rol que quiera.
    const fuente = leer("src/app/(admin)/gestion/acciones.ts");

    // Las que cambian quién entra y a qué, más las claves de los clientes.
    const deAdmin = [
      "darDeAlta",
      "editarDelEquipo",
      "reiniciarClaveDePersona",
      "quitarDelEquipo",
      "ponerTagDeCliente",
      "verClaveDeCliente",
    ];

    const partes = new Map(
      fuente
        .split(/^export async function /m)
        .slice(1)
        .map((bloque) => [bloque.slice(0, bloque.indexOf("(")), bloque] as const)
    );

    const sinPreguntar = deAdmin.filter((nombre) => {
      const bloque = partes.get(nombre);
      return !bloque || !bloque.includes('puedoVer("admin")');
    });

    expect(
      sinPreguntar,
      "Estas acciones cambian quién entra y a qué, y no preguntan quién las " +
        "está llamando. Empezá por `if (!(await puedoVer(\"admin\"))) return NO_ES_TUYO;`."
    ).toEqual([]);
  });

  it("toda acción de gestión pregunta a qué sección pertenece", () => {
    // **La puerta separa por sección mirando la ruta; una acción no respeta la
    // ruta.** El `Next-Action` la encuentra por su identificador, así que el
    // POST llega igual desde cualquier dirección que la persona pueda abrir: se
    // comprobó que las acciones de Clientes corren posteadas a `/gestion/
    // facturas`. Por eso cada acción vuelve a preguntar por su cuenta —las de
    // Admin con `puedoVer("admin")`, el resto con `puedoAlgunaDe(...)`—. Sin
    // esto, quien solo factura leía y tocaba los clientes, los chats y las
    // piezas con solo mandar el POST. Este guardián existe para que una acción
    // nueva no nazca sin cerrojo: es exactamente el descuido que ya pasó.
    //
    // **Y mira tres cosas que la primera versión dejaba pasar**, cada una un
    // agujero por donde entraba una acción sin cerrojo:
    //
    //   1. **Todos los `acciones.ts`, no uno.** Leía un solo archivo por su
    //      nombre completo, así que una carpeta nueva bajo `(admin)` con sus
    //      propias acciones nacía sin vigilancia.
    //   2. **Las dos formas de escribir una función.** Partía por
    //      `export async function`, y una acción escrita
    //      `export const guardarX = async (...) => {}` ni siquiera aparecía en
    //      la lista: no fallaba, directamente no se la contaba.
    //   3. **Que el cerrojo sea lo primero.** Aceptaba la llamada en cualquier
    //      parte del cuerpo —incluso adentro de un comentario, o después de
    //      haber leído del almacén lo que se iba a proteger—. Comprobar
    //      permisos después de usarlos no es comprobarlos.
    // **La puerta misma es la excepción, y es una sola.** Las acciones de
    // `/gestion/entrar` son las de entrar: mirar un correo, escribir la
    // contraseña, pedir ayuda, salir. Exigirles sesión sería exigir haber
    // entrado para poder entrar. Está nombrada acá, con su motivo, en vez de
    // caer por descuido — y abajo se verifica que ahí adentro no haya nada más
    // que la puerta, porque si no sería el lugar donde esconder una acción
    // para que este guardián no la mire.
    const LA_PUERTA = "src/app/(admin)/gestion/entrar/acciones.ts";

    const archivos = TODOS.filter(
      (f) =>
        /[/\\]acciones\.ts$/.test(relativo(f)) &&
        relativo(f).startsWith("src/app/") &&
        relativo(f) !== LA_PUERTA
    );
    expect(archivos.length, "No encontré los archivos de acciones.").toBeGreaterThan(0);

    const sinCerrojo = archivos.flatMap((f) => {
      const texto = sinImports(readFileSync(f, "utf8"));

      // Las dos formas: función exportada y constante exportada con flecha.
      const declara = /^export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async)/gm;

      const encontradas: Array<{ nombre: string; desde: number }> = [];
      for (const m of texto.matchAll(declara)) {
        encontradas.push({ nombre: m[1] ?? m[2], desde: m.index! });
      }

      return encontradas
        .filter(({ desde }, i) => {
          const hasta = encontradas[i + 1]?.desde ?? texto.length;
          const bloque = texto.slice(desde, hasta);

          // El cuerpo arranca después de la llave que abre. Se saltean los
          // comentarios y los renglones en blanco, y lo primero que quede
          // tiene que ser el cerrojo.
          const abre = bloque.indexOf("{\n");
          if (abre === -1) return true;

          const primera = bloque
            .slice(abre + 2)
            .split("\n")
            .map((l) => l.trim())
            .find(
              (l) => l && !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*")
            );

          return !primera || !/^if \(!\(await (puedoVer\("admin"\)|puedoAlgunaDe\()/.test(primera);
        })
        .map(({ nombre }) => `${relativo(f)}: ${nombre}`);
    });

    expect(
      sinCerrojo,
      "Estas acciones no arrancan preguntando en qué sección se las dibuja, y " +
        "una acción se puede invocar desde cualquier ruta. La primera línea " +
        'tiene que ser `if (!(await puedoAlgunaDe([...]))) return NO_ES_TUYO;` ' +
        'con las secciones que la usan, o `puedoVer("admin")` si es de Admin.'
    ).toEqual([]);
  });

  it("en la puerta no hay nada más que la puerta", () => {
    // La otra mitad de la excepción de arriba. `/gestion/entrar` es la única
    // dirección que abre sin sesión —`proxy.ts` la deja pasar antes de mirar la
    // galleta—, así que una acción puesta ahí queda al alcance de cualquiera
    // **sin haber entrado**. Mientras sean las tres de entrar, el riesgo es
    // el que se decidió tener; una cuarta hay que decidirla a propósito.
    const fuente = sinImports(leer("src/app/(admin)/gestion/entrar/acciones.ts"));

    const exportadas = [
      ...fuente.matchAll(/^export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async)/gm),
    ].map((m) => m[1] ?? m[2]);

    expect(
      exportadas.sort(),
      "Apareció una acción nueva en la pantalla de entrar, que es la única que " +
        "se abre sin sesión. Si de verdad va ahí, sumala a esta lista y dejá " +
        "escrito por qué puede llamarla alguien que no entró."
    ).toEqual(["entrar", "olvide", "salir"]);
  });

  it("ninguna pantalla de gestión queda fuera del alcance de la puerta", () => {
    // **El matcher del proxy es una lista de direcciones, y las listas se
    // quedan cortas.** Hoy dice `/gestion`, `/gestion/:path*` y `/diagnostico`:
    // una pantalla nueva bajo `(admin)` en cualquier otra dirección —`/informes`,
    // pongamos— no pasaría por la puerta **en absoluto**. No se vería como un
    // error de permisos: se vería como una pantalla que anda, abierta para
    // cualquiera que sepa la dirección, incluido quien no entró nunca.
    const proxy = leer("src/proxy.ts");
    const matcher = proxy.slice(proxy.indexOf("matcher:"), proxy.indexOf("]", proxy.indexOf("matcher:")));
    const patrones = [...matcher.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(patrones.length, "No encontré el matcher del proxy.").toBeGreaterThan(0);

    /** Si el matcher cubre esa dirección. `:path*` cubre lo que cuelga. */
    const cubierta = (ruta: string) =>
      patrones.some((p) => {
        const base = p.replace("/:path*", "");
        return p.includes(":path*") ? ruta === base || ruta.startsWith(`${base}/`) : ruta === p;
      });

    const paginas = archivosBajo(path.join(FUENTE, "app", "(admin)")).filter((f) =>
      /[/\\]page\.tsx$/.test(f)
    );

    const afuera = paginas
      .map(
        (f) =>
          "/" +
          path
            .relative(path.join(FUENTE, "app"), path.dirname(f))
            .replace(/\\/g, "/")
            .split("/")
            .filter((t) => t && !t.startsWith("("))
            .map((t) => (t.startsWith("[") ? "cualquiera" : t))
            .join("/")
      )
      .filter((ruta) => !cubierta(ruta));

    expect(
      afuera,
      "Estas pantallas de gestión no pasan por la puerta: el matcher de " +
        "`src/proxy.ts` no las cubre, así que las abre cualquiera. Agregá su " +
        "dirección al matcher."
    ).toEqual([]);
  });

  it("nadie le pone la contraseña a otro", () => {
    // **Es la regla entera del alta.** Se da de alta un correo y un rol; la
    // contraseña la elige esa persona la primera vez que entra, y desde ahí no
    // la sabe nadie más. Si una pantalla de administración pudiera ponerle una
    // a alguien, quien administra podría entrar como cualquiera, y todo lo que
    // queda firmado con un nombre dejaría de significar algo.
    const ponen = SIN_PRUEBAS.filter((f) => {
      const cuerpo = readFileSync(f, "utf8")
        .split("\n")
        .filter((linea) => !linea.trimStart().startsWith("import "))
        .join("\n");
      return /\bponerClave\(/.test(cuerpo);
    }).map(relativo);

    expect(
      ponen.sort(),
      "Solo la puerta puede guardar una contraseña, y solo la que acaba de " +
        "escribir su dueña."
    ).toEqual(["src/app/(admin)/gestion/entrar/acciones.ts", "src/lib/claves.ts"]);
  });

  it("el proxy no reparte la sesión: solo la exige", () => {
    // **Pasó, y era peor de lo que parecía.** Mientras la puerta estuvo
    // sacada, el proxy le entregaba la marca de «soy del equipo» a cualquiera
    // que escribiera la dirección, con treinta días de vida. Las rutas de
    // archivos la aceptan, así que con eso se bajaba cualquier archivo de
    // cualquier cliente, incluidos los escondidos a propósito. No era «se ven
    // las pantallas»: era repartir una credencial.
    const proxy = leer("src/proxy.ts");

    expect(
      /cookies\.set|valorDeSesion/.test(proxy),
      "El proxy está firmando o poniendo la galleta. La sesión la da entrar, " +
        "que es lo único que pregunta quién sos; el proxy solo la exige."
    ).toBe(false);
  });

  it("la puerta queda afuera de la puerta", () => {
    // Si la pantalla de entrada exigiera sesión, no habría forma de conseguir
    // una: la aplicación quedaría cerrada con la llave adentro.
    const proxy = leer("src/proxy.ts");
    expect(proxy).toContain("/gestion/entrar");
  });

  it("nada redirige la puerta a otro lado", () => {
    // **Pasó, y dejó la aplicación dando vueltas sobre sí misma.** Quedaba en
    // `next.config.ts` una redirección de cuando la puerta se había sacado:
    // mandaba `/gestion/entrar` a `/gestion`. Al volver a poner la puerta, esa
    // regla la tapó —entrar iba a gestión, gestión volvía a entrar— y no había
    // forma de llegar a ninguna pantalla. Se salvó de ser permanente por poco.
    const config = leer("next.config.ts");
    const reglas = [...config.matchAll(/source:\s*"([^"]+)"/g)].map((m) => m[1]);

    expect(
      reglas.filter((r) => r === "/gestion/entrar"),
      "Hay una redirección que se lleva la pantalla de entrada a otro lado. " +
        "Con la puerta puesta, eso deja a la aplicación dando vueltas."
    ).toEqual([]);
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

  it("ninguna ruta de API sirve datos sin decir a qué sección pertenece", () => {
    // **La separación por rol tiene que alcanzar también a `/api`.** El `proxy`
    // la aplica mirando la dirección, y su matcher cubre `/gestion` y
    // `/diagnostico` pero **no** `/api`: durante un tiempo, cualquier sesión de
    // gestión valía lo mismo en las cuatro rutas, y alguien dado de alta para
    // facturar se bajaba el historial entero de un cliente con escribir la
    // dirección.
    //
    // La versión anterior de esta prueba buscaba que el **nombre** de alguna
    // función de autorización apareciera en el archivo. Eso no alcanza: el
    // nombre aparece igual en un comentario, o llamado después de haber leído
    // lo que se iba a proteger. Ahora se verifica la forma:
    //
    //   1. La ruta declara `const PUERTA: Puerta = { agencia, cliente }`, que
    //      dice qué secciones sirve y si entra el cliente del portal.
    //   2. Se la pasa a una de las dos puertas del módulo de permisos.
    //
    // Y del otro lado, `quienPide` —la que contesta «quién sos» sin preguntar
    // «te toca»— dejó de exportarse: no hay forma de saltearse el paso, porque
    // la versión sin sección no se puede llamar desde afuera.
    const rutas = archivosBajo(path.join(FUENTE, "app", "api")).filter((f) =>
      f.endsWith("route.ts")
    );
    expect(rutas.length, "No encontré ninguna ruta de API.").toBeGreaterThan(0);

    const flojas = rutas
      .map((f) => {
        const texto = readFileSync(f, "utf8");
        const cuerpo = sinImports(texto);

        if (!/const PUERTA: Puerta = \{/.test(cuerpo)) {
          return `${relativo(f)}: no declara su PUERTA`;
        }
        if (!/quienPide(En|De)\([\s\S]{0,200}?PUERTA/.test(cuerpo)) {
          return `${relativo(f)}: no le pasa su PUERTA a quienPideEn/quienPideDe`;
        }
        return null;
      })
      .filter(Boolean);

    expect(
      flojas,
      "Cada ruta de /api tiene que decir a qué secciones sirve y comprobarlo. " +
        "Sin eso, la separación por rol se termina en las pantallas y las rutas " +
        "quedan abiertas para cualquier sesión de gestión."
    ).toEqual([]);
  });

  it("la puerta sin sección no se puede llamar desde afuera", () => {
    // Es lo que hace que la prueba de arriba no dependa de la buena memoria de
    // nadie: mientras `quienPide` fue pública, una ruta podía preguntar «¿quién
    // es?» y olvidarse de «¿le toca?». Las cuatro se olvidaron.
    const permisos = leer("src/lib/permisos.ts");

    expect(
      /export\s+async\s+function\s+quienPide\s*\(/.test(permisos),
      "`quienPide` no puede volver a exportarse: contesta quién sos sin mirar " +
        "la sección, y esa es exactamente la llamada que se olvida."
    ).toBe(false);
    expect(permisos).toContain("export async function quienPideEn");
    expect(permisos).toContain("export async function quienPideDe");
  });

  it("la gestión pide los clientes por un solo lugar", () => {
    // **Es el mismo problema que la puerta, con otra forma.** Los roles separan
    // secciones; el alcance separa clientes. Si cada pantalla filtrara por su
    // cuenta —el árbol, el tablero, los chats, las facturas, cada acción que
    // recibe una carpeta— el día que una se olvide, alguien ve la carpeta de un
    // cliente que no lleva. Y no se nota: la pantalla se ve bien.
    //
    // Por eso `@/lib/clientes` y `@/lib/carpetas` se piden desde
    // `@/admin/datos/clientes`, que es el único que recorta.
    const deGestion = TODOS.filter((f) => {
      const r = relativo(f);
      return (
        (r.startsWith("src/admin/") || r.startsWith("src/app/(admin)/")) &&
        !r.endsWith(".test.ts") &&
        !r.endsWith(".test.tsx") &&
        r !== "src/admin/datos/clientes.ts"
      );
    });
    expect(deGestion.length, "No encontré archivos de gestión.").toBeGreaterThan(0);

    // Las que leen clientes o carpetas sin recortar. Las que **escriben** —
    // `ponerTag`, `habilitarCliente`, `olvidarCarpetas`— no están: no devuelven
    // datos de nadie, y la acción que las llama ya comprobó el alcance antes.
    const SIN_RECORTAR = [
      "clientesHabilitados",
      "todosLosClientes",
      "clientePorId",
      "clienteDeCarpeta",
      "esCarpetaDelCliente",
      "idsDeCarpetasReales",
      // El mapa entero de carpetas a clientes: sin recortar, como todo lo de
      // ese módulo.
      "carpetasConSuCliente",
      // Un aviso nombra al cliente y la carpeta: sin recortar, cuenta lo que
      // el alcance viene a no mostrar.
      "losAvisos",
    ];

    const culpables = deGestion
      .filter((f) => {
        const texto = readFileSync(f, "utf8");
        // Se mira el contenido de cada `import { ... }`, y no línea por línea:
        // los imports largos vienen partidos en varias, y una comprobación por
        // línea no encontraría nada justo en los archivos que más importan.
        for (const m of texto.matchAll(/import\s*\{([\s\S]*?)\}\s*from/g)) {
          const nombres = m[1].split(",").map((x) => x.trim().replace(/^type\s+/, ""));
          if (nombres.some((n) => SIN_RECORTAR.includes(n))) return true;
        }
        return false;
      })
      .map(relativo);

    expect(
      culpables,
      "Estos piden los clientes o las carpetas sin recortarlos por el alcance " +
        "de quien está mirando. Pedilos a @/admin/datos/clientes: misClientes, " +
        "miCliente, esCarpetaMia, clienteDeMiCarpeta, misCarpetas."
    ).toEqual([]);
  });

  it("la agencia no es «todos los clientes» cuando pide un archivo", () => {
    // **Era un agujero y no se veía.** `quienPide` contestaba `{tipo:
    // "agencia"}` a secas, y con eso `archivoAutorizado` autorizaba contra las
    // carpetas de todos: alcanzaba con conocer un identificador de Drive para
    // bajarse el archivo de un cliente que uno no lleva.
    const permisos = leer("src/lib/permisos.ts");

    expect(
      permisos,
      "QuienPide tiene que traer las raíces de quien pregunta, no un permiso general."
    ).toMatch(/tipo:\s*"agencia";\s*raices:\s*string\[\];/);
    expect(
      permisos,
      "Y las secciones, que son lo que separa qué ruta le toca."
    ).toMatch(/secciones:\s*Seccion\[\];/);
    expect(
      /raices: \[\]|carpetasAdministradas\(\) : \[quien\.raiz\]/.test(permisos),
      "archivoAutorizado volvió a autorizar a la agencia contra todas las carpetas."
    ).toBe(false);
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

describe("una fecha se escribe de una sola manera", () => {
  it("nadie arma su propio formateador", () => {
    // **Estaban en nueve archivos, y el precio no fue la repetición.** Ninguna
    // de las copias fijaba la zona horaria, y un `Intl.DateTimeFormat` sin zona
    // usa la del servidor: en internet, tiempo universal. **Cada hora que la
    // aplicación mostraba estaba tres horas adelantada** —un mensaje de las
    // ocho y media de la noche decía 23:30— y desde una máquina de Buenos Aires,
    // que es donde se desarrolla, no se nota nunca.
    //
    // Y no era la primera vez: el propio módulo que centralizaba esto decía que
    // el formato «estaba copiado tres veces». Se volvió a copiar seis veces más.
    const DUENO = "src/dominio/tiempo.ts";

    const culpables = SIN_PRUEBAS.filter(
      (f) => relativo(f) !== DUENO && readFileSync(f, "utf8").includes("new Intl.DateTimeFormat")
    ).map(relativo);

    expect(
      culpables,
      "El formato de las fechas vive en `src/dominio/tiempo.ts` y en ningún " +
        "otro lado: `enPalabrasElDiaDe`, `enPalabrasLaFecha`, `enPalabrasElMes`, " +
        "`enPalabrasConAnio`, `enPalabrasElDiaLargo`. Lo importante no es no " +
        "repetir: es que la zona horaria esté puesta, y en una copia se olvida."
    ).toEqual([]);
  });
});

describe("lo recordado no puede contestar distinto que la base", () => {
  it("las piezas se escriben por un solo lugar", () => {
    // **La colección de piezas se lee una vez por pedido y se recuerda.** Sin
    // eso, las tres preguntas que se hacen sobre una carpeta —en qué anda cada
    // pieza, qué se mudó a «Entregas finales», cuántas aprobadas ya no están—
    // recorrían la colección entera **por cada carpeta del árbol**: un tablero
    // con cuarenta carpetas eran ochenta descargas de la misma tabla en un solo
    // render.
    //
    // El precio de recordar es que quien escriba tiene que dejar el recuerdo al
    // día, y eso no puede depender de que alguien se acuerde: una acción que
    // guarda una pieza y después lee la carpeta vería la foto de antes de su
    // propia escritura. Por eso hay un solo escritor, `escribir`, que guarda y
    // anota; esto verifica que nadie lo esquive.
    const fuente = sinImports(
      readFileSync(path.join(FUENTE, "lib", "piezas.ts"), "utf8")
    );

    const abre = fuente.indexOf("async function escribir(");
    expect(abre, "No encontré `escribir` en piezas.ts.").toBeGreaterThan(-1);
    const cuerpoDeEscribir = fuente.slice(abre, fuente.indexOf("\n}", abre));

    const escrituras = [...fuente.matchAll(/almacen\.(guardar|guardarVarios|borrar)\(/g)];
    const porFuera = escrituras.filter((m) => !cuerpoDeEscribir.includes(m[0]));

    expect(
      porFuera.map((m) => m[0]),
      "Las piezas se guardan con `escribir(...)`, que además deja al día lo " +
        "recordado de este pedido. Escribiendo directo contra el almacén, la " +
        "lectura siguiente del mismo render devuelve la foto de antes."
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
    for (const cual of ["Abrir en Drive", "Comparar con la v", "<Entregar", "Configurar"]) {
      expect(barra, "«" + cual + "» se fue de la barra de abajo.").toContain(cual);
    }
  });

  it("el encabezado tiene el título, abrir la carpeta y cerrar", () => {
    // El encabezado es el compartido de todas las ventanas: lo que se le pasa
    // es lo que se ve. La cruz la pone él solo a partir de `onCerrar`.
    const abre = ventana.indexOf("<EncabezadoDeVentana");
    expect(abre, "La ventana dejó de usar el encabezado compartido.").toBeGreaterThan(-1);
    const encabezado = ventana.slice(abre, ventana.indexOf("{/* El medio", abre));
    expect(encabezado).toContain("titulo=");
    expect(encabezado).toContain("Ver la carpeta");
    expect(encabezado).toContain("onCerrar=");
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
