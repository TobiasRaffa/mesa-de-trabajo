import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Drive y la lista de clientes se reemplazan por dobles: acá se prueba una sola
// cosa —que la carpeta de un cliente que Drive no puede leer no se lleve
// puestas a las de los demás—, no la conexión con Google.
vi.mock("@/lib/google", () => ({ subcarpetasDe: vi.fn() }));
vi.mock("@/lib/clientes", () => ({ clientesHabilitados: vi.fn() }));

import { subcarpetasDe } from "@/lib/google";
import { clientesHabilitados } from "@/lib/clientes";
import {
  clienteDeCarpeta,
  esCarpetaDelCliente,
  idsDeCarpetasReales,
  olvidarCarpetas,
} from "@/lib/carpetas";

const clientes = vi.mocked(clientesHabilitados);
const carpetas = vi.mocked(subcarpetasDe);

const cliente = (id: string) =>
  ({ id, nombre: id, habilitado: true, token: `t-${id}`, tag: "", verEnDrive: false, telefono: "" }) as never;

beforeEach(() => {
  olvidarCarpetas();
  vi.clearAllMocks();
});
afterEach(() => olvidarCarpetas());

describe("un cliente con Drive caído no tumba a los demás", () => {
  it("las carpetas de los clientes que sí se leen siguen reconociéndose", async () => {
    clientes.mockResolvedValue([cliente("A"), cliente("B")]);
    carpetas.mockImplementation(async (id: string) => {
      if (id === "A") throw new Error("Drive no contesta para A");
      return [{ id: "carpeta-de-B", name: "Trabajo" }] as never;
    });

    // La carpeta de B se reconoce aunque la de A falle: antes, con `Promise.all`,
    // el error de A rechazaba todo y B quedaba tan invisible como A.
    expect(await esCarpetaDelCliente("carpeta-de-B")).toBe(true);
    expect((await clienteDeCarpeta("carpeta-de-B"))?.id).toBe("B");

    // La del cliente que falló no se inventa: se trata como no reconocida
    // —cerrado, no abierto—, igual que si no existiera.
    expect(await esCarpetaDelCliente("carpeta-de-A")).toBe(false);
    expect(await clienteDeCarpeta("carpeta-de-A")).toBeNull();
  });

  it("si Drive falla para todos, no se reconoce nada, pero no revienta", async () => {
    clientes.mockResolvedValue([cliente("A")]);
    carpetas.mockRejectedValue(new Error("Drive caído"));

    expect(await idsDeCarpetasReales()).toEqual(new Set());
    expect(await esCarpetaDelCliente("lo-que-sea")).toBe(false);
  });
});
