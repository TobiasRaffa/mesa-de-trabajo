import { beforeEach, describe, expect, it, vi } from "vitest";

// El almacén se reemplaza por uno en memoria: lo que se prueba acá es la regla
// —cuándo una pieza sigue siendo la misma y cuándo vuelve a empezar—, no cómo
// se guarda.
const guardado: Record<string, unknown> = {};

vi.mock("@/lib/almacen", () => ({
  coleccion: () => ({
    todo: async () => guardado,
    uno: async (id: string) => guardado[id],
    guardar: async (id: string, v: unknown) => {
      guardado[id] = v;
    },
    guardarVarios: async (varios: Record<string, unknown>) => {
      Object.assign(guardado, varios);
    },
  }),
}));

const { estadosDe } = await import("@/lib/piezas");
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
