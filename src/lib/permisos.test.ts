import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Drive se reemplaza por un doble: estas pruebas verifican la decisión de
// permisos, no la conexión con Google.
vi.mock("@/lib/google", () => ({ metadatosArchivo: vi.fn() }));
// Los clientes también se reemplazan: acá se prueba la decisión de permisos,
// no cómo se descubren las carpetas compartidas.
vi.mock("@/lib/clientes", () => ({ clientesHabilitados: vi.fn() }));

import { clientesHabilitados } from "@/lib/clientes";
import { metadatosArchivo } from "@/lib/google";
import { archivoAutorizado, carpetasAdministradas, olvidarElArbol } from "@/lib/permisos";

const CLIENTE = "carpeta-del-cliente";
const AJENA = "carpeta-que-no-administramos";
const mock = vi.mocked(metadatosArchivo);
const clientes = vi.mocked(clientesHabilitados);

const cliente = (id: string) => ({ id, nombre: id, habilitado: true, token: "t-" + id });

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
 */
function driveConArbol(arbol: Record<string, string[]>) {
  mock.mockImplementation(async (id: string) => ({
    id,
    name: id,
    mimeType: "application/vnd.google-apps.folder",
    parents: arbol[id],
  }));
}

beforeEach(() => {
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
    await expect(archivoAutorizado("archivo-1")).resolves.not.toBeNull();
  });

  it("autoriza un archivo que está una carpeta más abajo", async () => {
    // Este es el caso real: «Cafe Otono / Logo - Prueba / 9304.jpeg». Con la
    // regla vieja —mirar solo la carpeta madre— todos los archivos de verdad
    // quedaban afuera y el portal se veía vacío.
    driveConArbol({ "archivo-1": ["subcarpeta"], subcarpeta: [CLIENTE] });
    await expect(archivoAutorizado("archivo-1")).resolves.not.toBeNull();
  });

  it("autoriza aunque esté tres carpetas abajo", async () => {
    driveConArbol({
      "archivo-1": ["nietas"],
      nietas: ["hijas"],
      hijas: [CLIENTE],
    });
    await expect(archivoAutorizado("archivo-1")).resolves.not.toBeNull();
  });

  it("RECHAZA un archivo real de Drive que está fuera de ese árbol", async () => {
    // Este es el caso que importa. La cuenta de servicio puede verlo, pero
    // la aplicación no administra esa carpeta: no se sirve.
    driveConArbol({ "archivo-1": ["ajena-hija"], "ajena-hija": [AJENA] });
    await expect(archivoAutorizado("archivo-1")).resolves.toBeNull();
  });

  it("autoriza si está en varias carpetas y una es administrada", async () => {
    // En Drive un archivo puede tener más de una carpeta madre.
    mock.mockResolvedValue(archivo([AJENA, CLIENTE]));
    await expect(archivoAutorizado("archivo-1")).resolves.not.toBeNull();
  });

  it("rechaza si el archivo no tiene carpeta madre", async () => {
    mock.mockResolvedValue(archivo(undefined));
    await expect(archivoAutorizado("archivo-1")).resolves.toBeNull();
  });

  it("rechaza cuando no hay ningún cliente habilitado", async () => {
    // Una configuración incompleta no puede volverse permiso para todo.
    clientes.mockResolvedValue([]);
    mock.mockResolvedValue(archivo([CLIENTE]));
    await expect(archivoAutorizado("archivo-1")).resolves.toBeNull();
    expect(mock).not.toHaveBeenCalled();
  });

  it("rechaza si Google falla, en vez de dejar pasar", async () => {
    // Ante la duda, no se sirve. Nunca al revés.
    mock.mockRejectedValue(new Error("Drive se cayó"));
    await expect(archivoAutorizado("archivo-1")).resolves.toBeNull();
  });

  it("no deja que un error de Google se propague a la pantalla", async () => {
    mock.mockRejectedValue(new Error("detalle interno que no debe verse"));
    await expect(archivoAutorizado("archivo-1")).resolves.toBeNull();
  });

  it("no se cuelga con un ciclo de carpetas", async () => {
    // Drive deja armar ciclos con atajos. Sin corte, esto sería infinito.
    driveConArbol({ "archivo-1": ["a"], a: ["b"], b: ["a"] });
    await expect(archivoAutorizado("archivo-1")).resolves.toBeNull();
  });

  it("no sube indefinidamente: un árbol muy profundo se corta", async () => {
    // La carpeta administrada está a diez niveles, más allá del tope. Se
    // rechaza, que es el lado seguro del error.
    const arbol: Record<string, string[]> = { "archivo-1": ["n0"] };
    for (let i = 0; i < 9; i++) arbol[`n${i}`] = [`n${i + 1}`];
    arbol.n9 = [CLIENTE];
    driveConArbol(arbol);
    await expect(archivoAutorizado("archivo-1")).resolves.toBeNull();
  });

  it("autoriza un archivo de OTRO cliente habilitado", async () => {
    // Con varios clientes, cada uno aporta su carpeta a la lista.
    clientes.mockResolvedValue([cliente(CLIENTE), cliente("otro-cliente")]);
    driveConArbol({ "archivo-1": ["sub"], sub: ["otro-cliente"] });
    await expect(archivoAutorizado("archivo-1")).resolves.not.toBeNull();
  });

  it("RECHAZA un archivo de un cliente deshabilitado", async () => {
    // Apagar un cliente en gestión le corta el acceso a sus archivos acá
    // mismo, sin tocar Drive.
    clientes.mockResolvedValue([cliente(CLIENTE)]);
    driveConArbol({ "archivo-1": ["sub"], sub: ["cliente-apagado"] });
    await expect(archivoAutorizado("archivo-1")).resolves.toBeNull();
  });

  it("no le pregunta dos veces a Google por la misma carpeta", async () => {
    // Una pantalla con doce miniaturas preguntaría doce veces por la misma
    // carpeta madre. Cada pregunta es un viaje de red.
    driveConArbol({
      "archivo-1": ["subcarpeta"],
      "archivo-2": ["subcarpeta"],
      subcarpeta: [CLIENTE],
    });

    await archivoAutorizado("archivo-1");
    const despuesDelPrimero = mock.mock.calls.length;
    await archivoAutorizado("archivo-2");

    // El segundo archivo cuesta una sola consulta: la del archivo en sí.
    expect(mock.mock.calls.length).toBe(despuesDelPrimero + 1);
  });
});
