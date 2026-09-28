import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// El almacén escribe en `datos/`, al lado de donde corre. Para probarlo se lo
// muda a una carpeta temporal y se lo devuelve al terminar: una prueba que
// escribe en los datos de verdad es una prueba que un día borra algo.
const original = process.cwd();
const temporal = await mkdtemp(path.join(tmpdir(), "mesa-"));
process.chdir(temporal);

const { enArchivos } = await import("@/lib/almacen/enArchivos");

afterAll(async () => {
  process.chdir(original);
  await rm(temporal, { recursive: true, force: true });
});

type Cosa = { valor: number };
const esCosa = (v: unknown): v is Cosa =>
  Boolean(v) && typeof (v as Cosa).valor === "number";

/**
 * Cada prueba estrena su propia colección, con un nombre nuevo.
 *
 * **Antes se borraba la carpeta entre pruebas, y eso dependía de que el sistema
 * de archivos cooperara.** En Windows, con la máquina cargada, `rm` no siempre
 * termina a tiempo: la prueba siguiente encontraba los veintiocho documentos
 * que había dejado la anterior y fallaba —«esperaba x, y, z y encontré p0…p27»—
 * sin que hubiera nada mal en el almacén. Y una prueba que pasa sola y falla en
 * conjunto es una prueba que se deja de mirar.
 *
 * Un nombre distinto por prueba es un archivo distinto: no hay nada que borrar.
 */
let cuantas = 0;
let coleccion = enArchivos.coleccion<Cosa>("prueba0", esCosa);
/** Dónde escribe la colección de esta prueba, para mirar el archivo crudo. */
let archivoDeLaPrueba = path.join(temporal, "datos", "prueba0.json");

beforeEach(() => {
  cuantas += 1;
  coleccion = enArchivos.coleccion<Cosa>(`prueba${cuantas}`, esCosa);
  archivoDeLaPrueba = path.join(temporal, "datos", `prueba${cuantas}.json`);
});

describe("dos cosas guardándose a la vez", () => {
  // **Es la falla que más duele y la que menos se ve.** Cada guardado lee el
  // archivo entero, le pega el cambio y lo reescribe. Sin hacer cola, el
  // cliente aprobando una pieza mientras la agencia entrega otra terminaba con
  // un cambio pisado: sin error, sin aviso, sin rastro.
  it("no se pisan: quedan las dos", async () => {
    await Promise.all([
      coleccion.guardar("a", { valor: 1 }),
      coleccion.guardar("b", { valor: 2 }),
    ]);

    expect(await coleccion.todo()).toEqual({ a: { valor: 1 }, b: { valor: 2 } });
  });

  it(
    "aguanta muchas de golpe",
    async () => {
      const cuantas = 25;
      await Promise.all(
        Array.from({ length: cuantas }, (_, i) =>
          coleccion.guardar(`p${i}`, { valor: i })
        )
      );

      const todo = await coleccion.todo();
      expect(Object.keys(todo)).toHaveLength(cuantas);
      expect(todo.p7).toEqual({ valor: 7 });
    },
    // Son veinticinco escrituras en fila, cada una reescribe el archivo entero.
    // Sola tarda milisegundos; corriendo con toda la batería —un worker por
    // archivo, decenas a la vez peleando por el disco en Windows— el tope de
    // cinco segundos se alcanzaba sin que hubiera nada mal en el almacén. Lo que
    // se prueba es que no se pierda ninguna, no cuánto tarda: se le da aire.
    20_000
  );

  it("mezcla de guardar, guardarVarios y borrar sin perder nada", async () => {
    await coleccion.guardar("queda", { valor: 0 });
    await Promise.all([
      coleccion.guardarVarios({ x: { valor: 10 }, y: { valor: 11 } }),
      coleccion.guardar("z", { valor: 12 }),
      coleccion.borrar("queda"),
    ]);

    const todo = await coleccion.todo();
    expect(Object.keys(todo).sort()).toEqual(["x", "y", "z"]);
  });

  it("un error no traba la fila", async () => {
    // Si la cola se rompiera con el primer fallo, la aplicación dejaría de
    // guardar para siempre sin decir nada. Peor que el problema original.
    const roto = coleccion.guardar("malo", { valor: BigInt(1) as unknown as number });
    await roto.catch(() => undefined);

    await coleccion.guardar("bueno", { valor: 3 });
    expect((await coleccion.todo()).bueno).toEqual({ valor: 3 });
  });
});

describe("lo que ya hacía bien", () => {
  it("escribe entero o no escribe", async () => {
    await coleccion.guardar("a", { valor: 1 });
    const crudo = await readFile(archivoDeLaPrueba, "utf8");
    expect(JSON.parse(crudo)).toEqual({ a: { valor: 1 } });
  });

  it("lo que no tiene la forma esperada no sale", async () => {
    await coleccion.guardar("a", { valor: 1 });
    await coleccion.guardar("raro", { valor: "dos" } as unknown as Cosa);
    expect(await coleccion.todo()).toEqual({ a: { valor: 1 } });
  });
});

describe("cambiar el mismo documento a la vez", () => {
  // **Es la carrera que `guardar` no puede resolver.** Dos escrituras al
  // **mismo** documento: leer, pensar sobre lo leído, escribir. Con `guardar`,
  // las dos leen lo mismo y la segunda pisa a la primera. Es lo que hacía que
  // el cliente y la agencia escribiendo en el mismo instante perdieran un
  // mensaje.
  const sumar = (n: number) => (actual: Cosa | undefined) => ({
    valor: (actual?.valor ?? 0) + n,
  });

  it("veinte sumas al mismo documento suman veinte", async () => {
    await Promise.all(Array.from({ length: 20 }, () => coleccion.cambiar("cuenta", sumar(1))));

    expect(
      await coleccion.uno("cuenta"),
      "Si esto da menos de 20, hay escrituras que se pisaron."
    ).toEqual({ valor: 20 });
  });

  it("devuelve lo que quedó guardado", async () => {
    expect(await coleccion.cambiar("x", sumar(5))).toEqual({ valor: 5 });
    expect(await coleccion.cambiar("x", sumar(3))).toEqual({ valor: 8 });
  });

  it("devolver undefined lo borra", async () => {
    await coleccion.guardar("y", { valor: 1 });
    expect(await coleccion.cambiar("y", () => undefined)).toBeUndefined();
    expect(await coleccion.uno("y")).toBeUndefined();
  });

  it("no se lleva puesto lo de al lado", async () => {
    await coleccion.guardar("vecino", { valor: 99 });
    await Promise.all([
      coleccion.cambiar("propio", sumar(1)),
      coleccion.cambiar("propio", sumar(1)),
      coleccion.guardar("otro", { valor: 7 }),
    ]);

    expect(await coleccion.todo()).toEqual({
      vecino: { valor: 99 },
      propio: { valor: 2 },
      otro: { valor: 7 },
    });
  });
});

describe("un archivo tocado a mano", () => {
  // **Estos archivos se abren con el Bloc de notas**, y el Bloc de notas puede
  // dejar la marca de orden de bytes al principio; a mano también se escapa
  // una coma de más. Antes cualquiera de las dos se leía como «no hay nada», y
  // la próxima escritura partía de vacío: se borraba la colección entera.
  const escribirAMano = async (texto: string) => {
    await mkdir(path.dirname(archivoDeLaPrueba), { recursive: true });
    await writeFile(archivoDeLaPrueba, texto, "utf8");
  };

  it("con la marca del Bloc de notas se lee igual", async () => {
    await escribirAMano('﻿{"a":{"valor":1},"b":{"valor":2}}');

    expect(await coleccion.todo()).toEqual({ a: { valor: 1 }, b: { valor: 2 } });
    await coleccion.guardar("c", { valor: 3 });
    expect(Object.keys(JSON.parse(await readFile(archivoDeLaPrueba, "utf8"))).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("si no se puede leer, falla y no lo pisa", async () => {
    const roto = '{ "a": {"valor":1}, "b": {"valor":2}, }';
    await escribirAMano(roto);

    await expect(coleccion.todo()).rejects.toThrow();
    await expect(coleccion.cambiar("z", () => ({ valor: 9 }))).rejects.toThrow();
    await expect(coleccion.guardar("z", { valor: 9 })).rejects.toThrow();
    expect(await readFile(archivoDeLaPrueba, "utf8")).toBe(roto);
  });

  it("un documento suelto roto tampoco se pisa", async () => {
    await escribirAMano("{ roto");
    const doc = enArchivos.documento<Record<string, number>>(
      `prueba${cuantas}`,
      (v): v is Record<string, number> => Boolean(v) && typeof v === "object",
      {}
    );

    await expect(doc.leer()).rejects.toThrow();
    await expect(doc.cambiar((actual) => ({ ...actual, x: 1 }))).rejects.toThrow();
    expect(await readFile(archivoDeLaPrueba, "utf8")).toBe("{ roto");
  });

  it("si todavía no existe, está vacío", async () => {
    expect(await coleccion.todo()).toEqual({});
  });
});

describe("un documento suelto que se cambia a la vez", () => {
  // Las marcas de «hasta dónde leyó cada lado» viven en un documento único, y
  // las escriben los dos lados. Sin esto, el cliente y la agencia marcando
  // leído al mismo tiempo perdían una de las dos marcas.
  const doc = enArchivos.documento<Record<string, number>>(
    "suelto",
    (v): v is Record<string, number> => Boolean(v) && typeof v === "object",
    {}
  );

  it("diez marcas distintas quedan las diez", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        doc.cambiar((actual) => ({ ...actual, [`c${i}`]: i }))
      )
    );

    expect(Object.keys(await doc.leer())).toHaveLength(10);
  });
});
