// El freno de los que prueban.
//
// Lo que se prueba acá es que **frena de verdad**, incluso cuando los intentos
// llegan todos juntos: ocho a la vez contando como uno es exactamente lo que
// haría quien viene a probar en serio, y es la forma en que un freno puede
// estar puesto sin frenar nada.

import { beforeEach, describe, expect, it, vi } from "vitest";

const guardado: Record<string, unknown> = {};

// Un almacén en memoria que cumple el contrato, `cambiar` incluido: con un
// doble que no hace cola, esta prueba probaría el doble.
vi.mock("@/lib/almacen", () => {
  let fila: Promise<unknown> = Promise.resolve();
  const enFila = <T,>(tarea: () => T): Promise<T> => {
    const proxima = fila.then(tarea, tarea);
    fila = proxima.catch(() => undefined);
    return proxima;
  };

  return {
    coleccion: () => ({
      todo: async () => ({ ...guardado }),
      uno: async (id: string) => guardado[id],
      guardar: async (id: string, v: unknown) =>
        enFila(() => {
          guardado[id] = v;
        }),
      guardarVarios: async (cambios: Record<string, unknown>) =>
        enFila(() => {
          for (const [id, v] of Object.entries(cambios)) {
            if (v === undefined) delete guardado[id];
            else guardado[id] = v;
          }
        }),
      borrar: async (id: string) =>
        enFila(() => {
          delete guardado[id];
        }),
      cambiar: async (id: string, como: (a: unknown) => unknown) =>
        enFila(() => {
          const nuevo = como(guardado[id]);
          if (nuevo === undefined) delete guardado[id];
          else guardado[id] = nuevo;
          return nuevo;
        }),
    }),
  };
});

const { anotarError, frenado, olvidarErrores, intentarYFrenar } = await import("@/lib/frenos");

const LIMITE = { tope: 3, espera: 60_000 };
const QUIEN = "puerta:marina@cafe.test";

beforeEach(() => {
  vi.useRealTimers();
  for (const k of Object.keys(guardado)) delete guardado[k];
});

describe("frena después de tantos errores", () => {
  it("con menos que el tope todavía deja", async () => {
    await anotarError(QUIEN, LIMITE);
    await anotarError(QUIEN, LIMITE);

    expect(await frenado(QUIEN, LIMITE)).toBe(false);
  });

  it("llegando al tope, frena", async () => {
    for (let i = 0; i < 3; i++) await anotarError(QUIEN, LIMITE);

    expect(await frenado(QUIEN, LIMITE)).toBe(true);
  });

  it("preguntar no cuenta", async () => {
    // Si preguntar sumara, la pantalla se frenaría sola con solo mirarla.
    for (let i = 0; i < 20; i++) await frenado(QUIEN, LIMITE);

    expect(await frenado(QUIEN, LIMITE)).toBe(false);
  });
});

describe("ocho intentos en el mismo instante", () => {
  // **Es la forma en que un freno se rompe sin que nadie lo note.** Leer la
  // cuenta, sumarle uno y guardarla en tres pasos hace que ocho intentos
  // simultáneos lean todos el mismo número y guarden todos el mismo número:
  // quedan contados como uno, y el freno no frena.
  it("cuentan ocho, no uno", async () => {
    await Promise.all(Array.from({ length: 8 }, () => anotarError(QUIEN, LIMITE)));

    expect(
      (guardado[QUIEN] as { cuantos: number }).cuantos,
      "Si esto da menos de ocho, el freno se puede saltar mandando todo junto."
    ).toBe(8);
    expect(await frenado(QUIEN, LIMITE)).toBe(true);
  });
});

describe("el freno se suelta solo", () => {
  it("cuando pasa la espera", async () => {
    for (let i = 0; i < 3; i++) await anotarError(QUIEN, LIMITE);
    expect(await frenado(QUIEN, LIMITE)).toBe(true);

    // Se mueve el reloj en vez de esperar de verdad: una prueba que duerme un
    // minuto es una prueba que nadie corre.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + LIMITE.espera + 1000);

    expect(await frenado(QUIEN, LIMITE)).toBe(false);
  });

  it("la ventana se corre con cada error", async () => {
    // Si no, alcanzaría con probar tres, esperar el minuto y volver a probar
    // tres, para siempre.
    await anotarError(QUIEN, LIMITE);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + LIMITE.espera - 1000);
    await anotarError(QUIEN, LIMITE);
    await anotarError(QUIEN, LIMITE);

    expect(await frenado(QUIEN, LIMITE)).toBe(true);
  });
});

describe("entrar bien lo borra", () => {
  it("la cuenta desaparece", async () => {
    for (let i = 0; i < 3; i++) await anotarError(QUIEN, LIMITE);
    await olvidarErrores(QUIEN);

    expect(await frenado(QUIEN, LIMITE)).toBe(false);
    expect(guardado[QUIEN]).toBeUndefined();
  });
});

describe("no se junta basura para siempre", () => {
  it("las cuentas vencidas se van solas", async () => {
    // Sin esto quedaría guardada para siempre la lista de todos los correos
    // que alguien probó alguna vez, y no hay ninguna razón para conservarla.
    await anotarError("puerta:viejo@prueba.test", LIMITE);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + LIMITE.espera + 1000);
    await anotarError("puerta:nuevo@prueba.test", LIMITE);

    expect(Object.keys(guardado)).toEqual(["puerta:nuevo@prueba.test"]);
  });

  it("no se lleva puesta una que todavía corre", async () => {
    await anotarError("puerta:uno@prueba.test", LIMITE);
    await anotarError("puerta:dos@prueba.test", LIMITE);

    expect(Object.keys(guardado).sort()).toEqual([
      "puerta:dos@prueba.test",
      "puerta:uno@prueba.test",
    ]);
  });
});

describe("cada uno tiene su cuenta", () => {
  it("probar contra una no traba a las demás", async () => {
    for (let i = 0; i < 3; i++) await anotarError(QUIEN, LIMITE);

    expect(await frenado("puerta:otra@prueba.test", LIMITE)).toBe(false);
  });
});

describe("intentarYFrenar cuenta y frena en un solo paso", () => {
  it("una ráfaga concurrente no supera el tope", async () => {
    // Diez intentos a la vez sobre un tope de tres. Con `frenado` + `anotarError`
    // por separado, los diez leían la cuenta en cero y pasaban todos. Con la
    // suma y la comprobación juntas, solo los primeros tres no frenan.
    const frenos = await Promise.all(
      Array.from({ length: 10 }, () => intentarYFrenar(QUIEN, LIMITE))
    );
    const dejaronPasar = frenos.filter((f) => f === false).length;
    expect(dejaronPasar).toBe(LIMITE.tope);
    expect((guardado[QUIEN] as { cuantos: number }).cuantos).toBe(10);
  });

  it("acertar y olvidar deja la cuenta limpia", async () => {
    await intentarYFrenar(QUIEN, LIMITE);
    await intentarYFrenar(QUIEN, LIMITE);
    await olvidarErrores(QUIEN);
    expect(await frenado(QUIEN, LIMITE)).toBe(false);
    expect(guardado[QUIEN]).toBeUndefined();
  });
})
