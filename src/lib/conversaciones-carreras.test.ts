// El techo de la conversación cuando dos cosas pasan a la vez.
//
// El doble del almacén se porta como Supabase y no como el de archivos:
// `guardar` es un reemplazo suelto, sin fila —el orden en que llegan dos
// pedidos no está garantizado—, y `cambiar` sí es un paso atómico. Con la fila
// del almacén de archivos estas carreras no se ven, y por eso pasaron.

import { beforeEach, describe, expect, it, vi } from "vitest";

const guardado: Record<string, Record<string, unknown>> = {};

/** Demoras que cada prueba prende para forzar el orden de la carrera. */
const demoras = {
  /** Cuánto tarda la próxima escritura de un tramo (guardar o cambiar). */
  primerTramo: 0,
  /** Cuánto tarda en volver la próxima búsqueda de tramos. */
  busqueda: 0,
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Consume la demora: solo la primera llamada la paga. */
const tomar = (cual: keyof typeof demoras) => {
  const ms = demoras[cual];
  demoras[cual] = 0;
  return ms;
};

vi.mock("@/lib/almacen", () => {
  const colecciones = (nombre: string) => (guardado[nombre] ??= {});

  const filas: Record<string, Promise<unknown>> = {};
  const enFila = <T,>(nombre: string, tarea: () => Promise<T> | T): Promise<T> => {
    const proxima = (filas[nombre] ?? Promise.resolve()).then(tarea, tarea);
    filas[nombre] = proxima.catch(() => undefined);
    return proxima;
  };

  const esTramo = (nombre: string) => nombre === "conversaciones-antes";

  const coleccion = (nombre: string) => ({
    todo: async () => ({ ...colecciones(nombre) }),
    losQueEmpiezanCon: async (prefijo: string) => {
      // Se lee primero y se contesta después: es la foto que la búsqueda sacó
      // antes de que otro escribiera.
      const foto = Object.fromEntries(
        Object.entries(colecciones(nombre)).filter(([id]) => id.startsWith(prefijo))
      );
      await esperar(tomar("busqueda"));
      return foto;
    },
    uno: async (id: string) => colecciones(nombre)[id],
    // Sin fila, como un upsert suelto: el que llega último gana.
    guardar: async (id: string, v: unknown) => {
      if (esTramo(nombre)) await esperar(tomar("primerTramo"));
      colecciones(nombre)[id] = v;
    },
    guardarVarios: async (cambios: Record<string, unknown>) => {
      for (const [id, v] of Object.entries(cambios)) {
        if (v === undefined) delete colecciones(nombre)[id];
        else colecciones(nombre)[id] = v;
      }
    },
    borrar: async (id: string) => {
      delete colecciones(nombre)[id];
    },
    // Atómico: la demora corre adentro del paso, así que el otro espera.
    cambiar: async (id: string, como: (actual: unknown) => unknown) =>
      enFila(nombre, async () => {
        if (esTramo(nombre)) await esperar(tomar("primerTramo"));
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
      escribir: async (v: unknown) => {
        colecciones(nombre).unico = v;
      },
      cambiar: async (como: (actual: unknown) => unknown) =>
        enFila(nombre, () => {
          const nuevo = como(colecciones(nombre).unico ?? porOmision);
          colecciones(nombre).unico = nuevo;
          return nuevo;
        }),
    }),
  };
});

const { agregarMensaje, hayAnteriores, leerConversacion, leerConversacionEntera } =
  await import("@/lib/conversaciones");

const CLIENTE = "cafe-otono";

/** Un hilo de 400 mensajes ya guardado, justo en el borde del techo. */
function hiloEnElBorde(): void {
  const base = Date.parse("2026-01-01T00:00:00.000Z");
  guardado.conversaciones = {
    [CLIENTE]: {
      mensajes: Array.from({ length: 400 }, (_, i) => ({
        id: `m${i}`,
        de: "cliente",
        quien: "Marina",
        texto: `mensaje ${i}`,
        cuando: new Date(base + i * 1000).toISOString(),
      })),
    },
  };
}

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
  demoras.primerTramo = 0;
  demoras.busqueda = 0;
});

describe("dos mudanzas a la vez", () => {
  // Las dos ven el hilo pasado del techo, arman un tramo con el mismo primer
  // mensaje —o sea, con el mismo nombre— y cada una saca los suyos del hilo
  // vivo. Si el tramo más corto se escribe último y pisa al más largo, el
  // mensaje que solo estaba en el largo no queda en ningún lado.
  it("no se pierde ningún mensaje", async () => {
    hiloEnElBorde();
    demoras.primerTramo = 30;

    await Promise.all([
      agregarMensaje(CLIENTE, "cliente", "Marina", "A"),
      agregarMensaje(CLIENTE, "agencia", "Nari", "B"),
    ]);

    const todos = await leerConversacionEntera(CLIENTE);
    const ids = new Set(todos.map((m) => m.id));
    expect(ids.has("m0"), "El primero que se dijo tiene que seguir estando.").toBe(true);
    expect(ids.has("m99")).toBe(true);
    expect(todos.map((m) => m.texto)).toEqual(expect.arrayContaining(["A", "B"]));
    expect(todos, "Eran 400 y se agregaron 2.").toHaveLength(402);
    expect(await leerConversacion(CLIENTE)).toHaveLength(300);
  });
});

describe("«¿hay algo anterior?» mientras se muda", () => {
  // La primera pregunta de un hilo sin la marca busca los tramos y la anota.
  // Si la mudanza corre entre la búsqueda y la anotación, lo que la búsqueda
  // vio —nada— no puede pisar el `true` que dejó la mudanza: la marca ya no se
  // vuelve a averiguar y «Ver lo anterior» no aparecería nunca más.
  it("no pisa con false lo que la mudanza dejó en true", async () => {
    hiloEnElBorde();
    demoras.busqueda = 30;

    await Promise.all([
      hayAnteriores(CLIENTE),
      agregarMensaje(CLIENTE, "cliente", "Marina", "el que rota"),
    ]);

    expect(Object.keys(guardado["conversaciones-antes"] ?? {})).toHaveLength(1);
    expect(await hayAnteriores(CLIENTE)).toBe(true);
  });
});
