import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
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

const coleccion = enArchivos.coleccion<Cosa>("prueba", esCosa);

beforeEach(async () => {
  await rm(path.join(temporal, "datos"), { recursive: true, force: true });
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

  it("aguanta muchas de golpe", async () => {
    const cuantas = 25;
    await Promise.all(
      Array.from({ length: cuantas }, (_, i) =>
        coleccion.guardar(`p${i}`, { valor: i })
      )
    );

    const todo = await coleccion.todo();
    expect(Object.keys(todo)).toHaveLength(cuantas);
    expect(todo.p7).toEqual({ valor: 7 });
  });

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
    const crudo = await readFile(path.join(temporal, "datos", "prueba.json"), "utf8");
    expect(JSON.parse(crudo)).toEqual({ a: { valor: 1 } });
  });

  it("lo que no tiene la forma esperada no sale", async () => {
    await coleccion.guardar("a", { valor: 1 });
    await coleccion.guardar("raro", { valor: "dos" } as unknown as Cosa);
    expect(await coleccion.todo()).toEqual({ a: { valor: 1 } });
  });
});
