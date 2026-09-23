import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Drive y la lista de clientes se reemplazan por dobles: acá se prueba una sola
// cosa —que la carpeta de un cliente que Drive no puede leer no se lleve
// puestas a las de los demás—, no la conexión con Google.
vi.mock("@/lib/google", () => ({ subcarpetasDe: vi.fn(), metadatosArchivo: vi.fn() }));
vi.mock("@/lib/clientes", () => ({ clientesHabilitados: vi.fn() }));
// Lo escondido es asunto del almacén; acá se decide con una lista a mano.
// `esCarpetaDeFacturas` queda de verdad: es una función pura.
vi.mock("@/lib/ajustes", async (original) => ({
  ...(await original<typeof import("@/lib/ajustes")>()),
  escondidosEntre: vi.fn(async (ids: string[]) => new Set(ids.filter((i) => ESCONDIDAS.has(i)))),
}));

/** Lo que la agencia apagó, para estas pruebas. */
const ESCONDIDAS = new Set<string>();

import { metadatosArchivo, subcarpetasDe } from "@/lib/google";
import { clientesHabilitados } from "@/lib/clientes";
import {
  clienteDeCarpeta,
  esCarpetaDelCliente,
  idsDeCarpetasReales,
  olvidarCarpetas,
} from "@/lib/carpetas";

const clientes = vi.mocked(clientesHabilitados);
const carpetas = vi.mocked(subcarpetasDe);
const metadatos = vi.mocked(metadatosArchivo);

const cliente = (id: string) =>
  ({ id, nombre: id, habilitado: true, token: `t-${id}`, tag: "", verEnDrive: false, telefono: "" }) as never;

beforeEach(() => {
  olvidarCarpetas();
  vi.clearAllMocks();
  ESCONDIDAS.clear();
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

describe("las subcarpetas más hondas y la raíz también son del cliente", () => {
  // **El árbol y el portal muestran subcarpetas a cualquier hondura, y los
  // archivos sueltos de la raíz; el servidor reconocía solo el primer nivel.**
  // «Calendario / Semana 1» se veía, pero no se podía abrir, entregar ni
  // fechar, y el cliente que tocaba Aprobar ahí recibía «No encontramos esa
  // carpeta.».
  const CARPETA = "application/vnd.google-apps.folder";

  /** Un Drive chico: A → Calendario → Semana1 → Dia1, y A → Facturas → Enero. */
  const DRIVE: Record<string, { name: string; parents: string[]; mimeType?: string }> = {
    Calendario: { name: "Calendario", parents: ["A"] },
    Semana1: { name: "Semana 1", parents: ["Calendario"] },
    Dia1: { name: "Día 1", parents: ["Semana1"] },
    Facturas: { name: "Facturas", parents: ["A"] },
    Enero: { name: "Enero", parents: ["Facturas"] },
    Suelta: { name: "Suelta", parents: ["OtraRaiz"] },
    OtraRaiz: { name: "De nadie", parents: [] },
    archivo: { name: "post.png", parents: ["Semana1"], mimeType: "image/png" },
  };

  beforeEach(() => {
    clientes.mockResolvedValue([cliente("A")]);
    carpetas.mockImplementation(async (id: string) =>
      id === "A"
        ? ([
            { id: "Calendario", name: "Calendario" },
            { id: "Facturas", name: "Facturas" },
          ] as never)
        : ([] as never)
    );
    metadatos.mockImplementation(async (id: string) => {
      const nodo = DRIVE[id];
      if (!nodo) throw new Error("Drive: no encontré el archivo");
      return { id, mimeType: CARPETA, ...nodo } as never;
    });
  });

  it("una subcarpeta de segundo y tercer nivel se reconoce, de los dos lados", async () => {
    expect((await clienteDeCarpeta("Semana1"))?.id).toBe("A");
    expect((await clienteDeCarpeta("Dia1"))?.id).toBe("A");
    expect(await esCarpetaDelCliente("Semana1")).toBe(true);
    expect((await clienteDeCarpeta("Semana1", { comoAgencia: true }))?.id).toBe("A");
  });

  it("la carpeta del cliente misma también: ahí están los archivos sueltos", async () => {
    expect((await clienteDeCarpeta("A"))?.id).toBe("A");
    expect(await esCarpetaDelCliente("A")).toBe(true);
  });

  it("lo que no cuelga de un cliente habilitado sigue sin reconocerse", async () => {
    expect(await clienteDeCarpeta("Suelta")).toBeNull();
    expect(await clienteDeCarpeta("OtraRaiz")).toBeNull();
    expect(await clienteDeCarpeta("no-existe")).toBeNull();
    expect(await clienteDeCarpeta("Suelta", { comoAgencia: true })).toBeNull();
  });

  it("un archivo no es una carpeta", async () => {
    expect(await clienteDeCarpeta("archivo")).toBeNull();
  });

  it("del lado del cliente, «Facturas» no se reconoce a ninguna hondura", async () => {
    expect(await esCarpetaDelCliente("Facturas")).toBe(false);
    expect(await esCarpetaDelCliente("Enero")).toBe(false);
    // La agencia sí: es suya.
    expect((await clienteDeCarpeta("Facturas", { comoAgencia: true }))?.id).toBe("A");
    expect((await clienteDeCarpeta("Enero", { comoAgencia: true }))?.id).toBe("A");
  });

  it("del lado del cliente, lo que cuelga de algo escondido no se reconoce", async () => {
    ESCONDIDAS.add("Calendario");
    expect(await esCarpetaDelCliente("Semana1")).toBe(false);
    expect((await clienteDeCarpeta("Semana1", { comoAgencia: true }))?.id).toBe("A");
  });

  it("más hondo que lo que muestra el portal, no", async () => {
    // Seis escalones es el tope del portal y del permiso: uno más no se sube.
    let madre = "Calendario";
    for (let i = 1; i <= 6; i++) {
      DRIVE[`n${i}`] = { name: `n${i}`, parents: [madre] };
      madre = `n${i}`;
    }

    expect((await clienteDeCarpeta("n5"))?.id, "n5 está a seis escalones").toBe("A");
    expect(await clienteDeCarpeta("n6"), "n6 está a siete").toBeNull();
  });
});
