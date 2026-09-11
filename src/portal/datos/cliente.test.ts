// Qué llega al portal, y sobre todo qué no.
//
// Estas pruebas existen por dos cosas que pasaron:
//
//   - **El portal miraba un solo nivel.** Si la agencia armaba
//     «Calendario septiembre / Semana 1», el cliente no veía nada de adentro,
//     y desde gestión tampoco: los archivos estaban en Drive y no existían
//     para nadie.
//   - **«Oculto» era un adorno.** Apagar algo dejaba de dibujarlo y nada más.
//
// No se puede probar con el Drive de la agencia —habría que crear carpetas de
// mentira en su cuenta—, así que Drive se reemplaza por un doble y se prueba
// la decisión, que es lo nuestro.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/google", () => ({
  datosDeCarpeta: vi.fn(),
  subcarpetasDe: vi.fn(),
}));
vi.mock("@/lib/piezas", () => ({
  piezasDeLaCarpeta: vi.fn(),
  estadosDe: vi.fn(),
}));
vi.mock("@/lib/publicaciones", async (original) => ({
  ...(await original<typeof import("@/lib/publicaciones")>()),
  publicacionesDe: vi.fn(async () => ({})),
}));
vi.mock("@/lib/ajustes", async (original) => ({
  ...(await original<typeof import("@/lib/ajustes")>()),
  ajustesDe: vi.fn(async () => ({ visible: true, vista: "lista" as const })),
  escondidosEntre: vi.fn(async (ids: string[]) => new Set(ids.filter((i) => ESCONDIDOS.has(i)))),
  soloLoVisible: vi.fn(async (cosas: Array<{ id: string }>) =>
    cosas.filter((c) => !ESCONDIDOS.has(c.id))
  ),
}));

import { datosDeCarpeta, subcarpetasDe } from "@/lib/google";
import { estadosDe, piezasDeLaCarpeta } from "@/lib/piezas";
import { portalDelCliente } from "@/portal/datos/cliente";

/** Lo que la agencia apagó, en esta prueba. */
const ESCONDIDOS = new Set<string>();

const RAIZ = "cliente";

/** Un Drive de mentira: qué cuelga de qué, y qué archivos tiene cada carpeta. */
function driveCon(
  carpetas: Record<string, Array<{ id: string; name: string }>>,
  archivos: Record<string, string[]>
) {
  vi.mocked(datosDeCarpeta).mockImplementation(async (id: string) => ({
    id,
    name: id === RAIZ ? "Cafe Otono" : id,
  }));
  vi.mocked(subcarpetasDe).mockImplementation(async (id: string) =>
    (carpetas[id] ?? []).map((c) => ({ ...c, webViewLink: undefined }))
  );
  vi.mocked(piezasDeLaCarpeta).mockImplementation(async (id: string) =>
    (archivos[id] ?? []).map((nombre) => ({
      id: `${id}:${nombre}`,
      name: nombre,
      mimeType: "image/jpeg",
      modifiedTime: "2026-09-01T10:00:00Z",
    }))
  );
  vi.mocked(estadosDe).mockImplementation(async (_carpeta: string, ids: string[]) =>
    Object.fromEntries(
      ids.map((id) => [
        id,
        {
          carpetaId: _carpeta,
          estado: "entregada" as const,
          ronda: 0,
          rondasExtra: 0,
          cambios: [],
          enviada: false,
          mudada: false,
          historia: [],
        },
      ])
    )
  );
}

const nombres = (c: Array<{ nombre: string }>) => c.map((x) => x.nombre).sort();

beforeEach(() => {
  ESCONDIDOS.clear();
  vi.clearAllMocks();
});

describe("el portal baja hasta donde haga falta", () => {
  it("muestra los archivos de una subcarpeta, con el camino en el nombre", async () => {
    driveCon(
      {
        [RAIZ]: [{ id: "sept", name: "Calendario septiembre" }],
        sept: [{ id: "s1", name: "Semana 1" }],
      },
      { s1: ["9304.jpeg"] }
    );

    const portal = await portalDelCliente(RAIZ);

    expect(
      nombres(portal.carpetas),
      "Los archivos de una subcarpeta tienen que llegar al cliente. Antes se " +
        "miraba un solo nivel y quedaban invisibles para todos."
    ).toEqual(["Calendario septiembre / Semana 1"]);
  });

  it("llega a tres niveles de hondura", async () => {
    driveCon(
      {
        [RAIZ]: [{ id: "a", name: "Marca" }],
        a: [{ id: "b", name: "Papelería" }],
        b: [{ id: "c", name: "Tarjetas" }],
      },
      { c: ["frente.jpeg"] }
    );

    expect(nombres(await portalDelCliente(RAIZ).then((p) => p.carpetas))).toEqual([
      "Marca / Papelería / Tarjetas",
    ]);
  });

  it("distingue dos subcarpetas con el mismo nombre", async () => {
    // «Semana 1» de septiembre y «Semana 1» de octubre no son la misma, y en
    // una lista llana sin el camino serían dos renglones idénticos.
    driveCon(
      {
        [RAIZ]: [
          { id: "sept", name: "Septiembre" },
          { id: "oct", name: "Octubre" },
        ],
        sept: [{ id: "s1", name: "Semana 1" }],
        oct: [{ id: "o1", name: "Semana 1" }],
      },
      { s1: ["a.jpeg"], o1: ["b.jpeg"] }
    );

    expect(nombres(await portalDelCliente(RAIZ).then((p) => p.carpetas))).toEqual([
      "Octubre / Semana 1",
      "Septiembre / Semana 1",
    ]);
  });

  it("muestra los archivos sueltos de la carpeta del cliente", async () => {
    // Antes no se miraban: un archivo dejado ahí no lo veía nadie.
    driveCon({ [RAIZ]: [] }, { [RAIZ]: ["brief.jpeg"] });

    expect(nombres(await portalDelCliente(RAIZ).then((p) => p.carpetas))).toEqual([
      "Cafe Otono",
    ]);
  });
});

describe("lo escondido no llega al portal", () => {
  it("una subcarpeta escondida se lleva lo que tiene adentro", async () => {
    ESCONDIDOS.add("s1");
    driveCon(
      {
        [RAIZ]: [{ id: "sept", name: "Calendario septiembre" }],
        sept: [
          { id: "s1", name: "Semana 1" },
          { id: "s2", name: "Semana 2" },
        ],
      },
      { s1: ["a.jpeg"], s2: ["b.jpeg"] }
    );

    expect(nombres(await portalDelCliente(RAIZ).then((p) => p.carpetas))).toEqual([
      "Calendario septiembre / Semana 2",
    ]);
  });

  it("esconder la de arriba esconde las de abajo", async () => {
    ESCONDIDOS.add("sept");
    driveCon(
      {
        [RAIZ]: [{ id: "sept", name: "Septiembre" }],
        sept: [{ id: "s1", name: "Semana 1" }],
      },
      { s1: ["a.jpeg"] }
    );

    expect(
      await portalDelCliente(RAIZ).then((p) => p.carpetas),
      "Si no, apagar una carpeta obligaría a apagar a mano cada cosa de adentro."
    ).toEqual([]);
  });

  it("un archivo escondido no aparece, aunque su carpeta se muestre", async () => {
    ESCONDIDOS.add("logos:secreto.jpeg");
    driveCon(
      { [RAIZ]: [{ id: "logos", name: "Logos" }] },
      { logos: ["secreto.jpeg", "9304.jpeg"] }
    );

    const portal = await portalDelCliente(RAIZ);
    expect(portal.carpetas[0].piezas.map((p) => p.nombre)).toEqual(["9304"]);
  });

  it("esconder todas las vueltas de una pieza la saca entera", async () => {
    // Una pieza son varios archivos. Si solo se esconde la última, el cliente
    // seguiría viendo la V1 de algo que la agencia creyó haber escondido.
    ESCONDIDOS.add("logos:9304.jpeg");
    ESCONDIDOS.add("logos:9304 V2.jpeg");
    driveCon(
      { [RAIZ]: [{ id: "logos", name: "Logos" }] },
      { logos: ["9304.jpeg", "9304 V2.jpeg"] }
    );

    expect(await portalDelCliente(RAIZ).then((p) => p.carpetas)).toEqual([]);
  });

  it("una carpeta sin nada visible no se muestra vacía", async () => {
    ESCONDIDOS.add("logos:unico.jpeg");
    driveCon({ [RAIZ]: [{ id: "logos", name: "Logos" }] }, { logos: ["unico.jpeg"] });

    expect(await portalDelCliente(RAIZ).then((p) => p.carpetas)).toEqual([]);
  });
});
