// Lo que las acciones del portal le devuelven al navegador.
//
// `portalDelCliente` elige a mano qué campos de cada pieza viajan (hay una
// prueba para eso), y las acciones se lo salteaban: devolvían la ficha entera
// —la historia con el nombre de quien del equipo hizo cada cosa, los ids de
// Drive de vueltas no entregadas— y `enviarRevision`, además, el estado de
// **todos** los archivos de la carpeta, con el nombre de cada uno en la clave.
// La respuesta de una acción se lee en la pestaña Red del navegador.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const guardado = memoriaDePruebas.ver("piezas");
vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);

// Quién entró: el cliente, por su link. Las galletas y la llave no son lo que
// se prueba acá.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/acceso", () => ({
  entradaDe: vi.fn(async () => ({ cliente: { id: "cli", nombre: "Cafe Otono" } })),
}));
vi.mock("@/lib/carpetas", () => ({
  clienteDeCarpeta: vi.fn(async () => ({ id: "cli", nombre: "Cafe Otono" })),
  esCarpetaDelCliente: vi.fn(async () => true),
}));
vi.mock("@/lib/permisos", () => ({ cadenaHasta: vi.fn(async () => []) }));
vi.mock("@/lib/avisar", () => ({ avisar: vi.fn(async () => {}) }));
vi.mock("@/lib/conversaciones", async (original) => ({
  ...(await original<typeof import("@/lib/conversaciones")>()),
  anotarHito: vi.fn(async () => {}),
}));

const ARCHIVOS = [
  { id: "f-listo", name: "listo.jpeg", mimeType: "image/jpeg" },
  // La V2 que el equipo subió y todavía no entregó.
  { id: "f-listo2", name: "listo V2.jpeg", mimeType: "image/jpeg" },
  { id: "f-borrador", name: "borrador secreto.jpeg", mimeType: "image/jpeg" },
  { id: "f-planilla", name: "presupuesto interno cliente.xlsx", mimeType: "application/vnd.ms-excel" },
];
vi.mock("@/lib/google", () => ({
  archivosDe: vi.fn(async () => ARCHIVOS),
  metadatosArchivo: vi.fn(),
  datosDeCarpeta: vi.fn(async (id: string) => ({ id, name: "Logos" })),
}));

const { moverPieza, guardarCambiosDePieza, enviarRevision } = await import("@/portal/acciones");
const { entradaDe } = await import("@/lib/acceso");

const CARPETA = "logos";
const PIEZA = "logos::listo.jpeg";

/** Los únicos campos que la pantalla usa de lo que vuelve. */
const PERMITIDOS = ["estado", "ronda", "rondasExtra", "cambios", "enviada"];

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
  guardado[PIEZA] = {
    carpetaId: CARPETA,
    estado: "entregada",
    ronda: 0,
    rondasExtra: 0,
    cambios: [],
    enviada: false,
    mudada: false,
    archivos: ["f-listo", "f-listo2"],
    versionEntregada: 1,
    entregadaEl: "2026-09-01T13:00:00.000Z",
    historia: [
      {
        id: "h1",
        que: "entregada",
        cuando: "2026-09-01T13:00:00.000Z",
        quien: "Nari Disenadora",
        detalle: "no_se_pudo_devolver: Drive 403 robot@proyecto.iam.gserviceaccount.com",
      },
    ],
  };
});

describe("las acciones del portal devuelven solo lo que la pantalla usa", () => {
  it("mover una pieza no devuelve la historia ni los archivos", async () => {
    const r = await moverPieza(CARPETA, PIEZA, { tipo: "abrir" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(Object.keys(r.pieza).sort()).toEqual([...PERMITIDOS].sort());
    const texto = JSON.stringify(r);
    expect(texto).not.toContain("Nari Disenadora");
    expect(texto, "El id de la V2 no entregada se puede bajar por /api/archivo").not.toContain(
      "f-listo2"
    );
  });

  it("escribir cambios tampoco", async () => {
    const r = await guardarCambiosDePieza(CARPETA, PIEZA, [{ id: "c1", texto: "más grande" }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(Object.keys(r.pieza).sort()).toEqual([...PERMITIDOS].sort());
    expect(JSON.stringify(r)).not.toContain("Nari Disenadora");
  });

  it("enviar la revisión no devuelve el resto de la carpeta", async () => {
    await guardarCambiosDePieza(CARPETA, PIEZA, [{ id: "c1", texto: "más grande" }]);

    const r = await enviarRevision(CARPETA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.cuantas).toBe(1);
    expect(Object.keys(r.piezas)).toEqual([PIEZA]);
    expect(Object.keys(r.piezas[PIEZA]).sort()).toEqual([...PERMITIDOS].sort());

    const texto = JSON.stringify(r);
    expect(texto).not.toContain("borrador secreto");
    expect(texto).not.toContain("presupuesto interno");
    expect(texto).not.toContain("robot@proyecto");
    expect(texto).not.toContain("Nari Disenadora");
  });
});

describe("con dos links de carpeta del mismo cliente, andan las dos", () => {
  const cliente = {
    id: "cli",
    nombre: "Cafe Otono",
    habilitado: true,
    token: "t",
    tag: "t",
    verEnDrive: false,
    telefono: "",
  };

  it("la segunda carpeta también acepta las acciones", async () => {
    // Las galletas viajan todas juntas; quedándose con la primera, la segunda
    // carpeta abría y todos sus botones contestaban «No encontramos esa
    // carpeta.».
    vi.mocked(entradaDe).mockResolvedValueOnce({
      cliente,
      carpeta: "sept",
      carpetas: ["sept", CARPETA],
    });

    const r = await moverPieza(CARPETA, PIEZA, { tipo: "abrir" });
    expect(r.ok).toBe(true);
  });

  it("una carpeta cuyo link no abrió sigue afuera", async () => {
    vi.mocked(entradaDe).mockResolvedValueOnce({ cliente, carpeta: "sept", carpetas: ["sept"] });

    const r = await moverPieza(CARPETA, PIEZA, { tipo: "abrir" });
    expect(r).toEqual({ ok: false, motivo: "No encontramos esa carpeta." });
  });
});

describe("un pedido que vino de Drive y el cliente corrigió en el portal", () => {
  it("se vuelve suyo: deja de seguir al comentario y no se pisa en la carga siguiente", async () => {
    // Un pedido copiado de un comentario de Drive, ya en la lista.
    guardado[PIEZA] = {
      ...(guardado[PIEZA] as object),
      estado: "cambios_marcados",
      cambios: [{ id: "drive:c1", texto: "V1 · Cambiar el verde" }],
      comentariosCopiados: ["c1"],
    };

    const r = await guardarCambiosDePieza(CARPETA, PIEZA, [
      { id: "drive:c1", texto: "Cambiar el verde por el azul de la marca" },
    ]);

    expect(r.ok).toBe(true);
    const cambios = (guardado[PIEZA] as { cambios: Array<{ id: string; texto: string }> }).cambios;
    // Con otro id: la sincronización con Drive solo toca los `drive:*`.
    expect(cambios).toEqual([{ id: "corregido:c1", texto: "Cambiar el verde por el azul de la marca" }]);
    // Y el comentario sigue anotado como copiado: no vuelve a entrar repetido.
    expect((guardado[PIEZA] as { comentariosCopiados: string[] }).comentariosCopiados).toContain("c1");
  });

  it("si el texto no cambió, sigue siendo el de Drive", async () => {
    guardado[PIEZA] = {
      ...(guardado[PIEZA] as object),
      estado: "cambios_marcados",
      cambios: [{ id: "drive:c1", texto: "V1 · Cambiar el verde" }],
      comentariosCopiados: ["c1"],
    };

    await guardarCambiosDePieza(CARPETA, PIEZA, [{ id: "drive:c1", texto: "V1 · Cambiar el verde" }]);

    const cambios = (guardado[PIEZA] as { cambios: Array<{ id: string }> }).cambios;
    expect(cambios.map((c) => c.id)).toEqual(["drive:c1"]);
  });
});

describe("dos cambios con el mismo id", () => {
  // Lo que llega lo arma el navegador; un reintento o un pedido armado a mano
  // podía traer dos con el mismo id. Se guardaban los dos, y la cuenta de «cada
  // cambio es uno» se rompía. Se juntan por id y gana el último texto.
  it("quedan uno solo, con el último texto", async () => {
    const r = await guardarCambiosDePieza(CARPETA, PIEZA, [
      { id: "c1", texto: "primero" },
      { id: "c1", texto: "segundo" },
    ]);

    expect(r.ok).toBe(true);
    const cambios = (guardado[PIEZA] as { cambios: Array<{ id: string; texto: string }> }).cambios;
    expect(cambios).toEqual([{ id: "c1", texto: "segundo" }]);
  });
});

describe("el aviso al equipo nombra el trabajo, no el archivo", () => {
  it("«aprobó la v1 de listo», no «la v1 de listo.jpeg» ni «la v2 de V2_…»", async () => {
    const { avisar } = await import("@/lib/avisar");
    vi.mocked(avisar).mockClear();
    const r = await moverPieza(CARPETA, PIEZA, { tipo: "aprobar", por: "Lu" });
    expect(r.ok).toBe(true);
    const detalle = vi.mocked(avisar).mock.calls.at(-1)?.[0].detalle ?? "";
    expect(detalle).toMatch(/^la v1 de listo\b/);
    expect(detalle).not.toContain(".jpeg");
  });
});
