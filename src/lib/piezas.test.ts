import { beforeEach, describe, expect, it, vi } from "vitest";

// El almacén se reemplaza por uno en memoria: lo que se prueba acá es la regla
// —cuándo una pieza sigue siendo la misma y cuándo vuelve a empezar—, no cómo
// se guarda.
const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const guardado = memoriaDePruebas.ver("piezas");

// El doble del almacén es el compartido: cumple el contrato entero —`cambiar`
// incluido— así que lo que pasa acá dice algo de lo que va a pasar de verdad.
vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);

const { estadosDe, cambiarPieza, estadoDe } = await import("@/lib/piezas");
import type { EstadoDePieza } from "@/lib/piezas";

const CARPETA = "carpeta1";
const PIEZA = "carpeta1::stickers.pdf";

function guardarPieza(parche: Partial<EstadoDePieza>) {
  guardado[PIEZA] = {
    carpetaId: CARPETA,
    estado: "final",
    ronda: 2,
    rondasExtra: 0,
    cambios: [{ id: "c1", texto: "Cambiar el fondo" }],
    enviada: true,
    mudada: false,
    historia: [{ id: "h1", que: "entregada", quien: "El equipo", cuando: "2026-01-01" }],
    ...parche,
  };
}

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
});

describe("una pieza sigue siendo la misma mientras quede algo de ella", () => {
  it("subir la V2 no le borra nada", () => {
    // Es la razón por la que la pieza se llama por su nombre y no por el
    // archivo: la V1 sigue ahí, así que es la misma pieza y conserva todo.
    guardarPieza({ archivos: ["A"] });

    return estadosDe(CARPETA, [{ id: PIEZA, archivos: ["A", "B"] }]).then((r) => {
      expect(r[PIEZA].estado).toBe("final");
      expect(r[PIEZA].ronda).toBe(2);
      expect(r[PIEZA].cambios).toHaveLength(1);
      // Y queda anotado lo que hay ahora, que es contra lo que se compara
      // la próxima vez.
      expect(r[PIEZA].archivos).toEqual(["A", "B"]);
    });
  });

  it("una pieza guardada antes de que esto existiera no se reinicia", async () => {
    // Sin archivos anotados no se puede saber si son los mismos. Inventar un
    // pasado que nadie guardó sería peor que no tenerlo: se anota y se sigue.
    guardarPieza({ archivos: undefined });

    const r = await estadosDe(CARPETA, [{ id: PIEZA, archivos: ["Z"] }]);
    expect(r[PIEZA].estado).toBe("final");
    expect(r[PIEZA].archivos).toEqual(["Z"]);
  });
});

describe("borrar el archivo y subir otro con el mismo nombre", () => {
  it("la pieza vuelve a empezar", async () => {
    // El caso que lo motivó: se borra «stickers.pdf» aprobado y se sube otro
    // con el mismo nombre. Sin esto nacía aprobado, con las rondas gastadas y
    // los cambios de un archivo que ya no existe. Dentro de un año, peor.
    guardarPieza({ archivos: ["A"] });

    const r = await estadosDe(CARPETA, [{ id: PIEZA, archivos: ["NUEVO"] }]);

    expect(r[PIEZA].estado).toBe("en_curso");
    expect(r[PIEZA].ronda).toBe(0);
    expect(r[PIEZA].cambios).toEqual([]);
    expect(r[PIEZA].enviada).toBe(false);
    expect(r[PIEZA].archivos).toEqual(["NUEVO"]);
  });

  it("no se pierde nada de lo que había pasado", async () => {
    // Acá no se borra. La historia entera queda, con el reemplazo anotado
    // encima: es lo que contesta «¿esto no lo habíamos aprobado?».
    guardarPieza({ archivos: ["A"] });

    const r = await estadosDe(CARPETA, [{ id: PIEZA, archivos: ["NUEVO"] }]);

    expect(r[PIEZA].historia[0].que).toBe("entregada");
    expect(r[PIEZA].historia.at(-1)?.que).toBe("archivo_reemplazado");
  });

  it("queda guardado, no solo devuelto", async () => {
    // Si el reinicio viviera solo en la respuesta, la próxima pantalla que
    // mirara volvería a ver la pieza aprobada.
    guardarPieza({ archivos: ["A"] });
    await estadosDe(CARPETA, [{ id: PIEZA, archivos: ["NUEVO"] }]);

    expect((guardado[PIEZA] as EstadoDePieza).estado).toBe("en_curso");
  });
});

describe("lo que nadie tocó", () => {
  it("viene a nuevo y no se guarda nada", async () => {
    const r = await estadosDe(CARPETA, [{ id: PIEZA, archivos: ["A"] }]);
    expect(r[PIEZA].estado).toBe("en_curso");
    expect(guardado[PIEZA]).toBeUndefined();
  });
});

describe("lo anotado de antes no se le cuelga a un archivo nuevo", () => {
  // **Pasó al mover unos archivos.** En esa carpeta, meses antes, había habido
  // otro archivo con el mismo nombre, y quedó guardado que se había entregado.
  // Al aparecer los archivos nuevos, la aplicación adoptó ese estado: la pieza
  // salió «entregada» delante del cliente —con su botón de aprobar— sin que
  // nadie la hubiera entregado nunca.
  //
  // Sin la lista de archivos no se puede saber si lo anotado es de estos...
  // salvo por una cosa: **nada pudo pasarle a un archivo antes de que el
  // archivo existiera**.

  /** Un registro viejo: de antes de que se guardara la lista de archivos. */
  const guardarLegado = (cuando: string) => {
    guardado[PIEZA] = {
      carpetaId: CARPETA,
      estado: "entregada",
      ronda: 0,
      rondasExtra: 0,
      cambios: [],
      enviada: false,
      mudada: false,
      entregadaEl: cuando,
      historia: [
        { id: "h1", que: "entregada", quien: "El equipo", cuando },
      ],
    };
  };

  it("si todo lo que hay es más nuevo que lo anotado, la pieza vuelve a empezar", async () => {
    guardarLegado("2026-09-16T01:49:00.000Z");

    const r = await estadosDe(CARPETA, [
      { id: PIEZA, archivos: ["NUEVO"], masVieja: "2026-09-16T03:49:00.000Z" },
    ]);

    expect(
      r[PIEZA].estado,
      "Un trabajo no pudo entregarse antes de que existiera el archivo que se " +
        "entregó. Adoptarlo pone delante del cliente una pieza entregada que " +
        "nadie entregó."
    ).toBe("en_curso");
    expect(r[PIEZA].entregadaEl).toBeUndefined();
  });

  it("y no se pierde nada: la historia queda, con el motivo anotado", async () => {
    guardarLegado("2026-09-16T01:49:00.000Z");

    const r = await estadosDe(CARPETA, [
      { id: PIEZA, archivos: ["NUEVO"], masVieja: "2026-09-16T03:49:00.000Z" },
    ]);

    expect(r[PIEZA].historia.map((h) => h.que)).toEqual([
      "entregada",
      "archivo_reemplazado",
    ]);
  });

  it("si el archivo ya existía cuando se anotó, se conserva lo anotado", async () => {
    // Es el caso normal de una pieza vieja: lo anotado es suyo.
    guardarLegado("2026-09-16T03:49:00.000Z");

    const r = await estadosDe(CARPETA, [
      { id: PIEZA, archivos: ["A"], masVieja: "2026-09-16T01:49:00.000Z" },
    ]);

    expect(r[PIEZA].estado).toBe("entregada");
  });

  it("sin fecha de Drive, ante la duda se conserva lo anotado", async () => {
    guardarLegado("2026-09-16T01:49:00.000Z");

    const r = await estadosDe(CARPETA, [{ id: PIEZA, archivos: ["A"] }]);

    expect(r[PIEZA].estado).toBe("entregada");
  });
});

// ---------------------------------------------------------------------------

describe("la ficha sigue a la pieza cuando le cambia el nombre", () => {
  // **La identidad es `carpeta::nombre.ext`, y el nombre sale de la vuelta más
  // baja que hay en Drive.** Una pieza con `stickers.pdf` y `V2 stickers.jpg`
  // se llama `::stickers.pdf`; el día que alguien borra el PDF viejo pasa a
  // llamarse `::stickers.jpg`, y con la identidad se perdía todo lo anotado:
  // estado, rondas, cambios e historia. La pieza renacía en curso, como si el
  // trabajo empezara de nuevo, y ni siquiera quedaba anotado el reemplazo.
  //
  // Lo que la reconoce es compartir un archivo de Drive, no parecerse de
  // nombre: un archivo pertenece a una sola pieza dentro de una carpeta.
  const CON_PDF = "carpeta1::stickers.pdf";
  const CON_JPG = "carpeta1::stickers.jpg";

  it("se borra la vuelta más baja y la pieza conserva su vida", async () => {
    guardarPieza({ archivos: ["pdf-viejo", "jpg-nuevo"] });

    // Ya no está el PDF: la pieza pasa a llamarse por el JPG que queda.
    const r = await estadosDe(CARPETA, [{ id: CON_JPG, archivos: ["jpg-nuevo"] }]);

    expect(r[CON_JPG].estado).toBe("final");
    expect(r[CON_JPG].ronda).toBe(2);
    expect(r[CON_JPG].cambios).toHaveLength(1);
    expect(r[CON_JPG].historia).toHaveLength(1);
  });

  it("la ficha se muda de verdad: la vieja no queda dando vueltas", async () => {
    guardarPieza({ archivos: ["pdf-viejo", "jpg-nuevo"] });

    await estadosDe(CARPETA, [{ id: CON_JPG, archivos: ["jpg-nuevo"] }]);

    expect(guardado[CON_PDF], "la vieja se borra").toBeUndefined();
    expect(guardado[CON_JPG], "y queda la de ahora").toBeDefined();
  });

  it("también cuando aparece después una vuelta más baja de otro formato", async () => {
    // El camino inverso: estaba `V2 stickers.jpg` sola y alguien sube
    // `stickers.pdf`, que pasa a ser la vuelta uno y le da el nombre.
    guardado[CON_JPG] = {
      carpetaId: CARPETA,
      estado: "entregada",
      ronda: 1,
      rondasExtra: 0,
      cambios: [],
      enviada: false,
      mudada: false,
      archivos: ["jpg-nuevo"],
      historia: [{ id: "h1", que: "entregada", quien: "El equipo", cuando: "2026-01-01" }],
    };

    const r = await estadosDe(CARPETA, [
      { id: CON_PDF, archivos: ["pdf-viejo", "jpg-nuevo"] },
    ]);

    expect(r[CON_PDF].estado).toBe("entregada");
    expect(r[CON_PDF].ronda).toBe(1);
  });

  it("no le roba la ficha a una pieza que sigue existiendo", async () => {
    // Dos piezas con el mismo nombre y distinto formato son dos piezas a
    // propósito. Mientras las dos estén, ninguna adopta a la otra.
    guardado[CON_PDF] = {
      carpetaId: CARPETA,
      estado: "final",
      ronda: 2,
      rondasExtra: 0,
      cambios: [],
      enviada: true,
      mudada: false,
      archivos: ["pdf-viejo"],
      historia: [],
    };

    const r = await estadosDe(CARPETA, [
      { id: CON_PDF, archivos: ["pdf-viejo"] },
      { id: CON_JPG, archivos: ["jpg-nuevo"] },
    ]);

    expect(r[CON_PDF].estado).toBe("final");
    expect(r[CON_JPG].estado, "la otra nace limpia").toBe("en_curso");
    expect(guardado[CON_PDF], "y la del PDF sigue guardada").toBeDefined();
  });

  it("una pieza sin ningún archivo conocido en común sigue naciendo limpia", async () => {
    // Es la otra mitad, y no se puede perder: borrar el archivo y subir otro
    // con el mismo nombre no puede heredar una vida ajena.
    guardarPieza({ archivos: ["pdf-viejo"] });

    const r = await estadosDe(CARPETA, [{ id: CON_JPG, archivos: ["otro-del-todo"] }]);

    expect(r[CON_JPG].estado).toBe("en_curso");
    expect(r[CON_JPG].ronda).toBe(0);
  });
});

describe("cambiarPieza no pisa lo que otro guardó en el medio", () => {
  it("dos transiciones a la vez sobre la misma pieza: ninguna se pierde", async () => {
    // El estado de partida: en curso, sin rondas gastadas.
    guardado[PIEZA] = {
      carpetaId: CARPETA,
      estado: "en_curso",
      ronda: 0,
      rondasExtra: 0,
      cambios: [],
      enviada: false,
      mudada: false,
      historia: [],
    };

    // Diez sumas concurrentes a la ronda, cada una partiendo de lo que haya
    // **ahora**. Con `guardar` a secas (leer-calcular-guardar) el resultado
    // sería 1: todas leen 0 y la última pisa. Con `cambiar`, es 10.
    await Promise.all(
      Array.from({ length: 10 }, () =>
        cambiarPieza(CARPETA, PIEZA, (actual) => ({
          commit: { ...actual, ronda: actual.ronda + 1 },
        }))
      )
    );

    const final = await estadoDe(CARPETA, PIEZA);
    expect(final.ronda).toBe(10);
  });

  it("abort no toca nada y cuenta por qué", async () => {
    guardado[PIEZA] = {
      carpetaId: CARPETA,
      estado: "final",
      ronda: 3,
      rondasExtra: 0,
      cambios: [],
      enviada: true,
      mudada: false,
      historia: [],
    };

    const r = await cambiarPieza(CARPETA, PIEZA, () => ({ abort: "no se puede" as const }));
    expect(r).toEqual({ abort: "no se puede" });

    const final = await estadoDe(CARPETA, PIEZA);
    expect(final.ronda).toBe(3);
    expect(final.estado).toBe("final");
  });
})
