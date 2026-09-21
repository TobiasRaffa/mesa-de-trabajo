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
  // Lo que el cliente escribió encima del archivo en Drive. Acá no hay
  // ninguno: estas pruebas miran qué carpetas y archivos llegan al portal, y
  // los comentarios tienen las suyas.
  comentariosDeArchivo: vi.fn(async () => []),
}));
// El equipo vive en archivos y acá no hace falta: sin nadie cargado, ningún
// comentario es del equipo, que es lo que estas pruebas necesitan.
vi.mock("@/lib/equipo", () => ({ comoFirmaElEquipo: vi.fn(async () => []) }));
// El cliente: acá solo interesa si tiene acceso a Drive, que decide si los
// links se mandan al navegador o no.
vi.mock("@/lib/clientes", () => ({
  clientePorId: vi.fn(async () => ({
    id: "cliente",
    nombre: "Cafe Otono",
    habilitado: true,
    token: "t",
    tag: "tag",
    verEnDrive: false,
  })),
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
  // El doble filtra lo mismo que el de verdad: lo escondido **y** «Facturas».
  // La primera versión solo miraba lo escondido, y con eso la prueba de que
  // «Facturas» no se muestra pasaba en verde sin probar nada.
  soloLoVisible: vi.fn(async (cosas: Array<{ id: string; name?: string }>) =>
    cosas.filter(
      (c) =>
        !ESCONDIDOS.has(c.id) &&
        !(c.name && c.name.trim().toLowerCase() === "facturas")
    )
  ),
}));

import { datosDeCarpeta, subcarpetasDe } from "@/lib/google";
import { estadosDe, piezasDeLaCarpeta, type EstadoDePieza } from "@/lib/piezas";
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
  vi.mocked(estadosDe).mockImplementation(async (_carpeta, piezas) =>
    Object.fromEntries(
      piezas.map(({ id }) => [
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

describe("subir una vuelta nueva no borra lo anotado", () => {
  /**
   * **Este es el caso.** El cliente pide tres cambios, el diseñador sube la
   * V2, y hasta ahora los tres cambios desaparecían de la pantalla: lo
   * guardado estaba bajo el identificador de Drive de la vuelta anterior, y
   * nadie preguntaba más por ese. No se perdía; dejaba de encontrarse. Y
   * pasaba justo cuando el diseñador estaba trabajando esos cambios.
   */
  it("los cambios del cliente siguen ahí cuando aparece la V2", async () => {
    const LOQUEPIDIO = [
      { id: "c1", texto: "el sol pisa la bajada" },
      { id: "c2", texto: "la fecha tiene que decir 12/3" },
    ];

    // Lo guardado vive bajo la identidad de la pieza, no bajo un archivo. Se
    // vuelve a poner después de cada `driveCon` porque ese ayudante también
    // repone los estados: el almacén no se borra cuando Drive cambia.
    const loGuardado = () =>
      vi.mocked(estadosDe).mockImplementation(async (carpeta, piezas) =>
        Object.fromEntries(
          piezas.map(({ id }) => [
            id,
            {
              carpetaId: carpeta,
              // Entregada y abierta: es el estado en que el cliente la ve.
              // `en_curso` ya no llega al portal —es trabajo sin entregar— y
              // esta prueba es sobre la identidad, no sobre la entrega.
              estado: "en_revision" as const,
              ronda: 1,
              rondasExtra: 0,
              cambios: id === "logos::9304.jpeg" ? LOQUEPIDIO : [],
              enviada: true,
              mudada: false,
              historia: [],
            },
          ])
        )
      );

    driveCon({ [RAIZ]: [{ id: "logos", name: "Logos" }] }, { logos: ["9304.jpeg"] });
    loGuardado();

    const antes = await portalDelCliente(RAIZ);
    expect(antes.carpetas[0].piezas[0].cambios).toHaveLength(2);

    // Ahora el diseñador sube la V2 a la misma carpeta. La V1 se queda.
    driveCon(
      { [RAIZ]: [{ id: "logos", name: "Logos" }] },
      { logos: ["9304.jpeg", "9304 V2.jpeg"] }
    );
    loGuardado();

    const despues = await portalDelCliente(RAIZ);
    const pieza = despues.carpetas[0].piezas[0];

    expect(
      pieza.cambios,
      "Subir una vuelta nueva no puede hacer desaparecer lo que el cliente " +
        "pidió: es justo lo que el diseñador está por resolver."
    ).toEqual(LOQUEPIDIO);

    // Y sigue siendo **una** pieza, ahora con dos vueltas.
    expect(despues.carpetas[0].piezas).toHaveLength(1);
    expect(pieza.versiones).toHaveLength(2);
    // La que se mira es la nueva.
    expect(pieza.driveFileId).toBe("logos:9304 V2.jpeg");
  });
});

describe("entregas finales", () => {
  /**
   * Se filtraba junto con «Facturas» porque las dos son reservadas, y eso
   * dejaba al cliente sin el único lugar donde está junto todo lo que aprobó:
   * lo entregado existía solo para la agencia.
   */
  it("aparece en el portal, y al final de la lista", async () => {
    driveCon(
      {
        [RAIZ]: [
          { id: "finales", name: "Entregas finales" },
          { id: "logos", name: "Logos" },
        ],
      },
      { finales: ["listo.jpeg"], logos: ["9304.jpeg"] }
    );

    const portal = await portalDelCliente(RAIZ);
    expect(
      portal.carpetas.map((c) => c.nombre),
      "Lo terminado va abajo: arriba tiene que estar lo que espera decisión."
    ).toEqual(["Logos", "Entregas finales"]);
  });

  it("sus piezas llegan aprobadas, no esperando decisión", async () => {
    // Preguntar el estado acá devuelve piezas «sin tocar» —con botón de
    // aprobar incluido— sobre trabajo que el cliente ya aprobó: lo anotado de
    // cada pieza vive bajo su carpeta de origen, no bajo esta.
    driveCon(
      { [RAIZ]: [{ id: "finales", name: "Entregas finales" }] },
      { finales: ["listo.jpeg"] }
    );

    const carpeta = (await portalDelCliente(RAIZ)).carpetas[0];
    expect(carpeta.clase).toBe("entregas");
    expect(carpeta.piezas[0].estado).toBe("final");
  });

  it("«Facturas» no se muestra nunca: es de la agencia", async () => {
    driveCon(
      {
        [RAIZ]: [
          { id: "fact", name: "Facturas" },
          { id: "logos", name: "Logos" },
        ],
      },
      { fact: ["factura-01.jpeg"], logos: ["9304.jpeg"] }
    );

    expect(
      (await portalDelCliente(RAIZ)).carpetas.map((c) => c.nombre)
    ).toEqual(["Logos"]);
  });

  it("una entregas finales escondida a mano tampoco se muestra", async () => {
    ESCONDIDOS.add("finales");
    driveCon(
      { [RAIZ]: [{ id: "finales", name: "Entregas finales" }] },
      { finales: ["listo.jpeg"] }
    );

    expect(await portalDelCliente(RAIZ).then((p) => p.carpetas)).toEqual([]);
  });
});

describe("el cliente ve lo entregado y nada más", () => {
  /** Arma un Drive y fija en qué estado está cada pieza. */
  function conEstados(estados: Record<string, Partial<EstadoDePieza>>) {
    vi.mocked(estadosDe).mockImplementation(async (carpeta, piezas) =>
      Object.fromEntries(
        piezas.map(({ id }) => [
          id,
          {
            carpetaId: carpeta,
            estado: "en_curso" as const,
            ronda: 0,
            rondasExtra: 0,
            cambios: [],
            enviada: false,
            mudada: false,
            historia: [],
            ...estados[id],
          },
        ])
      )
    );
  }

  /**
   * **Este es el caso que faltaba.** Un archivo que aparecía en Drive nacía
   * entregado, así que el cliente lo veía —y lo podía aprobar— en el instante
   * en que se subía: el JPG a medio hacer, la prueba de color, el que se
   * guardó en la carpeta equivocada.
   */
  it("no muestra lo que todavía no se entregó", async () => {
    driveCon(
      { [RAIZ]: [{ id: "logos", name: "Logos" }] },
      { logos: ["a-medias.jpeg", "listo.jpeg"] }
    );
    conEstados({ "logos::listo.jpeg": { estado: "entregada" } });

    const portal = await portalDelCliente(RAIZ);
    expect(portal.carpetas[0].piezas.map((p) => p.nombre)).toEqual(["listo"]);
  });

  it("una carpeta con todo sin entregar no aparece", async () => {
    driveCon({ [RAIZ]: [{ id: "logos", name: "Logos" }] }, { logos: ["a-medias.jpeg"] });
    conEstados({});

    expect(await portalDelCliente(RAIZ).then((p) => p.carpetas)).toEqual([]);
  });

  it("lo aprobado sale de su carpeta: queda en «Entregas finales»", async () => {
    // Se decidió así: la carpeta de trabajo muestra lo que falta. Repetirlo en
    // las dos dejaba la misma pieza dos veces en la misma pantalla.
    driveCon(
      { [RAIZ]: [{ id: "logos", name: "Logos" }] },
      { logos: ["aprobada.jpeg", "pendiente.jpeg"] }
    );
    conEstados({
      "logos::aprobada.jpeg": { estado: "final", mudada: true },
      "logos::pendiente.jpeg": { estado: "entregada" },
    });

    const portal = await portalDelCliente(RAIZ);
    expect(portal.carpetas[0].piezas.map((p) => p.nombre)).toEqual(["pendiente"]);
  });

  it("una aprobada que NO se pudo mudar sigue en su carpeta", async () => {
    // Si Drive no contestó, el archivo sigue ahí. Sacarlo de la vista lo haría
    // desaparecer de los dos lados: no estaría en el cajón ni en su carpeta.
    driveCon({ [RAIZ]: [{ id: "logos", name: "Logos" }] }, { logos: ["aprobada.jpeg"] });
    conEstados({ "logos::aprobada.jpeg": { estado: "final", mudada: false } });

    const portal = await portalDelCliente(RAIZ);
    expect(portal.carpetas[0].piezas.map((p) => p.nombre)).toEqual(["aprobada"]);
  });

  it("en «Entregas finales» se muestra todo lo que hay", async () => {
    driveCon(
      { [RAIZ]: [{ id: "finales", name: "Entregas finales" }] },
      { finales: ["listo.jpeg"] }
    );
    conEstados({});

    expect(await portalDelCliente(RAIZ).then((p) => p.carpetas[0].piezas)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe("qué campos de la pieza salen al navegador", () => {
  /**
   * **`Portal` es una pantalla del navegador**: todo lo que llega en `datos`
   * viaja en el HTML que sirve el link público, se dibuje o no. Lo guardado se
   * copiaba entero con un `...guardado`, y adentro venía `historia` —que lleva
   * el nombre propio de quien del equipo entregó, reabrió o habilitó cada
   * cosa— y `detalle`, que guarda el motivo crudo de un error de Drive. Nada de
   * eso se dibujaba en ninguna parte: viajaba y se quedaba ahí, legible con
   * «ver código fuente».
   *
   * Esta prueba es la que hace que agregarle un campo a lo guardado no lo
   * publique solo.
   */
  const PERMITIDOS = [
    "estado",
    "ronda",
    "rondasExtra",
    "cambios",
    "enviada",
    "id",
    "nombre",
    "driveFileId",
    "esPdf",
    "modificado",
    "enlaceDrive",
    "versiones",
    "publicaEl",
    "vence",
  ];

  it("ninguna pieza lleva la historia interna ni nada que no esté en la lista", async () => {
    driveCon({ [RAIZ]: [{ id: "trab", name: "Trabajo" }] }, { trab: ["pieza.jpg"] });

    // Lo guardado trae de todo, como en producción.
    vi.mocked(estadosDe).mockImplementation(async (carpeta, piezas) =>
      Object.fromEntries(
        piezas.map(({ id }) => [
          id,
          {
            carpetaId: carpeta,
            estado: "entregada" as const,
            ronda: 0,
            rondasExtra: 0,
            cambios: [],
            enviada: false,
            mudada: false,
            comentariosCopiados: ["comentario-de-drive"],
            archivoMudado: "id-en-entregas-finales",
            archivos: ["id-de-drive"],
            versionEntregada: 1,
            entregadaEl: "2026-09-01T10:00:00Z",
            historia: [
              {
                id: "h1",
                que: "entregada" as const,
                cuando: "2026-09-01T10:00:00Z",
                quien: "Nombre Propio De Alguien Del Equipo",
                detalle: "no_se_pudo_devolver: el motivo crudo de Drive",
              },
            ],
          } satisfies EstadoDePieza,
        ])
      )
    );

    const portal = await portalDelCliente(RAIZ);
    const pieza = portal.carpetas[0].piezas[0];

    const decomas = Object.keys(pieza).filter((c) => !PERMITIDOS.includes(c));
    expect(
      decomas,
      "Todo lo que esté acá adentro viaja en el HTML público. Si hace falta un " +
        "campo nuevo, se agrega a la lista a propósito y no de arriba."
    ).toEqual([]);

    // Y los tres que más duelen, nombrados, para que se lea qué se cuida.
    const comoTexto = JSON.stringify(portal);
    expect(comoTexto).not.toContain("Nombre Propio De Alguien Del Equipo");
    expect(comoTexto).not.toContain("no_se_pudo_devolver");
    expect(comoTexto).not.toContain("comentario-de-drive");
  });
});
