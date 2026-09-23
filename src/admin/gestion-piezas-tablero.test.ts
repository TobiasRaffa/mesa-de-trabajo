// El tablero, armado de verdad sobre un Drive y un almacén de mentira.
//
// Lo que se prueba es qué cuenta y qué nombra el tablero con lo que ya está
// guardado: Drive, los clientes y los recordatorios se reemplazan por dobles.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { piezasDeLaCarpeta, subcarpetasDe, recordarSiHaceFalta } = vi.hoisted(() => ({
  piezasDeLaCarpeta: vi.fn(),
  subcarpetasDe: vi.fn(),
  recordarSiHaceFalta: vi.fn(async () => null),
}));

vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);
vi.mock("@/admin/datos/clientes", () => ({
  misClientes: vi.fn(async () => [{ id: "cli", nombre: "Café Otoño" }]),
}));
vi.mock("@/lib/conversaciones", () => ({ sinLeerPorCliente: vi.fn(async () => ({})) }));
vi.mock("@/lib/equipo", () => ({ personaPorId: vi.fn(async () => null) }));
vi.mock("@/lib/google", () => ({ subcarpetasDe }));
vi.mock("@/lib/recordatorios", () => ({ recordarSiHaceFalta }));
vi.mock("@/lib/piezas", async (original) => ({
  ...(await original<typeof import("@/lib/piezas")>()),
  piezasDeLaCarpeta,
}));

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const { elTablero } = await import("@/admin/datos/tablero");

const piezas = memoriaDePruebas.ver("piezas");

const CARPETA = "banners";

/** Una ficha guardada, con lo mínimo que hace falta. */
function ficha(parche: Record<string, unknown>) {
  return {
    carpetaId: CARPETA,
    estado: "final",
    ronda: 1,
    rondasExtra: 0,
    cambios: [],
    enviada: false,
    mudada: false,
    historia: [{ id: "h1", que: "entregada", quien: "El equipo", cuando: "2026-09-01T12:00:00Z" }],
    ...parche,
  };
}

const archivo = (id: string, name: string) => ({
  id,
  name,
  mimeType: "image/jpeg",
  modifiedTime: "2026-09-01T10:00:00Z",
});

beforeEach(() => {
  memoriaDePruebas.vaciar();
  recordarSiHaceFalta.mockClear();
  subcarpetasDe.mockImplementation(async (id: string) =>
    id === "cli" ? [{ id: CARPETA, name: "Banners" }] : []
  );
});

describe("el recordatorio de plazo nombra lo que el cliente tiene delante", () => {
  it("la vuelta entregada, no la última que subieron a Drive", async () => {
    // Entregada la V2; después subieron una V3 que todavía no se entregó. El
    // cliente está mirando la V2, y perseguirlo por la v3 es hablarle de algo
    // que nunca recibió.
    piezasDeLaCarpeta.mockResolvedValue([
      archivo("A", "stickers.jpg"),
      archivo("B", "V2 stickers.jpg"),
      archivo("C", "V3 stickers.jpg"),
    ]);
    piezas[`${CARPETA}::stickers.jpg`] = ficha({
      estado: "entregada",
      entregadaEl: new Date().toISOString(),
      versionEntregada: 2,
      archivos: ["A", "B", "C"],
    });

    await elTablero();

    expect(recordarSiHaceFalta).toHaveBeenCalledTimes(1);
    const [pieza] = recordarSiHaceFalta.mock.calls[0] as unknown as [{ detalle: string }];
    expect(pieza.detalle).toBe("la v2 de stickers");
  });
});

describe("lo entregado se cuenta una sola vez", () => {
  it("la ficha que se muda de nombre no cuenta además como aprobada que se fue", async () => {
    // Se borró `stickers.pdf` y quedó `V2 stickers.jpg`: la ficha se muda de
    // `::stickers.pdf` a `::stickers.jpg` en la misma lectura. Si la cuenta de
    // las que se fueron mira antes de la mudanza, ve la clave vieja y suma una
    // entregada que en realidad sigue ahí, aprobada.
    piezasDeLaCarpeta.mockResolvedValue([archivo("B", "V2 stickers.jpg")]);
    piezas[`${CARPETA}::stickers.pdf`] = ficha({
      entregadaEl: "2026-09-01T12:00:00Z",
      versionEntregada: 2,
      archivos: ["A", "B"],
    });

    const { carpetas } = await elTablero();

    expect(carpetas).toHaveLength(1);
    expect(carpetas[0].terminadas, "sigue ahí, aprobada").toBe(1);
    expect(carpetas[0].entregadas, "y no se la cuenta además como entregada").toBe(0);
  });

  it("una aprobada cuya vuelta entregada se fue sale del tablero aunque haya una más alta", async () => {
    // Aprobada la V2, subieron una V3 y la V2 se llevó a «Entregas finales».
    piezasDeLaCarpeta.mockResolvedValue([
      archivo("A", "stickers.jpg"),
      archivo("C", "V3 stickers.jpg"),
    ]);
    piezas[`${CARPETA}::stickers.jpg`] = ficha({
      entregadaEl: "2026-09-01T12:00:00Z",
      versionEntregada: 2,
      archivos: ["A", "B", "C"],
    });

    const { carpetas } = await elTablero();

    // Entregada, la carpeta se vació de trabajo y no va al tablero. Trabada en
    // «Aprobado», aparecía con una terminada para siempre.
    expect(carpetas.find((c) => c.carpetaId === CARPETA)).toBeUndefined();
  });
});
