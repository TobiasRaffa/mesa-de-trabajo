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

describe("el script que sube los datos", () => {
  const script = readFileSync(join(import.meta.dirname, "subir-datos.mjs"), "utf8");

  it("sabe cuáles son un solo documento y cuáles una colección", () => {
    // **Es la diferencia entre migrar bien y migrar en silencio mal.**
    // `leidos.json` no es «muchos documentos con su identificador», es uno: su
    // objeto tiene adentro los dos lados. Subido como colección se parte en
    // dos filas —«agencia» y «cliente»— y la aplicación, que pide la fila
    // «unico», no encuentra ninguna. El día después de la mudanza todos los
    // chats aparecen con todo sin leer y nadie sabe por qué.
    //
    // Se compara contra el código de verdad: la lista escrita a mano envejece
    // el día que alguien agrega un `documento(...)` nuevo.
    const fuente = readdirSync(join(import.meta.dirname, "..", "src", "lib"))
      .filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))
      .map((n) => readFileSync(join(import.meta.dirname, "..", "src", "lib", n), "utf8"))
      .join("\n");

    const enElCodigo = [...fuente.matchAll(/\bdocumento<[^>]*>\(\s*"([^"]+)"/g)]
      .map((m) => m[1])
      .sort();
    expect(enElCodigo.length, "No encontré ningún documento suelto.").toBeGreaterThan(0);

    const enElScript = script.match(/const SUELTOS = new Set\(\[([^\]]*)\]\)/);
    expect(enElScript, "El script ya no tiene la lista de documentos sueltos.").toBeTruthy();

    const declarados = [...enElScript![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();

    expect(
      declarados,
      "La lista del script no coincide con los `documento(...)` del código. " +
        "El que falte se va a subir partido en pedazos, y la aplicación no lo " +
        "va a encontrar."
    ).toEqual(enElCodigo);
  });

  it("no escribe si no se lo piden", () => {
    // Un script de migración que escribe con solo llamarlo es el que un día se
    // corre por accidente encima de la base buena.
    expect(script).toContain('process.argv.includes("--escribir")');
  });
});
