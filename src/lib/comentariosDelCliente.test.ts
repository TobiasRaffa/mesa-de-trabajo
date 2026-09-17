// Lo que el cliente escribe encima del archivo en Drive, pasado a su lista de
// cambios pedidos.
//
// Es lo que más cuidado necesita de todo esto, porque escribe en nombre del
// cliente: un error acá le pone en la boca algo que no dijo. Drive y el
// almacén se reemplazan por dobles y se prueba la decisión, que es lo nuestro.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/google", () => ({ comentariosDeArchivo: vi.fn(async () => []) }));
vi.mock("@/lib/equipo", () => ({ comoFirmaElEquipo: vi.fn(async () => ["Nari"]) }));
vi.mock("@/lib/piezas", () => ({ guardarPiezas: vi.fn(async () => {}) }));

import { comentariosDeArchivo, type ComentarioDeDrive } from "@/lib/google";
import { guardarPiezas, type EstadoDePieza } from "@/lib/piezas";
import type { Estado } from "@/dominio/pieza";
import { conLosComentariosDelCliente } from "@/lib/comentariosDelCliente";

const comentario = (x: Partial<ComentarioDeDrive> & { id: string }): ComentarioDeDrive => ({
  quien: "Marina · Cafe Otoño",
  texto: "cambiar el verde",
  cuando: "2026-09-16T10:00:00Z",
  resuelto: false,
  respuestas: [],
  ...x,
});

const pieza = (x: Partial<EstadoDePieza> = {}): EstadoDePieza => ({
  carpetaId: "carpeta",
  estado: "entregada",
  ronda: 0,
  rondasExtra: 0,
  cambios: [],
  enviada: false,
  mudada: false,
  historia: [],
  ...x,
});

const LA_PIEZA = [{ id: "carpeta::logo.pdf", ultimoArchivo: "archivo1" }];

const conDrive = (...cs: ComentarioDeDrive[]) =>
  vi.mocked(comentariosDeArchivo).mockResolvedValue(cs);

beforeEach(() => vi.clearAllMocks());

describe("lo que escribe el cliente pasa a sus cambios pedidos", () => {
  it("entra con la hoja adelante", async () => {
    conDrive(comentario({ id: "c1", hoja: 3 }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza(),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toEqual([
      { id: "drive:c1", texto: "Hoja 3: cambiar el verde" },
    ]);
  });

  it("se suma a lo que ya había escrito en el portal", async () => {
    conDrive(comentario({ id: "c1" }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza({ cambios: [{ id: "propio", texto: "el logo más chico" }] }),
    });

    expect(estados["carpeta::logo.pdf"].cambios.map((c) => c.id)).toEqual([
      "propio",
      "drive:c1",
    ]);
  });

  it("no cierra la vuelta ni la marca enviada", async () => {
    // Un comentario suelto no es una devolución: la devolución es cuando el
    // cliente decide que terminó de escribir y toca «Enviar revisión».
    conDrive(comentario({ id: "c1" }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza({ estado: "entregada", ronda: 0 }),
    });

    const p = estados["carpeta::logo.pdf"];
    expect({ estado: p.estado, ronda: p.ronda, enviada: p.enviada }).toEqual({
      estado: "entregada",
      ronda: 0,
      enviada: false,
    });
  });

  it("lo copiado no vuelve a aparecer como comentario suelto", async () => {
    // Si apareciera en los dos lados de la misma pantalla, sería el mismo
    // pedido escrito dos veces, uno debajo del otro.
    conDrive(comentario({ id: "c1" }));

    const { sinCopiar } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza(),
    });

    expect(sinCopiar["carpeta::logo.pdf"]).toEqual([]);
  });
});

describe("lo que escribe el equipo no es un pedido del cliente", () => {
  it("no entra a la lista de cambios", async () => {
    conDrive(comentario({ id: "c1", quien: "Nari", texto: "ojo con el sangrado" }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza(),
    });

    expect(
      estados["carpeta::logo.pdf"].cambios,
      "Una nota que el diseñador se deja a sí mismo en el PDF no puede " +
        "entrar como pedido del cliente: se le entrega y gasta una vuelta."
    ).toEqual([]);
  });

  it("tampoco se muestra aparte", async () => {
    conDrive(comentario({ id: "c1", quien: "Nari" }));

    const { sinCopiar } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza(),
    });

    expect(sinCopiar["carpeta::logo.pdf"]).toEqual([]);
  });
});

describe("no se copia dos veces", () => {
  it("lo ya copiado no vuelve a entrar", async () => {
    conDrive(comentario({ id: "c1" }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza({
        cambios: [{ id: "drive:c1", texto: "Hoja 3: cambiar el verde" }],
        comentariosCopiados: ["c1"],
      }),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toHaveLength(1);
  });

  it("tampoco después de que la lista de cambios se vacía", async () => {
    // **Es el caso que obliga a llevar la memoria aparte.** Al entregar la
    // vuelta siguiente la lista se vacía —es lo correcto, la revisión nueva
    // empieza en blanco— pero el comentario sigue estando en Drive.
    conDrive(comentario({ id: "c1" }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza({ cambios: [], comentariosCopiados: ["c1"] }),
    });

    expect(
      estados["carpeta::logo.pdf"].cambios,
      "Sin esto, el cliente ve resucitar un pedido que ya le contestamos."
    ).toEqual([]);
  });

  it("y no se escribe nada cuando no entró nada", async () => {
    conDrive(comentario({ id: "c1" }));

    await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza({ comentariosCopiados: ["c1"] }),
    });

    expect(guardarPiezas).not.toHaveBeenCalled();
  });
});

describe("solo entra cuando el cliente puede escribir", () => {
  const noDeberia = (estado: Estado, enviada = false) =>
    it(`no entra si la pieza está «${estado}»${enviada ? " y ya se mandó" : ""}`, async () => {
      conDrive(comentario({ id: "c1" }));

      const { estados, sinCopiar } = await conLosComentariosDelCliente(LA_PIEZA, {
        "carpeta::logo.pdf": pieza({ estado, enviada }),
      });

      expect(estados["carpeta::logo.pdf"].cambios).toEqual([]);
      // No se pierde: se muestra aparte y entra cuando le vuelva a tocar.
      expect(sinCopiar["carpeta::logo.pdf"].map((c) => c.id)).toEqual(["c1"]);
    });

  // La tenemos nosotros: lo que escriba ahora no es un pedido de esta vuelta.
  noDeberia("en_curso");
  noDeberia("extra_pedida");
  // Ya está cerrada.
  noDeberia("final");
  noDeberia("cancelada");
  // Ya la mandó: lo escrito quedó firme y la agencia está trabajando sobre eso.
  noDeberia("entregada", true);

  it("y cuando le vuelve a tocar, entra", async () => {
    conDrive(comentario({ id: "c1" }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza({ estado: "en_revision", enviada: false }),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toHaveLength(1);
  });
});

describe("lo que se descarta", () => {
  it("un comentario resuelto en Drive no entra", async () => {
    // Es una conversación que alguien ya cerró: entrarla como pedido nuevo
    // sería reabrirla sin que nadie lo decidiera.
    conDrive(comentario({ id: "c1", resuelto: true }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza(),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toEqual([]);
  });

  it("uno vacío tampoco", async () => {
    conDrive(comentario({ id: "c1", texto: "   " }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza(),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toEqual([]);
  });

  it("sin piezas no le pregunta nada a Drive", async () => {
    await conLosComentariosDelCliente([], {});
    expect(comentariosDeArchivo).not.toHaveBeenCalled();
  });
});

describe("mientras la vuelta esté abierta, los dos lados son el mismo", () => {
  // Corregir en Drive lo que uno escribió es lo más común del mundo. Sin esto,
  // la agencia recibía la primera redacción y el cliente veía la segunda: dos
  // textos distintos para el mismo pedido, que es peor que no tener el segundo.

  const yaCopiado = (texto: string) =>
    pieza({
      cambios: [{ id: "drive:c1", texto }],
      comentariosCopiados: ["c1"],
    });

  it("si lo corrigen en Drive, se corrige acá", async () => {
    conDrive(comentario({ id: "c1", texto: "el importe en negrita", hoja: 2 }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": yaCopiado("Hoja 1: el importe mas grande"),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toEqual([
      { id: "drive:c1", texto: "Hoja 2: el importe en negrita" },
    ]);
  });

  it("si lo borran en Drive, se borra acá", async () => {
    conDrive();

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": yaCopiado("Hoja 1: el importe mas grande"),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toEqual([]);
  });

  it("si lo resuelven en Drive, también se va", async () => {
    conDrive(comentario({ id: "c1", resuelto: true }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": yaCopiado("Hoja 1: el importe mas grande"),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toEqual([]);
  });

  it("y no se toca lo que el cliente escribió en el portal", async () => {
    // Solo sigue al comentario lo que salió de un comentario. Lo escrito acá
    // es suyo y nada de Drive puede borrarlo.
    conDrive();

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza({
        cambios: [
          { id: "propio", texto: "el logo más chico" },
          { id: "drive:c1", texto: "Hoja 1: algo" },
        ],
        comentariosCopiados: ["c1"],
      }),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toEqual([
      { id: "propio", texto: "el logo más chico" },
    ]);
  });

  it("sin cambios de verdad, no se escribe nada", async () => {
    conDrive(comentario({ id: "c1", texto: "el importe mas grande", hoja: 1 }));

    await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": yaCopiado("Hoja 1: el importe mas grande"),
    });

    expect(guardarPiezas).not.toHaveBeenCalled();
  });
});

describe("una vez mandada la revisión, lo pedido queda firme", () => {
  // De ahí en más es lo que la agencia está trabajando: cambiarlo por atrás
  // sería cambiarle el pedido a alguien que ya empezó.
  const mandada = (texto: string) =>
    pieza({
      estado: "cambios_marcados",
      enviada: true,
      cambios: [{ id: "drive:c1", texto }],
      comentariosCopiados: ["c1"],
    });

  it("corregirlo en Drive ya no lo cambia", async () => {
    conDrive(comentario({ id: "c1", texto: "otra cosa distinta" }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": mandada("Hoja 1: el importe mas grande"),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toEqual([
      { id: "drive:c1", texto: "Hoja 1: el importe mas grande" },
    ]);
  });

  it("borrarlo en Drive tampoco", async () => {
    conDrive();

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": mandada("Hoja 1: el importe mas grande"),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toHaveLength(1);
  });
});
