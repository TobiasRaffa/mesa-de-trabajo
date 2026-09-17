// El almacén de cuando esté en internet.
//
// Una sola tabla, `documentos(coleccion, id, datos jsonb)`. Es la forma que
// tiene lo que la aplicación guarda: once colecciones de documentos con su
// identificador, sin consultas que crucen unas con otras.
//
// **Por qué una tabla y no catorce.** Hubo catorce escritas en las primeras
// migraciones, de un diseño que la aplicación nunca implementó. Quedaron ahí
// describiendo algo que no existía, y conectarlas hubiera fallado de entrada.
// Un esquema que se escribe antes que el código envejece sin que nadie lo
// note; este no puede, porque es el mismo que usa el código.
//
// El día que haga falta cruzar datos —informes, facturación— se normaliza lo
// que lo necesite. Migrar de jsonb a columnas es una migración normal;
// arrancar con catorce tablas equivocadas es la deuda que ya tuvimos.
//
// Se habla por HTTP con `fetch`, igual que con Drive y con el correo: un
// select y un upsert son dos pedidos, y traer un cliente entero para eso es
// código que después hay que mantener.

import type { Almacen, Coleccion, Documento } from "@/lib/almacen/contrato";

/**
 * La llave **de servicio**, no la pública.
 *
 * Toda la lectura y la escritura pasan por el servidor: el navegador nunca
 * habla con la base. Por eso la llave que se usa es la que puede todo, y por
 * eso `documentos` tiene la política de acceso cerrada para todo el resto —lo
 * que protege los datos de un cliente sigue siendo el código, igual que hoy—.
 */
function credenciales(): { url: string; llave: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const llave = process.env.SUPABASE_SERVICE_KEY?.trim();
  return url && llave ? { url, llave } : null;
}

export function supabaseConfigurado(): boolean {
  return credenciales() !== null;
}

const TABLA = "documentos";

async function pedir(
  ruta: string,
  opciones: RequestInit & { prefer?: string } = {}
): Promise<unknown> {
  const cred = credenciales();
  if (!cred) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY.");

  const { prefer, ...resto } = opciones;
  const r = await fetch(`${cred.url}/rest/v1/${ruta}`, {
    ...resto,
    headers: {
      apikey: cred.llave,
      Authorization: `Bearer ${cred.llave}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
      ...resto.headers,
    },
    // Lo que se guarda nunca se cachea: el sentido de leerlo es lo último.
    cache: "no-store",
  });

  if (!r.ok) {
    const detalle = await r.text().catch(() => "");
    // El código va pegado al error porque hay uno que **no es una falla**: el
    // 409 de «esa fila ya existe», que en `cambiar` quiere decir que alguien
    // ganó la carrera y hay que volver a leer.
    throw Object.assign(
      new Error(`Supabase devolvió ${r.status}: ${detalle.slice(0, 200)}`),
      { estado: r.status }
    );
  }
  // Un DELETE o un upsert sin `return=representation` no traen cuerpo.
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

type Fila = { id: string; datos: unknown };

/** Si el error es «esa fila ya existe». */
const esChoque = (e: unknown) => (e as { estado?: number })?.estado === 409;

/**
 * Cuántas veces se vuelve a intentar un `cambiar` que perdió la carrera.
 *
 * Cinco. Cada reintento pasa porque **otro** guardó, así que cinco seguidas
 * quiere decir que hay una tormenta de escrituras sobre el mismo documento, y
 * eso ya no se arregla insistiendo: se avisa. Fallar es correcto; lo que no se
 * puede es guardar pisando lo del otro.
 */
const INTENTOS = 5;

export const enSupabase: Almacen = {
  coleccion<T>(nombre: string, valido: (valor: unknown) => valor is T): Coleccion<T> {
    const filtro = `coleccion=eq.${encodeURIComponent(nombre)}`;

    async function todo(): Promise<Record<string, T>> {
      const filas = (await pedir(
        `${TABLA}?${filtro}&select=id,datos&order=creado.asc`
      )) as Fila[] | null;

      const salida: Record<string, T> = {};
      for (const fila of filas ?? []) {
        // Lo que sale de la base se valida igual que lo que llega por la red:
        // alguien puede haberlo tocado a mano, o haberlo escrito una versión
        // anterior de la aplicación.
        if (valido(fila.datos)) salida[fila.id] = fila.datos;
      }
      return salida;
    }

    async function upsert(filas: Array<{ id: string; datos: T }>): Promise<void> {
      if (filas.length === 0) return;
      await pedir(`${TABLA}?on_conflict=coleccion,id`, {
        method: "POST",
        prefer: "resolution=merge-duplicates",
        body: JSON.stringify(filas.map((f) => ({ coleccion: nombre, ...f }))),
      });
    }

    async function borrarVarios(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      const lista = ids.map((i) => `"${i.replace(/"/g, '""')}"`).join(",");
      await pedir(`${TABLA}?${filtro}&id=in.(${encodeURIComponent(lista)})`, {
        method: "DELETE",
      });
    }

    return {
      todo,
      async uno(id) {
        const filas = (await pedir(
          `${TABLA}?${filtro}&id=eq.${encodeURIComponent(id)}&select=datos&limit=1`
        )) as Array<{ datos: unknown }> | null;
        const datos = filas?.[0]?.datos;
        return valido(datos) ? datos : undefined;
      },
      async guardar(id, valor) {
        await upsert([{ id, datos: valor }]);
      },
      async guardarVarios(cambios) {
        const aGuardar: Array<{ id: string; datos: T }> = [];
        const aBorrar: string[] = [];
        for (const [id, valor] of Object.entries(cambios)) {
          if (valor === undefined) aBorrar.push(id);
          else aGuardar.push({ id, datos: valor });
        }
        // Primero se borra y después se escribe: al revés, un corte en el
        // medio dejaría puesto lo nuevo **y** lo que había que sacar.
        await borrarVarios(aBorrar);
        await upsert(aGuardar);
      },
      async borrar(id) {
        await borrarVarios([id]);
      },

      /**
       * Leer y escribir en un solo paso.
       *
       * Acá no se puede hacer cola como en los archivos: no hay un proceso
       * solo, y en Netlify cada pedido puede caer en otra máquina. Lo que hay
       * es el número de versión que lleva cada fila: se lee con su versión, se
       * escribe **solo si la fila sigue en esa versión**, y si no se vuelve a
       * leer. Quien pierde la carrera se entera; nadie pisa a nadie.
       *
       * La versión la sube la base en cada escritura, no esto: si la mandara
       * el código, alcanzaría con olvidarse una vez para que dos escrituras
       * quedaran con el mismo número y la guarda dejara pasar las dos.
       */
      async cambiar(id, como) {
        const suya = `${filtro}&id=eq.${encodeURIComponent(id)}`;

        for (let intento = 0; intento < INTENTOS; intento++) {
          const filas = (await pedir(`${TABLA}?${suya}&select=datos,version&limit=1`)) as
            | Array<{ datos: unknown; version: number }>
            | null;
          const fila = filas?.[0];
          const nuevo = como(fila && valido(fila.datos) ? fila.datos : undefined);

          // No estaba. Se inserta **sin** permitir que pise: si otro la creó
          // mientras tanto, la base contesta 409 y se vuelve a leer.
          if (!fila) {
            if (nuevo === undefined) return undefined;
            try {
              await pedir(TABLA, {
                method: "POST",
                body: JSON.stringify({ coleccion: nombre, id, datos: nuevo }),
              });
              return nuevo;
            } catch (e) {
              if (!esChoque(e)) throw e;
              continue;
            }
          }

          const condicion = `${suya}&version=eq.${fila.version}`;
          // `return=representation` es lo que permite saber si se escribió: sin
          // él la respuesta viene vacía tanto cuando cambió una fila como
          // cuando no cambió ninguna, que son justamente los dos casos que hay
          // que distinguir.
          const tocadas = (await pedir(`${TABLA}?${condicion}`, {
            method: nuevo === undefined ? "DELETE" : "PATCH",
            prefer: "return=representation",
            ...(nuevo === undefined ? {} : { body: JSON.stringify({ datos: nuevo }) }),
          })) as unknown[] | null;

          if (tocadas && tocadas.length > 0) return nuevo;
        }

        throw new Error(
          `No se pudo guardar «${id}» en «${nombre}»: alguien más lo estuvo ` +
            `cambiando todo el tiempo. No se pisó nada.`
        );
      },
    };
  },

  documento<T>(
    nombre: string,
    valido: (valor: unknown) => valor is T,
    porOmision: T
  ): Documento<T> {
    // Un documento suelto es una colección con una sola fila. Así no hay dos
    // formas de guardar, que es de donde salen las diferencias tontas.
    const uno = enSupabase.coleccion<T>(nombre, valido);
    return {
      async leer() {
        return (await uno.uno("unico")) ?? porOmision;
      },
      async escribir(valor) {
        await uno.guardar("unico", valor);
      },
      async cambiar(como) {
        return (await uno.cambiar("unico", (actual) => como(actual ?? porOmision)))!;
      },
    };
  },
};
