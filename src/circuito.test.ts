// El circuito entero, de punta a punta: entregar → revisar → pedir cambios →
// V2 → asignarla → entregarla → aprobar.
//
// **Los bugs más caros de la aplicación no estuvieron adentro de un módulo,
// sino en las uniones**: gestión guardaba una cosa y el portal leía otra, el
// tablero contaba con una regla y la ventana con otra. Cada módulo tiene sus
// pruebas y pasaban todas. Esta prueba recorre lo que recorre una pieza de
// verdad, con las acciones reales de los dos lados, las pantallas reales del
// portal y del árbol, y el almacén de memoria —que cumple el contrato entero—.
//
// Lo único reemplazado es lo de afuera: Drive (una carpeta en memoria, a la que
// se le suben archivos como lo haría el equipo), las galletas y quién está
// mirando. Todo lo del medio es el código de producción.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Archivo = { id: string; name: string; mimeType: string; modifiedTime: string };

const drive = vi.hoisted(() => ({
  carpetas: {} as Record<string, Archivo[]>,
  subir(carpeta: string, id: string, name: string) {
    (this.carpetas[carpeta] ??= []).push({
      id,
      name,
      mimeType: "image/jpeg",
      modifiedTime: new Date().toISOString(),
    });
  },
}));

const CLIENTE = { id: "raiz-cafe", nombre: "Café Otoño" };
const CARPETA = "trabajo-sept";
const PIEZA = `${CARPETA}::stickers.jpg`;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);

// Drive: una carpeta del cliente con una carpeta de trabajo adentro.
vi.mock("@/lib/google", async (original) => ({
  ...(await original<typeof import("@/lib/google")>()),
  archivosDe: vi.fn(async (id: string) => [...(drive.carpetas[id] ?? [])]),
  listarCarpeta: vi.fn(async (id: string) => [...(drive.carpetas[id] ?? [])]),
  subcarpetasDe: vi.fn(async (id: string) =>
    id === CLIENTE.id ? [{ id: CARPETA, name: "Septiembre" }] : []
  ),
  datosDeCarpeta: vi.fn(async (id: string) => ({
    id,
    name: id === CLIENTE.id ? CLIENTE.nombre : "Septiembre",
  })),
  metadatosArchivo: vi.fn(async (id: string) => {
    for (const [carpeta, archivos] of Object.entries(drive.carpetas)) {
      const a = archivos.find((x) => x.id === id);
      if (a) return { ...a, parents: [carpeta] };
    }
    throw new Error("no está");
  }),
  comentariosDeArchivo: vi.fn(async () => []),
  carpetasCompartidas: vi.fn(async () => [{ id: CLIENTE.id, name: CLIENTE.nombre }]),
  renombrarArchivo: vi.fn(async () => {}),
}));

// Del lado de la agencia: una sesión que puede todo y ve a este cliente.
vi.mock("@/lib/sesion", () => ({
  puedoAlgunaDe: vi.fn(async () => true),
  puedoVer: vi.fn(async () => true),
  firmaDeAgencia: vi.fn(async () => "Nari"),
  contrasenaDeQuienEsta: vi.fn(async () => true),
}));
vi.mock("@/admin/datos/clientes", () => ({
  esCarpetaMia: vi.fn(async () => true),
  clienteDeMiCarpeta: vi.fn(async () => CLIENTE),
  miCliente: vi.fn(async () => CLIENTE),
  misCarpetas: vi.fn(async () => new Set([CARPETA])),
  misClientes: vi.fn(async () => [CLIENTE]),
  todosMisClientes: vi.fn(async () => [CLIENTE]),
  esDeMisClientes: vi.fn(async () => true),
  misAvisos: vi.fn(async () => []),
}));

// Del lado del cliente: entró por su link con su clave.
vi.mock("@/lib/acceso", () => ({ entradaDe: vi.fn(async () => ({ cliente: CLIENTE })) }));
vi.mock("@/lib/carpetas", async (original) => ({
  ...(await original<typeof import("@/lib/carpetas")>()),
  clienteDeCarpeta: vi.fn(async () => CLIENTE),
  esCarpetaDelCliente: vi.fn(async () => true),
}));

// Los avisos se miran, no se mandan.
vi.mock("@/lib/avisar", () => ({ avisar: vi.fn(async () => true) }));
vi.mock("@/lib/conversaciones", async (original) => ({
  ...(await original<typeof import("@/lib/conversaciones")>()),
  anotarHito: vi.fn(async () => {}),
}));

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const { avisar } = await import("@/lib/avisar");
const gestion = await import("@/app/(admin)/gestion/acciones");
const portal = await import("@/portal/acciones");
const { portalDelCliente } = await import("@/portal/datos/cliente");
const { elTablero } = await import("@/admin/datos/tablero");

/** Lo que el cliente tiene delante, leído por la pantalla del portal. */
async function loQueVeElCliente() {
  const { carpetas } = await portalDelCliente(CLIENTE.id);
  const pieza = carpetas.flatMap((c) => c.piezas).find((p) => p.id === PIEZA);
  expect(pieza, "El cliente no ve la pieza").toBeDefined();
  return pieza!;
}

/** Lo que ve la agencia en el árbol de clientes. */
async function loQueVeLaAgencia() {
  const r = await gestion.abrirCarpeta(CARPETA, { dias: 3, responsable: null });
  if (!r.ok) throw new Error(r.motivo);
  const archivo = r.contenido.archivos.find((a) => a.id === PIEZA);
  expect(archivo, "La agencia no ve la pieza").toBeDefined();
  return archivo!;
}

const guardada = () =>
  memoriaDePruebas.ver("piezas")[PIEZA] as {
    estado: string;
    versionEntregada?: number;
    archivoEntregado?: string;
    cambios: unknown[];
    historia: Array<{ que: string; detalle?: string }>;
  };

const avisos = () => vi.mocked(avisar).mock.calls.map(([a]) => a.clase);

beforeEach(() => {
  memoriaDePruebas.vaciar();
  drive.carpetas = {};
  vi.mocked(avisar).mockClear();
});

describe("una pieza de punta a punta", () => {
  it("entregar → revisar → pedir cambios → V2 → aprobar", async () => {
    // --- El equipo sube la V1 y la entrega. -------------------------------
    drive.subir(CARPETA, "f-v1", "stickers.jpg");
    expect((await loQueVeLaAgencia()).estado).toBe("en_curso");

    const primera = await gestion.entregarCarpeta(CARPETA);
    expect(primera).toMatchObject({ ok: true, entregadas: 1 });
    expect(guardada()).toMatchObject({
      estado: "entregada",
      versionEntregada: 1,
      archivoEntregado: "f-v1",
    });

    // --- El cliente la ve, la abre y pide cambios. -------------------------
    let vista = await loQueVeElCliente();
    expect(vista.estado).toBe("entregada");
    expect(vista.driveFileId).toBe("f-v1");

    expect((await portal.moverPieza(CARPETA, PIEZA, { tipo: "abrir" })).ok).toBe(true);
    const escrito = await portal.guardarCambiosDePieza(CARPETA, PIEZA, [
      { id: "c1", texto: "El logo más grande" },
    ]);
    expect(escrito.ok).toBe(true);

    // Mientras escribe, el equipo sube algo que todavía no le entregó: el
    // cliente sigue viendo lo que se le entregó.
    drive.subir(CARPETA, "f-v2", "stickers V2.jpg");
    vista = await loQueVeElCliente();
    expect(vista.driveFileId, "El cliente ve una vuelta que nadie le entregó").toBe("f-v1");
    expect(vista.versiones.map((v) => v.numero)).toEqual([1]);

    const enviada = await portal.enviarRevision(CARPETA);
    expect(enviada).toMatchObject({ ok: true, cuantas: 1 });
    expect(avisos()).toContain("envio_revision");

    // --- Del lado de la agencia: es nuestra, y hay una V2 esperando. -----
    const deVuelta = await loQueVeLaAgencia();
    expect(["en_curso", "cambios_marcados"]).toContain(deVuelta.estado);
    const [fila] = (await elTablero()).carpetas;
    expect(fila.cancha).toBe("sin_entregar");

    // La V2 no se sumó sola: espera que alguien diga de qué trabajo es, con
    // «stickers» como sugerencia. Hasta entonces no hay nada que entregar.
    const abierta = await gestion.abrirCarpeta(CARPETA, { dias: 3, responsable: null });
    if (!abierta.ok) throw new Error(abierta.motivo);
    expect(abierta.contenido.pendientes).toEqual([
      expect.objectContaining({ id: "f-v2", numero: 2, sugerida: PIEZA }),
    ]);
    expect(await gestion.entregarCarpeta(CARPETA)).toMatchObject({ ok: false });

    expect(await gestion.asignarVueltaDeCarpeta(CARPETA, "f-v2", PIEZA)).toEqual({ ok: true });

    // --- Se entrega la V2: la revisión arranca de cero. -------------------
    const segunda = await gestion.entregarCarpeta(CARPETA);
    expect(segunda).toMatchObject({ ok: true, entregadas: 1 });
    expect(guardada()).toMatchObject({
      estado: "entregada",
      versionEntregada: 2,
      archivoEntregado: "f-v2",
      cambios: [],
    });
    // Lo que pidió no se perdió: está junto a la entrega que lo contesta.
    expect(guardada().historia.at(-1)).toMatchObject({ que: "entregada" });
    expect(guardada().historia.at(-1)!.detalle).toContain("El logo más grande");

    vista = await loQueVeElCliente();
    expect(vista.driveFileId).toBe("f-v2");
    expect(vista.versiones.map((v) => v.numero)).toEqual([1, 2]);

    // Alguien sube otro archivo que también dice ser la V2: espera, el cliente
    // sigue viendo el que se le entregó, y no se lo puede sumar como otra V2.
    drive.subir(CARPETA, "f-v2-otra", "V2 stickers.jpg");
    expect((await loQueVeElCliente()).driveFileId).toBe("f-v2");
    const repetida = await gestion.asignarVueltaDeCarpeta(CARPETA, "f-v2-otra", PIEZA);
    expect(repetida.ok).toBe(false);
    if (!repetida.ok) expect(repetida.motivo).toContain("ya tiene una V2");
    // Mientras esté ahí sin asignar, la carpeta sigue pidiendo atención. La
    // sacan de Drive, que es lo que corresponde con un duplicado.
    drive.carpetas[CARPETA] = drive.carpetas[CARPETA].filter((a) => a.id !== "f-v2-otra");

    // --- El cliente aprueba. ----------------------------------------------
    const aprobada = await portal.moverPieza(CARPETA, PIEZA, { tipo: "aprobar", por: "Lu" });
    expect(aprobada.ok).toBe(true);
    expect(guardada().estado).toBe("final");
    expect(avisos()).toContain("aprobo");

    expect((await loQueVeElCliente()).estado).toBe("final");
    expect((await loQueVeLaAgencia()).estado).toBe("final");
    const [alFinal] = (await elTablero()).carpetas;
    expect(alFinal.cancha).toBe("listo");
  });

  it("devolver sin que haya una vuelta nueva no le reenvía lo mismo", async () => {
    drive.subir(CARPETA, "f-v1", "stickers.jpg");
    await gestion.entregarCarpeta(CARPETA);
    await portal.moverPieza(CARPETA, PIEZA, { tipo: "abrir" });
    await portal.guardarCambiosDePieza(CARPETA, PIEZA, [{ id: "c1", texto: "Otro color" }]);
    await portal.enviarRevision(CARPETA);

    // Entregar la tanda sin haber subido nada nuevo: no se le manda nada.
    expect(await gestion.entregarCarpeta(CARPETA)).toEqual({
      ok: false,
      motivo: "No hay nada sin entregar en esta carpeta.",
    });
    expect(guardada().versionEntregada).toBe(1);
  });

  it("si el archivo entregado desaparece de Drive, la agencia se entera", async () => {
    drive.subir(CARPETA, "f-v1", "stickers.jpg");
    drive.subir(CARPETA, "f-v2", "stickers V2.jpg");
    await gestion.asignarVueltaDeCarpeta(CARPETA, "f-v2", PIEZA);
    await gestion.entregarCarpeta(CARPETA);
    expect(guardada().archivoEntregado).toBe("f-v2");

    // Alguien borra la V2 en Drive mientras el cliente la está revisando.
    drive.carpetas[CARPETA] = drive.carpetas[CARPETA].filter((a) => a.id !== "f-v2");
    expect((await loQueVeLaAgencia()).entregadoPerdido).toBe(true);
    // Y el cliente, en vez de quedarse sin nada, ve la vuelta que queda.
    expect((await loQueVeElCliente()).driveFileId).toBe("f-v1");
  });

  it("«no es una vuelta»: el archivo pasa a ser un trabajo propio", async () => {
    drive.subir(CARPETA, "f-v1", "stickers.jpg");
    drive.subir(CARPETA, "f-hario", "Hario V60.jpg");
    expect(await gestion.asignarVueltaDeCarpeta(CARPETA, "f-hario", null)).toEqual({ ok: true });

    const r = await gestion.abrirCarpeta(CARPETA, { dias: 3, responsable: null });
    if (!r.ok) throw new Error(r.motivo);
    expect(r.contenido.pendientes).toEqual([]);
    expect(r.contenido.archivos.map((a) => a.id)).toEqual([PIEZA, `${CARPETA}::Hario V60.jpg`]);
  });

  it("unir dos trabajos se anota en la aplicación, sin renombrar nada en Drive", async () => {
    drive.subir(CARPETA, "f-pdf", "stickers.jpg");
    drive.subir(CARPETA, "f-png", "stickers.png");
    const { renombrarArchivo } = await import("@/lib/google");

    expect(await gestion.unirConLaOtra(CARPETA, `${CARPETA}::stickers.png`)).toEqual({ ok: true });
    const pieza = await loQueVeLaAgencia();
    expect(pieza.versiones.map((v) => [v.id, v.numero])).toEqual([
      ["f-pdf", 1],
      ["f-png", 2],
    ]);
    expect(drive.carpetas[CARPETA].map((a) => a.name)).toEqual(["stickers.jpg", "stickers.png"]);
    expect(renombrarArchivo).not.toHaveBeenCalled();
  });
});
