import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Drive se reemplaza por un doble: estas pruebas verifican la decisión de
// permisos, no la conexión con Google.
// `alOlvidarDrive` se deja pasar sin hacer nada: acá no hay memoria de Drive
// que limpiar, y lo que se prueba es la decisión, no el aviso.
vi.mock("@/lib/google", () => ({ metadatosArchivo: vi.fn(), alOlvidarDrive: () => {} }));
// Los clientes también se reemplazan: acá se prueba la decisión de permisos,
// no cómo se descubren las carpetas compartidas.
vi.mock("@/lib/clientes", () => ({ clientesHabilitados: vi.fn() }));
// Y lo escondido: qué se guardó es asunto del almacén, no de esta decisión.
// `esCarpetaDeFacturas` se deja de verdad porque es una función pura.
vi.mock("@/lib/ajustes", async (original) => ({
  ...(await original<typeof import("@/lib/ajustes")>()),
  escondidosEntre: vi.fn(async (ids: string[]) => new Set(ids.filter((i) => ESCONDIDOS.has(i)))),
}));

// Las secciones van en el tipo desde que la separación por rol alcanza también
// a las rutas. Acá se prueba el recorte por **carpetas**, así que van todas:
// qué sección abre cada ruta lo prueba `puertasDeApi.test.ts`.
const TODAS = [...SECCIONES];

/** Lo que la agencia apagó, para esta prueba. */
const ESCONDIDOS = new Set<string>();

import { clientesHabilitados } from "@/lib/clientes";
import { metadatosArchivo } from "@/lib/google";
import { SECCIONES } from "@/dominio/roles";
import {
  archivoAutorizado,
  cadenaHasta,
  carpetasAdministradas,
  olvidarElArbol,
} from "@/lib/permisos";

const CLIENTE = "carpeta-del-cliente";
const AJENA = "carpeta-que-no-administramos";
const mock = vi.mocked(metadatosArchivo);

/** Quien pregunta, en las pruebas: un cliente con su carpeta. */
const comoCliente = (raiz: string) => ({ tipo: "cliente" as const, raiz });
const clientes = vi.mocked(clientesHabilitados);

const cliente = (id: string) => ({
  id,
  nombre: id,
  habilitado: true,
  token: "t-" + id,
  tag: "tag-" + id,
  verEnDrive: false,
      telefono: "",
});

const archivo = (parents: string[] | undefined) => ({
  id: "archivo-1",
  name: "9311.jpeg",
  mimeType: "image/jpeg",
  parents,
});

/**
 * Arma un Drive de mentira a partir de «quién cuelga de quién».
 *
 * Es más honesto que devolver siempre lo mismo: obliga a que la función haga
 * de verdad el recorrido hacia arriba para encontrar la respuesta.
 *
 * **Y distingue carpetas de archivos**, que es parte de la decisión que se
 * prueba: una carpeta no se puede descargar, así que preguntar por una tiene
 * que dar «no». Decía que todo era carpeta —incluido el archivo por el que se
 * preguntaba— y con eso la prueba corría sobre un Drive que no existe. Es
 * carpeta lo que tiene algo colgando; lo demás es un archivo.
 */
function driveConArbol(arbol: Record<string, string[]>) {
  const carpetas = new Set(Object.values(arbol).flat());
  mock.mockImplementation(async (id: string) => ({
    id,
    name: id,
    mimeType: carpetas.has(id) ? "application/vnd.google-apps.folder" : "image/jpeg",
    parents: arbol[id],
  }));
}

beforeEach(() => {
  ESCONDIDOS.clear();
  mock.mockReset();
  clientes.mockReset();
  olvidarElArbol();
  clientes.mockResolvedValue([cliente(CLIENTE)]);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("carpetasAdministradas", () => {
  it("es la carpeta de cada cliente habilitado", async () => {
    clientes.mockResolvedValue([cliente("uno"), cliente("dos")]);
    await expect(carpetasAdministradas()).resolves.toEqual(["uno", "dos"]);
  });

  it("está vacía si no hay ningún cliente habilitado", async () => {
    clientes.mockResolvedValue([]);
    await expect(carpetasAdministradas()).resolves.toEqual([]);
  });

  it("está vacía si no se puede saber cuáles son", async () => {
    // Si no se puede saber qué se administra, no se administra nada.
    clientes.mockRejectedValue(new Error("Drive se cayó"));
    await expect(carpetasAdministradas()).resolves.toEqual([]);
  });
});

describe("archivoAutorizado", () => {
  it("autoriza un archivo que cuelga directo de la carpeta del cliente", async () => {
    mock.mockResolvedValue(archivo([CLIENTE]));
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.not.toBeNull();
  });

  it("autoriza un archivo que está una carpeta más abajo", async () => {
    // Este es el caso real: «Cafe Otono / Logo - Prueba / 9304.jpeg». Con la
    // regla vieja —mirar solo la carpeta madre— todos los archivos de verdad
    // quedaban afuera y el portal se veía vacío.
    driveConArbol({ "archivo-1": ["subcarpeta"], subcarpeta: [CLIENTE] });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.not.toBeNull();
  });

  it("autoriza aunque esté tres carpetas abajo", async () => {
    driveConArbol({
      "archivo-1": ["nietas"],
      nietas: ["hijas"],
      hijas: [CLIENTE],
    });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.not.toBeNull();
  });

  it("RECHAZA un archivo real de Drive que está fuera de ese árbol", async () => {
    // Este es el caso que importa. La cuenta de servicio puede verlo, pero
    // la aplicación no administra esa carpeta: no se sirve.
    driveConArbol({ "archivo-1": ["ajena-hija"], "ajena-hija": [AJENA] });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("autoriza si está en varias carpetas y una es administrada", async () => {
    // En Drive un archivo puede tener más de una carpeta madre.
    mock.mockResolvedValue(archivo([AJENA, CLIENTE]));
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.not.toBeNull();
  });

  it("rechaza si el archivo no tiene carpeta madre", async () => {
    mock.mockResolvedValue(archivo(undefined));
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("rechaza sin saber de quién es el archivo", async () => {
    // Una configuración incompleta no puede volverse permiso para todo.
    mock.mockResolvedValue(archivo([CLIENTE]));
    await expect(archivoAutorizado("archivo-1", comoCliente(""))).resolves.toBeNull();
    expect(mock).not.toHaveBeenCalled();
  });

  it("RECHAZA el archivo de otro cliente, aunque los dos estén habilitados", async () => {
    // Este es el caso que faltaba. Antes la pregunta era «¿es de algún
    // cliente?» y la respuesta alcanzaba para servirlo: con eso, un cliente
    // legítimo se bajaba los archivos de todos los demás.
    clientes.mockResolvedValue([cliente(CLIENTE), cliente(AJENA)]);
    mock.mockResolvedValue(archivo([AJENA]));
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("rechaza si Google falla, en vez de dejar pasar", async () => {
    // Ante la duda, no se sirve. Nunca al revés.
    mock.mockRejectedValue(new Error("Drive se cayó"));
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("no deja que un error de Google se propague a la pantalla", async () => {
    mock.mockRejectedValue(new Error("detalle interno que no debe verse"));
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("no se cuelga con un ciclo de carpetas", async () => {
    // Drive deja armar ciclos con atajos. Sin corte, esto sería infinito.
    driveConArbol({ "archivo-1": ["a"], a: ["b"], b: ["a"] });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("no sube indefinidamente: un árbol muy profundo se corta", async () => {
    // La carpeta administrada está a diez niveles, más allá del tope. Se
    // rechaza, que es el lado seguro del error.
    const arbol: Record<string, string[]> = { "archivo-1": ["n0"] };
    for (let i = 0; i < 9; i++) arbol[`n${i}`] = [`n${i + 1}`];
    arbol.n9 = [CLIENTE];
    driveConArbol(arbol);
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("RECHAZA un archivo anidado de otro cliente habilitado", async () => {
    // Esta prueba decía lo contrario, y pasaba: daba por correcto que el
    // archivo de otro cliente se sirviera, porque la pregunta era «¿es de
    // algún cliente?». Una prueba que bendice el agujero es peor que no
    // tenerla: convierte el error en la conducta esperada, y quien lo
    // encuentre después va a dudar de si arreglarlo rompe algo a propósito.
    clientes.mockResolvedValue([cliente(CLIENTE), cliente("otro-cliente")]);
    driveConArbol({ "archivo-1": ["sub"], sub: ["otro-cliente"] });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("RECHAZA un archivo de un cliente deshabilitado", async () => {
    // Apagar un cliente en gestión le corta el acceso a sus archivos acá
    // mismo, sin tocar Drive.
    clientes.mockResolvedValue([cliente(CLIENTE)]);
    driveConArbol({ "archivo-1": ["sub"], sub: ["cliente-apagado"] });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("no le pregunta dos veces a Google por la misma carpeta", async () => {
    // Una pantalla con doce miniaturas preguntaría doce veces por la misma
    // carpeta madre. Cada pregunta es un viaje de red.
    driveConArbol({
      "archivo-1": ["subcarpeta"],
      "archivo-2": ["subcarpeta"],
      subcarpeta: [CLIENTE],
    });

    await archivoAutorizado("archivo-1", comoCliente(CLIENTE));
    const despuesDelPrimero = mock.mock.calls.length;
    await archivoAutorizado("archivo-2", comoCliente(CLIENTE));

    // El segundo archivo cuesta una sola consulta: la del archivo en sí.
    expect(mock.mock.calls.length).toBe(despuesDelPrimero + 1);
  });
});

// ---------------------------------------------------------------------------

/**
 * Esconder algo tiene que **negar** algo.
 *
 * Antes, apagar una carpeta en gestión solo dejaba de dibujarla en el portal.
 * El archivo se pide por su dirección: quien la tuviera de antes —de un link
 * viejo, del historial, de una captura— la escribía a mano y se lo bajaba
 * igual. La pantalla no es el permiso.
 */
describe("lo escondido no se sirve", () => {
  it("rechaza un archivo escondido, aunque su carpeta se muestre", async () => {
    ESCONDIDOS.add("archivo-1");
    mock.mockResolvedValue(archivo([CLIENTE]));
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("rechaza un archivo visible dentro de una carpeta escondida", async () => {
    ESCONDIDOS.add("logos");
    driveConArbol({ "archivo-1": ["logos"], logos: [CLIENTE] });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("rechaza si la escondida está más arriba, en el medio del camino", async () => {
    // Esconder una carpeta esconde todo lo que tiene adentro, por hondo que
    // esté. Si no, apagar una carpeta obligaría a apagar cada cosa de adentro.
    ESCONDIDOS.add("septiembre");
    driveConArbol({
      "archivo-1": ["semana-2"],
      "semana-2": ["septiembre"],
      septiembre: [CLIENTE],
    });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("autoriza una subcarpeta hondas si nada del camino está escondido", async () => {
    driveConArbol({
      "archivo-1": ["semana-2"],
      "semana-2": ["septiembre"],
      septiembre: [CLIENTE],
    });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.not.toBeNull();
  });

  it("autoriza si hay otro camino limpio hasta el cliente", async () => {
    // En Drive una cosa puede estar en varias carpetas. Negar por el camino
    // sucio cuando hay uno bueno sería esconder algo que se dejó a la vista.
    ESCONDIDOS.add("borradores");
    driveConArbol({
      "archivo-1": ["borradores", "logos"],
      borradores: [CLIENTE],
      logos: [CLIENTE],
    });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.not.toBeNull();
  });

  it("RECHAZA lo que está en «Facturas», sin que nadie lo esconda", async () => {
    mock.mockImplementation(async (id: string) => ({
      id,
      name: id === "f" ? "Facturas" : id,
      // El que se pide es un archivo; lo que cuelga arriba, carpetas.
      mimeType: id === "archivo-1" ? "image/jpeg" : "application/vnd.google-apps.folder",
      parents: { "archivo-1": ["f"], f: [CLIENTE] }[id],
    }));
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("SÍ deja pasar «Entregas finales»: ahí va lo que el cliente aprobó", async () => {
    mock.mockImplementation(async (id: string) => ({
      id,
      name: id === "ef" ? "Entregas finales" : id,
      // El que se pide es un archivo; lo que cuelga arriba, carpetas.
      mimeType: id === "archivo-1" ? "image/jpeg" : "application/vnd.google-apps.folder",
      parents: { "archivo-1": ["ef"], ef: [CLIENTE] }[id],
    }));
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.not.toBeNull();
  });
});

// ---------------------------------------------------------------------------

/**
 * La cadena de la herencia.
 *
 * El plazo y quién lleva un trabajo se ponen en cualquier escalón y valen para
 * todo lo de abajo. Mientras la estructura tuvo dos niveles alcanzaba con
 * mirar la carpeta y el cliente; con subcarpetas adentro de subcarpetas, mirar
 * dos escalones **se saltea el del medio**, que es justo donde suele estar
 * puesto quién lo lleva. Entonces el aviso le llegaba a la persona equivocada,
 * o a nadie, y eso no se nota mirando la pantalla.
 */
describe("la cadena hasta el cliente", () => {
  it("devuelve el camino entero, de abajo hacia arriba", async () => {
    driveConArbol({
      "archivo-1": ["semana-2"],
      "semana-2": ["septiembre"],
      septiembre: [CLIENTE],
    });

    await expect(cadenaHasta("archivo-1", CLIENTE)).resolves.toEqual([
      "archivo-1",
      "semana-2",
      "septiembre",
      CLIENTE,
    ]);
  });

  it("la carpeta del cliente es su propia cadena", async () => {
    await expect(cadenaHasta(CLIENTE, CLIENTE)).resolves.toEqual([CLIENTE]);
  });

  it("no devuelve nada si no cuelga de ese cliente", async () => {
    // Heredar de un cliente que no es el suyo sería asignarle el trabajo a
    // quien lleva otra cuenta.
    driveConArbol({ "archivo-1": ["ajena-hija"], "ajena-hija": [AJENA] });
    await expect(cadenaHasta("archivo-1", CLIENTE)).resolves.toEqual([]);
  });

  it("no se cuelga con un ciclo", async () => {
    // Drive deja armar rombos con atajos, y una cadena infinita de pedidos a
    // Google se come la cuota antes de que nadie se entere.
    driveConArbol({ a: ["b"], b: ["a"] });
    await expect(cadenaHasta("a", CLIENTE)).resolves.toEqual([]);
  });

  it("corta si el árbol es más hondo que el tope", async () => {
    const arbol: Record<string, string[]> = { hondo: ["n0"] };
    for (let i = 0; i < 9; i++) arbol[`n${i}`] = [`n${i + 1}`];
    arbol.n9 = [CLIENTE];
    driveConArbol(arbol);

    await expect(cadenaHasta("hondo", CLIENTE)).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------

/**
 * La agencia ve todo lo que el robot ve.
 *
 * Cuando las rutas de archivo empezaron a pedir la galleta **del cliente**, la
 * agencia se quedó sin ninguna: el calendario de gestión mostró las miniaturas
 * rotas y no había forma de bajarse un archivo desde adentro de la aplicación.
 * El arreglo fácil habría sido que esas pantallas no pidan permiso, y así es
 * como se abre un agujero: la segunda pantalla que lo necesite lo copia.
 */
describe("la agencia mira con otra vara", () => {
  const comoAgencia = { tipo: "agencia" as const, raices: [CLIENTE], secciones: TODAS };

  beforeEach(() => {
    clientes.mockResolvedValue([cliente(CLIENTE), cliente("otro-cliente")]);
  });

  it("ve el archivo de los clientes que lleva", async () => {
    driveConArbol({ "archivo-1": ["sub"], sub: [CLIENTE] });
    await expect(archivoAutorizado("archivo-1", comoAgencia)).resolves.not.toBeNull();
  });

  it("**no** ve el de un cliente que no lleva", async () => {
    // **Era un agujero y no se veía.** Antes «agencia» quería decir «todos los
    // clientes»: una diseñadora que lleva una sola cuenta se bajaba el archivo
    // de otra con solo conocer su identificador de Drive —que lo ve cualquiera
    // a quien le compartieron la carpeta—. Las raíces son las suyas, y la
    // comprobación es la misma que la del cliente.
    driveConArbol({ "archivo-1": ["sub"], sub: ["otro-cliente"] });
    await expect(archivoAutorizado("archivo-1", comoAgencia)).resolves.toBeNull();
  });

  it("y quien los lleva a todos sigue viéndolos a todos", async () => {
    driveConArbol({ "archivo-1": ["sub"], sub: ["otro-cliente"] });
    await expect(
      archivoAutorizado("archivo-1", {
        tipo: "agencia" as const,
        secciones: TODAS,
        raices: [CLIENTE, "otro-cliente"],
      })
    ).resolves.not.toBeNull();
  });

  it("ve lo que ella misma escondió", async () => {
    // Si esconder algo también se lo sacara a la agencia, no habría dónde
    // volver a prenderlo.
    ESCONDIDOS.add("archivo-1");
    ESCONDIDOS.add("logos");
    driveConArbol({ "archivo-1": ["logos"], logos: [CLIENTE] });
    await expect(archivoAutorizado("archivo-1", comoAgencia)).resolves.not.toBeNull();
  });

  it("ve las facturas, que el cliente no ve nunca", async () => {
    mock.mockImplementation(async (id: string) => ({
      id,
      name: id === "f" ? "Facturas" : id,
      // El que se pide es un archivo; lo que cuelga arriba, carpetas.
      mimeType: id === "archivo-1" ? "image/jpeg" : "application/vnd.google-apps.folder",
      parents: { "archivo-1": ["f"], f: [CLIENTE] }[id],
    }));

    await expect(archivoAutorizado("archivo-1", comoAgencia)).resolves.not.toBeNull();
    await expect(
      archivoAutorizado("archivo-1", comoCliente(CLIENTE)),
      "Las facturas son de la agencia. Que las vea el equipo no las abre al cliente."
    ).resolves.toBeNull();
  });

  it("NO ve lo que no cuelga de ningún cliente", async () => {
    // Que vea todo lo de sus clientes no es que vea todo el Drive del robot:
    // si mañana alguien le comparte otra carpeta, no entra por acá.
    driveConArbol({ "archivo-1": ["ajena-hija"], "ajena-hija": [AJENA] });
    await expect(archivoAutorizado("archivo-1", comoAgencia)).resolves.toBeNull();
  });
});

describe("una carpeta no se sirve como si fuera un archivo", () => {
  // **Pasó, y contestaba de más.** Pedir una carpeta por la puerta de los
  // archivos llegaba hasta el final y reventaba al intentar descargarla: un
  // 502 donde tenía que haber un «no encontrado». Y contestaba **distinto**
  // según el identificador fuera de una carpeta del cliente o de cualquier
  // otra cosa, que es una forma de contar qué existe adentro sin mostrarlo.
  // Una subcarpeta del cliente, con un archivo adentro: el caso en que el
  // identificador de la carpeta es algo que quien pregunta sí puede ver.
  const conUnaSubcarpeta = () => driveConArbol({ "archivo-1": ["sub"], sub: [CLIENTE] });

  it("ni para el cliente", async () => {
    conUnaSubcarpeta();
    await expect(archivoAutorizado("sub", comoCliente(CLIENTE))).resolves.toBeNull();
  });

  it("ni para la agencia", async () => {
    conUnaSubcarpeta();
    await expect(
      archivoAutorizado("sub", {
        tipo: "agencia" as const,
        raices: [CLIENTE],
        secciones: TODAS,
      })
    ).resolves.toBeNull();
  });

  it("y el archivo que cuelga de ella sí", async () => {
    driveConArbol({ "archivo-1": ["sub"], sub: [CLIENTE] });
    await expect(
      archivoAutorizado("archivo-1", comoCliente(CLIENTE))
    ).resolves.not.toBeNull();
  });
});

describe("lo que está en la papelera de Drive no se sirve", () => {
  // Pedido por identificador, Drive contesta igual por lo que está en la
  // papelera, y con sus carpetas madre intactas. Un archivo subido por error a
  // la carpeta de otro cliente y tirado a la papelera se seguía bajando con el
  // link viejo hasta que se vaciara.
  it("ni para el cliente ni para la agencia", async () => {
    mock.mockResolvedValue({ ...archivo([CLIENTE]), trashed: true });

    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
    await expect(
      archivoAutorizado("archivo-1", { tipo: "agencia", raices: [CLIENTE], secciones: TODAS })
    ).resolves.toBeNull();
  });

  it("y lo que no está en la papelera sigue pasando", async () => {
    mock.mockResolvedValue({ ...archivo([CLIENTE]), trashed: false });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.not.toBeNull();
  });
});

describe("lo que se mueve o renombra en Drive se ve a tiempo", () => {
  // El árbol se recordaba cinco minutos, y `google.ts` promete que lo hecho
  // afuera se ve en medio minuto. Mover una carpeta al cliente correcto dejaba
  // al equivocado bajando los originales del otro mientras tanto.
  afterEach(() => {
    vi.useRealTimers();
  });

  it("mover una carpeta a otro cliente cambia quién la ve", async () => {
    vi.useFakeTimers();
    clientes.mockResolvedValue([cliente(CLIENTE), cliente("otro-cliente")]);

    driveConArbol({ "archivo-1": ["trabajo"], trabajo: [CLIENTE] });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.not.toBeNull();

    // La agencia se dio cuenta y la movió en Drive.
    driveConArbol({ "archivo-1": ["trabajo"], trabajo: ["otro-cliente"] });
    vi.advanceTimersByTime(31 * 1000);

    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
    await expect(
      archivoAutorizado("archivo-1", comoCliente("otro-cliente"))
    ).resolves.not.toBeNull();
  });
});

describe("lo que el portal lista, se sirve", () => {
  // El portal baja hasta seis niveles de carpetas (`HONDURA` en
  // portal/datos/cliente.ts) y su comentario promete el mismo tope que el
  // permiso. El permiso cortaba uno antes: la carpeta del sexto nivel se
  // listaba con las miniaturas rotas y sin descarga.
  const seisNiveles = () => {
    const arbol: Record<string, string[]> = { L1: [CLIENTE] };
    for (let i = 2; i <= 6; i++) arbol[`L${i}`] = [`L${i - 1}`];
    return arbol;
  };

  it("un archivo en una carpeta a seis niveles del cliente", async () => {
    driveConArbol({ ...seisNiveles(), "archivo-1": ["L6"] });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.not.toBeNull();
  });

  it("pero uno más abajo que eso, no", async () => {
    driveConArbol({ ...seisNiveles(), L7: ["L6"], "archivo-1": ["L7"] });
    await expect(archivoAutorizado("archivo-1", comoCliente(CLIENTE))).resolves.toBeNull();
  });
});

describe("con dos links de carpeta del mismo cliente abiertos", () => {
  it("los archivos de la segunda carpeta también se sirven", async () => {
    // El archivo cuelga de «septiembre»; el navegador abrió «agosto» primero.
    driveConArbol({ "archivo-1": ["septiembre"], septiembre: [CLIENTE], agosto: [CLIENTE] });

    const soloLaPrimera = { tipo: "cliente" as const, raiz: "agosto" };
    const lasDos = { tipo: "cliente" as const, raiz: "agosto", raices: ["agosto", "septiembre"] };

    expect(await archivoAutorizado("archivo-1", soloLaPrimera)).toBeNull();
    expect(await archivoAutorizado("archivo-1", lasDos)).not.toBeNull();
  });
});
