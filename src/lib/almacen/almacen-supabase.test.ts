import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { enSupabase } from "@/lib/almacen/enSupabase";

// Se prueba contra un PostgREST de mentira, que se porta como el de Supabase
// en lo que importa acá: corta cada respuesta en 1000 filas **sin avisar**
// (el «Max rows» que Supabase trae por omisión) y respeta `limit`/`offset`.

const TOPE_DEL_SERVIDOR = 1000;

type FilaGuardada = { coleccion: string; id: string; datos: unknown };
let filas: FilaGuardada[] = [];
let pedidos: Array<{ url: string; metodo: string }> = [];

/** `like` de PostgREST: `*` es el comodín y `\` escapa al que sigue. */
function coincideLike(patron: string, id: string): boolean {
  let regex = "";
  for (let i = 0; i < patron.length; i++) {
    const c = patron[i];
    if (c === "\\" && i + 1 < patron.length) {
      regex += patron[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (c === "*" || c === "%") regex += ".*";
    else if (c === "_") regex += ".";
    else regex += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${regex}$`, "s").test(id);
}

const fetchFalso = vi.fn(async (entrada: string | URL, opciones?: RequestInit) => {
  const url = new URL(String(entrada));
  const metodo = opciones?.method ?? "GET";
  pedidos.push({ url: String(entrada), metodo });

  const q = url.searchParams;
  let lista = filas.filter((f) => `eq.${f.coleccion}` === q.get("coleccion"));
  const id = q.get("id");
  if (id?.startsWith("eq.")) lista = lista.filter((f) => f.id === id.slice(3));
  if (id?.startsWith("like.")) lista = lista.filter((f) => coincideLike(id.slice(5), f.id));

  if (metodo !== "GET") return new Response(null, { status: 204 });

  const offset = Number(q.get("offset") ?? 0);
  const limit = Math.min(Number(q.get("limit") ?? Infinity), TOPE_DEL_SERVIDOR);
  const pagina = lista.slice(offset, offset + limit).map((f) => ({ id: f.id, datos: f.datos }));
  return new Response(JSON.stringify(pagina), { status: 200 });
});

const antes = { url: process.env.SUPABASE_URL, llave: process.env.SUPABASE_SERVICE_KEY };

beforeEach(() => {
  process.env.SUPABASE_URL = "https://falso.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "llave-de-prueba";
  vi.stubGlobal("fetch", fetchFalso);
  filas = [];
  pedidos = [];
});

afterAll(() => {
  vi.unstubAllGlobals();
  process.env.SUPABASE_URL = antes.url;
  process.env.SUPABASE_SERVICE_KEY = antes.llave;
});

type Pieza = { n: number };
const esPieza = (v: unknown): v is Pieza => typeof (v as Pieza)?.n === "number";

describe("más de mil filas en una colección", () => {
  // **Supabase corta en mil sin dar error.** Con un solo pedido, pasada la
  // fila mil lo más nuevo desaparecía de `todo()` mientras `uno()` lo seguía
  // encontrando: el tablero mostraba «en curso» piezas ya entregadas.
  it("todo() trae las 1500", async () => {
    filas = Array.from({ length: 1500 }, (_, n) => ({
      coleccion: "piezas",
      id: `p${n}`,
      datos: { n },
    }));
    const piezas = enSupabase.coleccion("piezas", esPieza);

    const todo = await piezas.todo();
    expect(Object.keys(todo)).toHaveLength(1500);
    expect(todo.p1499).toEqual({ n: 1499 });
  });

  it("losQueEmpiezanCon() trae las 1500 del prefijo", async () => {
    filas = [
      ...Array.from({ length: 1500 }, (_, n) => ({
        coleccion: "piezas",
        id: `carp::${n}`,
        datos: { n },
      })),
      { coleccion: "piezas", id: "otra::1", datos: { n: -1 } },
    ];
    const piezas = enSupabase.coleccion("piezas", esPieza);

    const deLaCarpeta = await piezas.losQueEmpiezanCon("carp::");
    expect(Object.keys(deLaCarpeta)).toHaveLength(1500);
    expect(deLaCarpeta["carp::1499"]).toEqual({ n: 1499 });
  });

  it("con pocas filas sigue siendo un solo pedido", async () => {
    filas = [{ coleccion: "piezas", id: "a", datos: { n: 1 } }];
    await enSupabase.coleccion("piezas", esPieza).todo();
    expect(pedidos).toHaveLength(1);
  });

  it("el orden tiene desempate, para que las páginas no se pisen", async () => {
    await enSupabase.coleccion("piezas", esPieza).todo();
    expect(decodeURIComponent(pedidos[0].url)).toContain("order=creado.asc,id.asc");
  });
});

describe("borrar un id con comillas o barras", () => {
  /** Lo que queda adentro de `in.(…)`, ya decodificado. */
  const filtroIn = () => {
    const url = new URL(pedidos.find((p) => p.metodo === "DELETE")!.url);
    return url.searchParams.get("id");
  };

  // PostgREST escapa con barra invertida adentro de un valor entre comillas;
  // `""` es cosa de CSV y SQL, y ahí el borrado no encontraba nada.
  it("las comillas van como \\\"", async () => {
    await enSupabase.coleccion("piezas", esPieza).borrar('carp::Afiche "Verano", (final).pdf');
    expect(filtroIn()).toBe('in.("carp::Afiche \\"Verano\\", (final).pdf")');
  });

  it("la barra invertida va doble", async () => {
    await enSupabase.coleccion("piezas", esPieza).borrar("carp::a\\b.pdf");
    expect(filtroIn()).toBe('in.("carp::a\\\\b.pdf")');
  });
});
