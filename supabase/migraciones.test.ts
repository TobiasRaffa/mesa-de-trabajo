import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Verifica las migraciones con el analizador de verdad de Postgres, compilado
// a WebAssembly. No hace falta una base de datos corriendo.
//
// No comprueba que las tablas tengan sentido -- eso es trabajo nuestro -- pero
// sí que ninguna migración tenga un error de escritura que la haga fallar a
// mitad de camino, dejando la base a medio construir. Que es exactamente el
// tipo de error que no se quiere descubrir ejecutándola.

const CARPETA = join(import.meta.dirname, "migraciones");

const archivos = readdirSync(CARPETA)
  .filter((n) => n.endsWith(".sql"))
  .sort();

describe("migraciones", () => {
  it("hay al menos una", () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it("se numeran en orden y sin repetir", () => {
    // Se aplican en orden alfabético, así que el orden del nombre es el orden
    // de ejecución. Dos migraciones con el mismo número serían una lotería.
    const numeros = archivos.map((n) => n.slice(0, 3));
    expect(new Set(numeros).size).toBe(numeros.length);
    expect([...numeros].sort()).toEqual(numeros);
  });

  it.each(archivos)("%s tiene sintaxis válida de Postgres", async (archivo) => {
    const { parse, formatSqlError, hasSqlDetails } = await import("libpg-query");
    const sql = readFileSync(join(CARPETA, archivo), "utf8");

    let sentencias: unknown[] = [];
    try {
      const resultado = await parse(sql);
      sentencias = resultado.stmts ?? [];
    } catch (e) {
      // El error de Postgres dice línea y columna; sin esto se pierde.
      const detalle = hasSqlDetails(e) ? formatSqlError(e, sql) : String(e);
      throw new Error(`${archivo} no compila:\n${detalle}`);
    }

    expect(sentencias.length).toBeGreaterThan(0);
  });
});
