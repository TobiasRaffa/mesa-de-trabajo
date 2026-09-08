import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Drive se reemplaza por un doble: estas pruebas verifican la decisión de
// permisos, no la conexión con Google.
vi.mock("@/lib/google", () => ({ metadatosArchivo: vi.fn() }));

import { metadatosArchivo } from "@/lib/google";
import { archivoAutorizado, carpetasAdministradas } from "@/lib/permisos";

const ADMINISTRADA = "carpeta-que-administramos";
const AJENA = "carpeta-que-no-administramos";
const mock = vi.mocked(metadatosArchivo);

const archivo = (parents: string[] | undefined) => ({
  id: "archivo-1",
  name: "01_boceto.jpg",
  mimeType: "image/jpeg",
  parents,
});

beforeEach(() => {
  mock.mockReset();
  process.env.DRIVE_TEST_FOLDER = ADMINISTRADA;
});
afterEach(() => {
  delete process.env.DRIVE_TEST_FOLDER;
});

describe("carpetasAdministradas", () => {
  it("está vacía si no hay ninguna configurada", () => {
    delete process.env.DRIVE_TEST_FOLDER;
    expect(carpetasAdministradas()).toEqual([]);
  });
});

describe("archivoAutorizado", () => {
  it("autoriza un archivo que está en una carpeta administrada", async () => {
    mock.mockResolvedValue(archivo([ADMINISTRADA]));
    await expect(archivoAutorizado("archivo-1")).resolves.not.toBeNull();
  });

  it("RECHAZA un archivo real de Drive que está fuera de esas carpetas", async () => {
    // Este es el caso que importa. La cuenta de servicio puede verlo, pero
    // la aplicación no administra esa carpeta: no se sirve.
    mock.mockResolvedValue(archivo([AJENA]));
    await expect(archivoAutorizado("archivo-1")).resolves.toBeNull();
  });

  it("autoriza si está en varias carpetas y una es administrada", async () => {
    // En Drive un archivo puede tener más de una carpeta madre.
    mock.mockResolvedValue(archivo([AJENA, ADMINISTRADA]));
    await expect(archivoAutorizado("archivo-1")).resolves.not.toBeNull();
  });

  it("rechaza si el archivo no tiene carpeta madre", async () => {
    mock.mockResolvedValue(archivo(undefined));
    await expect(archivoAutorizado("archivo-1")).resolves.toBeNull();
  });

  it("rechaza cuando no hay ninguna carpeta configurada", async () => {
    // Una configuración incompleta no puede volverse permiso para todo.
    delete process.env.DRIVE_TEST_FOLDER;
    mock.mockResolvedValue(archivo([ADMINISTRADA]));
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
});
