// La conversación: que no se pierda nada de lo que alguien escribió.
//
// Son las dos fallas que este módulo tuvo y que no se ven mirando la pantalla:
// dos personas escribiendo en el mismo instante —y un mensaje que no llega
// nunca—, y un hilo que crece sin techo hasta hacer lento cada guardado.
//
// El almacén se reemplaza por uno en memoria que **cumple el contrato de
// verdad**, incluido `cambiar`: probar el techo contra un doble que no hace
// cola sería probar el doble.

import { beforeEach, describe, expect, it, vi } from "vitest";

const guardado: Record<string, Record<string, unknown>> = {};

vi.mock("@/lib/almacen", () => {
  const colecciones = (nombre: string) => (guardado[nombre] ??= {});

  // Una fila por colección, igual que el almacén de archivos: lo que se
  // serializa es el par leer+escribir, que es donde está la carrera.
  const filas: Record<string, Promise<unknown>> = {};
  const enFila = <T,>(nombre: string, tarea: () => Promise<T> | T): Promise<T> => {
    const proxima = (filas[nombre] ?? Promise.resolve()).then(tarea, tarea);
    filas[nombre] = proxima.catch(() => undefined);
    return proxima;
  };

  const coleccion = (nombre: string) => ({
    todo: async () => ({ ...colecciones(nombre) }),
    uno: async (id: string) => colecciones(nombre)[id],
    guardar: async (id: string, v: unknown) =>
      enFila(nombre, () => {
        colecciones(nombre)[id] = v;
      }),
    guardarVarios: async (cambios: Record<string, unknown>) =>
      enFila(nombre, () => {
        for (const [id, v] of Object.entries(cambios)) {
          if (v === undefined) delete colecciones(nombre)[id];
          else colecciones(nombre)[id] = v;
        }
      }),
    borrar: async (id: string) =>
      enFila(nombre, () => {
        delete colecciones(nombre)[id];
      }),
    cambiar: async (id: string, como: (actual: unknown) => unknown) =>
      enFila(nombre, () => {
        const nuevo = como(colecciones(nombre)[id]);
        if (nuevo === undefined) delete colecciones(nombre)[id];
        else colecciones(nombre)[id] = nuevo;
        return nuevo;
      }),
  });

  return {
    coleccion,
    documento: (nombre: string, _valido: unknown, porOmision: unknown) => ({
      leer: async () => colecciones(nombre).unico ?? porOmision,
      escribir: async (v: unknown) =>
        enFila(nombre, () => {
          colecciones(nombre).unico = v;
        }),
      cambiar: async (como: (actual: unknown) => unknown) =>
        enFila(nombre, () => {
          const nuevo = como(colecciones(nombre).unico ?? porOmision);
          colecciones(nombre).unico = nuevo;
          return nuevo;
        }),
    }),
  };
});

const {
  agregarMensaje,
  hayAnteriores,
  leerConversacion,
  leerConversacionEntera,
  marcarLeido,
  sinLeerPorCliente,
} = await import("@/lib/conversaciones");

const CLIENTE = "cafe-otono";

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
});

const decir = (n: number) => agregarMensaje(CLIENTE, "cliente", "Marina", `mensaje ${n}`);

/** Escribe `cuantos` mensajes, uno atrás del otro. */
async function charlar(cuantos: number): Promise<void> {
  for (let i = 0; i < cuantos; i++) await decir(i);
}

describe("dos personas escribiendo en el mismo instante", () => {
  // **Es la falla que no deja rastro.** Antes era leer el hilo, sumarle el
  // mensaje y guardarlo: el cliente y la agencia escribiendo a la vez leían lo
  // mismo, y el segundo en guardar se llevaba puesto el mensaje del primero.
  // Sin error, sin aviso, y lo que se perdía era algo que alguien escribió.
  it("no se pisan: llegan los dos", async () => {
    await Promise.all([
      agregarMensaje(CLIENTE, "cliente", "Marina", "¿llega el jueves?"),
      agregarMensaje(CLIENTE, "agencia", "Nari", "te mando la v2 hoy"),
    ]);

    const textos = (await leerConversacion(CLIENTE)).map((m) => m.texto);
    expect(textos).toHaveLength(2);
    expect(textos).toContain("¿llega el jueves?");
    expect(textos).toContain("te mando la v2 hoy");
  });

  it("diez de golpe son diez", async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => decir(i)));

    expect(
      await leerConversacion(CLIENTE),
      "Si esto da menos de diez, hay mensajes que se pisaron."
    ).toHaveLength(10);
  });

  it("los dos lados marcando leído a la vez quedan los dos", async () => {
    await Promise.all([marcarLeido("agencia", CLIENTE), marcarLeido("cliente", "otro")]);

    const [delaAgencia, delCliente] = await Promise.all([
      sinLeerPorCliente("agencia"),
      sinLeerPorCliente("cliente"),
    ]);
    // Las dos marcas viven en el mismo documento: si una pisó a la otra, una de
    // las dos vuelve a contar como sin leer.
    expect(delaAgencia[CLIENTE] ?? 0).toBe(0);
    expect(delCliente.otro ?? 0).toBe(0);
  });
});

describe("el techo de una conversación", () => {
  it("por debajo del tope no muda nada", async () => {
    await charlar(50);

    expect(await leerConversacion(CLIENTE)).toHaveLength(50);
    expect(await hayAnteriores(CLIENTE)).toBe(false);
  });

  it("pasado el tope, el hilo vivo queda corto", async () => {
    await charlar(401);

    const vivos = await leerConversacion(CLIENTE);
    expect(
      vivos.length,
      "El hilo vivo se reescribe entero en cada mensaje: si crece sin freno, " +
        "cada cosa que alguien dice cuesta más que la anterior."
    ).toBe(300);
    expect(await hayAnteriores(CLIENTE)).toBe(true);
  });

  it("**no se pierde ni uno**: lo mudado se sigue leyendo", async () => {
    await charlar(401);

    const todos = await leerConversacionEntera(CLIENTE);
    expect(todos).toHaveLength(401);
    expect(todos[0].texto, "El primero que se dijo tiene que seguir estando.").toBe(
      "mensaje 0"
    );
    expect(todos[400].texto).toBe("mensaje 400");
  });

  it("sale en orden y sin repetidos", async () => {
    await charlar(401);

    const todos = await leerConversacionEntera(CLIENTE);
    expect(new Set(todos.map((m) => m.id)).size).toBe(todos.length);
    expect(todos.map((m) => m.cuando)).toEqual([...todos.map((m) => m.cuando)].sort());
  });

  it("muda de a tandas y no en cada mensaje", async () => {
    // Sin el margen, del mensaje 301 en adelante cada mensaje mudaría uno: dos
    // escrituras por cada cosa que alguien dice, para siempre.
    await charlar(401);
    const despuesDelPrimerCorte = Object.keys(guardado["conversaciones-antes"] ?? {}).length;

    await charlar(50);
    expect(Object.keys(guardado["conversaciones-antes"] ?? {})).toHaveLength(
      despuesDelPrimerCorte
    );
    expect(await leerConversacion(CLIENTE)).toHaveLength(350);
  });

  it("sigue mudando en la tanda siguiente", async () => {
    await charlar(802);

    expect(Object.keys(guardado["conversaciones-antes"] ?? {}).length).toBeGreaterThan(1);
    expect(await leerConversacionEntera(CLIENTE)).toHaveLength(802);
  });

  it("lo de un cliente no se mezcla con lo de otro", async () => {
    await charlar(401);
    await agregarMensaje("otro-cliente", "cliente", "Juan", "hola");

    expect(await leerConversacionEntera("otro-cliente")).toHaveLength(1);
    expect(await hayAnteriores("otro-cliente")).toBe(false);
  });
});
