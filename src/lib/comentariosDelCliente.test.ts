// Lo que el cliente escribe encima del archivo en Drive, pasado a su lista de
// cambios pedidos.
//
// Es lo que más cuidado necesita de todo esto, porque escribe en nombre del
// cliente: un error acá le pone en la boca algo que no dijo. Drive y el
// almacén se reemplazan por dobles y se prueba la decisión, que es lo nuestro.

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La base, en memoria.
 *
 * `cambiarPieza` se imita de verdad —lee lo que hay **ahora**, llama a la
 * transformación y guarda lo que devuelve— porque lo que se prueba incluye
 * que la escritura no pise lo que otro guardó mientras Drive contestaba.
 */
const { base } = vi.hoisted(() => ({
  base: new Map<string, import("@/lib/piezas").EstadoDePieza>(),
}));

vi.mock("@/lib/google", () => ({ comentariosDeArchivo: vi.fn(async () => []) }));
vi.mock("@/lib/equipo", () => ({ comoFirmaElEquipo: vi.fn(async () => ["Nari"]) }));
vi.mock("@/lib/piezas", () => ({
  cambiarPieza: vi.fn(
    async (
      _carpetaId: string,
      id: string,
      transform: (
        actual: import("@/lib/piezas").EstadoDePieza
      ) => { commit: import("@/lib/piezas").EstadoDePieza } | { abort: unknown }
    ) => {
      const r = transform(base.get(id)!);
      if ("abort" in r) return { abort: r.abort };
      base.set(id, r.commit);
      return { pieza: r.commit };
    }
  ),
  anotar: (
    p: import("@/lib/piezas").EstadoDePieza,
    que: import("@/lib/piezas").EntradaDeHistoria["que"],
    quien: string,
    detalle?: string
  ) => ({
    ...p,
    historia: [...p.historia, { id: `h${p.historia.length}`, que, quien, cuando: "", detalle }],
  }),
}));

import { comentariosDeArchivo, type ComentarioDeDrive } from "@/lib/google";
import { cambiarPieza, type EstadoDePieza } from "@/lib/piezas";
import type { Estado } from "@/dominio/pieza";
import { conLosComentariosDelCliente as deVerdad } from "@/lib/comentariosDelCliente";

/**
 * Lo mismo, pero con la base sembrada con la foto que se pasa.
 *
 * Es el caso de todos los días: lo que se leyó es lo que hay. Las pruebas de
 * carreras siembran la base antes, con otra cosa, y esto no la pisa.
 */
const conLosComentariosDelCliente: typeof deVerdad = (piezas, estados) => {
  for (const [id, e] of Object.entries(estados)) if (!base.has(id)) base.set(id, e);
  return deVerdad(piezas, estados);
};

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

const LA_PIEZA = [
  { id: "carpeta::logo.pdf", archivos: [{ id: "archivo1", version: 1 }] },
];

/** La misma pieza con tres vueltas: V1, V2 y V3, cada una su archivo. */
const CON_TRES_VUELTAS = [
  {
    id: "carpeta::logo.pdf",
    archivos: [
      { id: "archivo1", version: 1 },
      { id: "archivo2", version: 2 },
      { id: "archivo3", version: 3 },
    ],
  },
];

const conDrive = (...cs: ComentarioDeDrive[]) =>
  vi.mocked(comentariosDeArchivo).mockResolvedValue(cs);

beforeEach(() => {
  vi.clearAllMocks();
  base.clear();
});

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
    // cliente decide que terminó de escribir y toca «Enviar revisión». Queda
    // como un cambio anotado en el portal: marcado, sin mandar.
    conDrive(comentario({ id: "c1" }));

    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, {
      "carpeta::logo.pdf": pieza({ estado: "entregada", ronda: 0 }),
    });

    const p = estados["carpeta::logo.pdf"];
    expect({ estado: p.estado, ronda: p.ronda, enviada: p.enviada }).toEqual({
      estado: "cambios_marcados",
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

    expect(cambiarPieza).not.toHaveBeenCalled();
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

    expect(cambiarPieza).not.toHaveBeenCalled();
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

describe("los comentarios de las versiones de antes", () => {
  // **Se perdían.** Un comentario vive en un archivo, y una pieza tiene un
  // archivo por vuelta: leyendo solo el último, lo que el cliente escribió
  // encima de la V1 desaparecía de la aplicación en cuanto se subía la V2 —y
  // seguía ahí en Drive, esperando una respuesta que nadie iba a dar—.
  const porArchivo = (cuales: Record<string, ComentarioDeDrive[]>) =>
    vi.mocked(comentariosDeArchivo).mockImplementation(async (id) => cuales[id] ?? []);

  it("lo escrito sobre la V1 entra igual", async () => {
    porArchivo({ archivo1: [comentario({ id: "viejo", texto: "el verde no" })] });

    const { estados } = await conLosComentariosDelCliente(CON_TRES_VUELTAS, {
      "carpeta::logo.pdf": pieza(),
    });

    expect(
      estados["carpeta::logo.pdf"].cambios.map((c) => c.id),
      "Sin esto, el cliente escribió algo y la agencia no se entera nunca."
    ).toEqual(["drive:viejo"]);
  });

  it("dice de qué versión salió, cuando no es la última", async () => {
    // Es el único aviso de que ese pedido se escribió sobre un archivo de
    // antes y puede estar hablando de algo que ya se cambió.
    porArchivo({
      archivo1: [comentario({ id: "v1", texto: "el verde no", hoja: 2 })],
      archivo3: [comentario({ id: "v3", texto: "más chico" })],
    });

    const { estados } = await conLosComentariosDelCliente(CON_TRES_VUELTAS, {
      "carpeta::logo.pdf": pieza(),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toEqual([
      { id: "drive:v1", texto: "V1 · Hoja 2: el verde no" },
      { id: "drive:v3", texto: "más chico" },
    ]);
  });

  it("se pregunta por todas las vueltas, no solo por la última", async () => {
    porArchivo({});

    await conLosComentariosDelCliente(CON_TRES_VUELTAS, {
      "carpeta::logo.pdf": pieza(),
    });

    expect(vi.mocked(comentariosDeArchivo).mock.calls.map((c) => c[0]).sort()).toEqual([
      "archivo1",
      "archivo2",
      "archivo3",
    ]);
  });

  it("uno ya copiado no vuelve a entrar por venir de otra versión", async () => {
    porArchivo({ archivo1: [comentario({ id: "viejo" })] });

    const { estados } = await conLosComentariosDelCliente(CON_TRES_VUELTAS, {
      "carpeta::logo.pdf": pieza({ comentariosCopiados: ["viejo"] }),
    });

    expect(estados["carpeta::logo.pdf"].cambios).toEqual([]);
  });
});

describe("un pedido copiado de Drive viaja con «Enviar revisión»", () => {
  // **No viajaba.** Se copiaba a la lista y la pieza quedaba «entregada»: el
  // portal no la juntaba para mandar, y cerrar la revisión sobre una pieza
  // entregada no cambia nada, así que el cliente tocaba «Enviar revisión» y
  // la agencia no recibía el pedido. Queda igual que si lo hubiera escrito en
  // el portal: con los cambios marcados.
  const ID = "carpeta::logo.pdf";

  it("sobre una pieza en revisión, también", async () => {
    conDrive(comentario({ id: "c1" }));

    await conLosComentariosDelCliente(LA_PIEZA, { [ID]: pieza({ estado: "en_revision" }) });

    expect(base.get(ID)?.estado).toBe("cambios_marcados");
  });

  it("y queda en la historia, como cuando lo anota en el portal", async () => {
    conDrive(comentario({ id: "c1" }));

    await conLosComentariosDelCliente(LA_PIEZA, { [ID]: pieza() });

    expect(base.get(ID)?.historia.map((h) => h.que)).toEqual(["cambios_pedidos"]);
  });

  it("sin rondas, se anota el pedido pero la pieza no se mueve", async () => {
    // Pasarla a «cambios marcados» ahí sería gastar una vuelta que no hay: el
    // dominio dice que corresponde pedir una revisión adicional.
    conDrive(comentario({ id: "c1" }));

    await conLosComentariosDelCliente(LA_PIEZA, { [ID]: pieza({ ronda: 2 }) });

    expect(base.get(ID)?.estado).toBe("entregada");
    expect(base.get(ID)?.cambios.map((c) => c.id)).toEqual(["drive:c1"]);
  });

  it("si lo único marcado se borra en Drive, la pieza vuelve a quedar sin decidir", async () => {
    conDrive();

    await conLosComentariosDelCliente(LA_PIEZA, {
      [ID]: pieza({
        estado: "cambios_marcados",
        cambios: [{ id: "drive:c1", texto: "cambiar el verde" }],
        comentariosCopiados: ["c1"],
      }),
    });

    expect(base.get(ID)?.estado).toBe("en_revision");
    expect(base.get(ID)?.cambios).toEqual([]);
  });
});

describe("la escritura no pisa lo que otro guardó mientras Drive contestaba", () => {
  // Lo que se pasa es una foto leída **antes** de preguntarle a Drive. Se
  // escribía la pieza entera armada sobre esa foto, y lo que otra acción
  // guardó en el medio —una revisión enviada, una aprobación, un cambio
  // anotado— desaparecía sin error.
  const ID = "carpeta::logo.pdf";

  it("una revisión enviada en el medio no se deshace", async () => {
    conDrive(comentario({ id: "c1" }));
    const enviada = pieza({
      estado: "en_curso",
      enviada: true,
      ronda: 1,
      cambios: [{ id: "p1", texto: "el logo más chico" }],
      historia: [{ id: "h", que: "revision_enviada", quien: "Cliente", cuando: "" }],
    });
    base.set(ID, enviada);

    await conLosComentariosDelCliente(LA_PIEZA, {
      [ID]: pieza({ estado: "cambios_marcados", cambios: [{ id: "p1", texto: "el logo más chico" }] }),
    });

    expect(base.get(ID)).toEqual(enviada);
  });

  it("un cambio anotado en el medio se conserva", async () => {
    conDrive(comentario({ id: "c1" }));
    base.set(
      ID,
      pieza({ estado: "cambios_marcados", cambios: [{ id: "p1", texto: "el logo más chico" }] })
    );

    await conLosComentariosDelCliente(LA_PIEZA, { [ID]: pieza() });

    expect(base.get(ID)?.cambios.map((c) => c.id)).toEqual(["p1", "drive:c1"]);
  });
});

describe("si Drive falla, no se toca lo ya copiado", () => {
  // Un tropiezo de Google se leía como «el cliente borró todo en Drive»: los
  // pedidos copiados se sacaban de la lista y, como seguían anotados como
  // copiados, no volvían nunca más.
  const ID = "carpeta::logo.pdf";
  const yaCopiado = () =>
    pieza({
      estado: "cambios_marcados",
      cambios: [{ id: "drive:c1", texto: "cambiar el verde" }],
      comentariosCopiados: ["c1"],
    });

  it("un archivo que no se pudo leer no borra nada", async () => {
    vi.mocked(comentariosDeArchivo).mockResolvedValue(null);

    const { estados, sinCopiar } = await conLosComentariosDelCliente(LA_PIEZA, {
      [ID]: yaCopiado(),
    });

    expect(estados[ID].cambios.map((c) => c.id)).toEqual(["drive:c1"]);
    expect(sinCopiar[ID]).toEqual([]);
    expect(cambiarPieza).not.toHaveBeenCalled();
  });

  it("tampoco si falla una sola de las vueltas", async () => {
    // El pedido pudo haberse escrito sobre la vuelta que no contestó: no hay
    // forma de saber que se borró.
    vi.mocked(comentariosDeArchivo).mockImplementation(async (id) =>
      id === "archivo1" ? null : []
    );

    await conLosComentariosDelCliente(CON_TRES_VUELTAS, { [ID]: yaCopiado() });

    expect(cambiarPieza).not.toHaveBeenCalled();
  });
});

describe("un comentario resuelto y vuelto a abrir en Drive", () => {
  // Resolverlo lo saca de la lista. Pero seguía anotado como copiado, y al
  // reabrirlo no volvía nunca: quedaba abierto en Drive y en ningún lado acá.
  const ID = "carpeta::logo.pdf";

  it("vuelve a entrar como pedido", async () => {
    conDrive(comentario({ id: "c1" }));
    await conLosComentariosDelCliente(LA_PIEZA, { [ID]: pieza() });

    conDrive(comentario({ id: "c1", resuelto: true }));
    await conLosComentariosDelCliente(LA_PIEZA, { [ID]: base.get(ID)! });
    expect(base.get(ID)?.cambios).toEqual([]);

    conDrive(comentario({ id: "c1" }));
    await conLosComentariosDelCliente(LA_PIEZA, { [ID]: base.get(ID)! });
    expect(base.get(ID)?.cambios.map((c) => c.id)).toEqual(["drive:c1"]);
  });

  it("pero lo que ya se contestó en una vuelta anterior no resucita", async () => {
    // La lista se vació al entregar la vuelta siguiente: que la agencia lo
    // marque resuelto después no lo saca de lo ya copiado.
    conDrive(comentario({ id: "c1", resuelto: true }));
    await conLosComentariosDelCliente(LA_PIEZA, {
      [ID]: pieza({ cambios: [], comentariosCopiados: ["c1"] }),
    });

    conDrive(comentario({ id: "c1" }));
    const { estados } = await conLosComentariosDelCliente(LA_PIEZA, { [ID]: base.get(ID)! });
    expect(estados[ID].cambios).toEqual([]);
  });
});
