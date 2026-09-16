import { describe, expect, it } from "vitest";
import {
  cambiosPorVuelta,
  enPalabrasLoRevisado,
  versionQueMira,
  type HitoLeido,
} from "@/dominio/historia";

const enviada = (detalle?: string): HitoLeido => ({ que: "revision_enviada", detalle });
const entregada = (detalle?: string): HitoLeido => ({ que: "entregada", detalle });

describe("qué pidió el cliente en cada vuelta", () => {
  // Lo pedido no vive en la pieza: la lista se vacía al entregar la vuelta
  // siguiente. Lo único que queda de la V1 es lo que se anotó al cerrarla, y
  // sin esto «¿por qué la v2 salió así?» no tiene respuesta a los dos meses.
  it("lee la forma de ahora, con la versión adelante", () => {
    const r = cambiosPorVuelta([
      entregada(),
      enviada("V1: 1) cambiar el color  2) agrandar el logo"),
      entregada("Responde a: 1) cambiar el color  2) agrandar el logo"),
    ]);

    expect(r).toEqual([
      { version: 1, puntos: ["cambiar el color", "agrandar el logo"], abierta: false },
    ]);
  });

  it("lee la forma vieja, donde quedó del lado de la entrega", () => {
    // Piezas guardadas antes de que el envío lo anotara. Si esto no se leyera,
    // toda la conversación de los trabajos que ya existen desaparecería.
    const r = cambiosPorVuelta([
      entregada(),
      enviada(),
      entregada("Responde a: 1) camiba el color"),
    ]);

    expect(r).toEqual([{ version: 1, puntos: ["camiba el color"], abierta: false }]);
  });

  it("separa vuelta por vuelta", () => {
    const r = cambiosPorVuelta([
      enviada("V1: 1) el color"),
      entregada("Responde a: 1) el color"),
      enviada("V2: 1) el tamaño  2) la tipografía"),
      entregada("Responde a: 1) el tamaño  2) la tipografía"),
    ]);

    expect(r.map((v) => v.version)).toEqual([1, 2]);
    expect(r[1].puntos).toEqual(["el tamaño", "la tipografía"]);
  });

  it("lo que está pidiendo ahora va al final, marcado abierto", () => {
    // Mientras no lo mande, puede seguir escribiendo: la agencia lo ve pero no
    // es una devolución cerrada.
    const r = cambiosPorVuelta([enviada("V1: 1) el color")], ["y el fondo"], 2, false);

    expect(r[1]).toEqual({ version: 2, puntos: ["y el fondo"], abierta: true });
  });

  it("una pieza sin vueltas no inventa ninguna", () => {
    expect(cambiosPorVuelta([entregada()])).toEqual([]);
  });

  it("un detalle que no es una lista de cambios se ignora", () => {
    // «Se borró el archivo y se subió otro» también lleva detalle, y no es
    // algo que haya pedido el cliente.
    const r = cambiosPorVuelta([
      enviada(),
      entregada("cualquier otra cosa escrita acá"),
    ]);
    expect(r).toEqual([]);
  });
});

describe("lo mandado y todavía sin contestar aparece una sola vez", () => {
  // **El caso que lo destapó, tal cual estaba en los datos.** El cliente mandó
  // sus cambios y la agencia todavía no entregó la vuelta: la lista de la
  // pieza sigue llena —se vacía recién al entregar— y además el envío quedó
  // anotado en la historia. Sumando las dos, el mismo pedido salía dos veces,
  // uno debajo del otro, como si hubiera pedido lo mismo dos veces.
  const historia: HitoLeido[] = [
    enviada(),
    entregada("Responde a: 1) camiba el color"),
    enviada(),
    entregada("Responde a: 1) sadasd"),
    enviada("V3: 1) Hola quiero la v3"),
  ];

  it("no lo repite", () => {
    const r = cambiosPorVuelta(historia, ["Hola quiero la v3"], 3, true);

    expect(r.map((v) => v.version)).toEqual([1, 2, 3]);
    expect(r.filter((v) => v.puntos.includes("Hola quiero la v3"))).toHaveLength(1);
  });

  it("cada vuelta con lo suyo", () => {
    const r = cambiosPorVuelta(historia, ["Hola quiero la v3"], 3, true);

    expect(r[0].puntos).toEqual(["camiba el color"]);
    expect(r[1].puntos).toEqual(["sadasd"]);
    expect(r[2].puntos).toEqual(["Hola quiero la v3"]);
  });

  it("si se mandó antes de que el envío lo anotara, no se pierde", () => {
    // Mandado con la forma vieja y todavía sin entregar: la única copia está
    // en la pieza. Sin esto, lo que el cliente acaba de pedir no se veía.
    const r = cambiosPorVuelta([enviada()], ["el color de fondo"], 2, true);

    expect(r).toEqual([{ version: 1, puntos: ["el color de fondo"], abierta: false }]);
  });

  it("lo que está escribiendo y no mandó sí se muestra aparte", () => {
    const r = cambiosPorVuelta([enviada("V1: 1) el color")], ["y el fondo"], 2, false);

    expect(r).toHaveLength(2);
    expect(r[1]).toEqual({ version: 2, puntos: ["y el fondo"], abierta: true });
  });
});

describe("qué versión está mirando el cliente", () => {
  // La ronda cuenta las vueltas cerradas: la que se mira es la siguiente.
  it("sin ninguna vuelta cerrada, mira la v1", () => {
    expect(versionQueMira(0)).toBe(1);
  });

  it("con dos cerradas, mira la v3", () => {
    expect(versionQueMira(2)).toBe(3);
  });
});

describe("cómo se nombra lo que el cliente revisó", () => {
  it("una pieza lleva su nombre y su versión", () => {
    expect(enPalabrasLoRevisado([{ nombre: "stickers", version: 3 }])).toBe(
      "la v3 de stickers"
    );
  });

  it("varias de la misma vuelta se cuentan", () => {
    expect(
      enPalabrasLoRevisado([
        { nombre: "stickers", version: 2 },
        { nombre: "banner", version: 2 },
      ])
    ).toBe("la v2 de 2 piezas");
  });

  it("varias de vueltas distintas dicen cuáles vueltas", () => {
    // Acá no hay un número que las resuma: decir «la v2 de 3 piezas» sería
    // afirmar algo falso sobre dos de las tres.
    expect(
      enPalabrasLoRevisado([
        { nombre: "a", version: 3 },
        { nombre: "b", version: 1 },
        { nombre: "c", version: 2 },
      ])
    ).toBe("3 piezas (v1, v2 y v3)");
  });

  it("dos vueltas distintas se unen con «y», sin coma", () => {
    expect(
      enPalabrasLoRevisado([
        { nombre: "a", version: 1 },
        { nombre: "b", version: 2 },
      ])
    ).toBe("2 piezas (v1 y v2)");
  });

  it("sin piezas no inventa una frase", () => {
    expect(enPalabrasLoRevisado([])).toBe("");
  });
});
