// Bajar un respaldo, y volver a cargarlo si hace falta.
//
// La tarea de todas las mañanas deja una copia de la base entera en Supabase
// Storage, en el depósito privado `respaldos` (ver `src/lib/almacen/respaldo.ts`).
// Esto sirve para dos cosas:
//
//   1. **Bajarse una copia** a esta computadora, de vez en cuando. El respaldo
//      diario vive en el mismo proyecto de Supabase: si el proyecto se
//      perdiera, se iría con él. Una copia acá afuera cubre eso.
//
//          node --env-file=.env.local supabase/restaurar-respaldo.mjs --bajar
//          node --env-file=.env.local supabase/restaurar-respaldo.mjs --bajar 2026-09-23
//
//      Quedan en `respaldos/`, que no se sube al repositorio.
//
//   2. **Volver atrás** después de un error: mirar qué cambiaría y, si está
//      bien, cargarlo.
//
//          node --env-file=.env.local supabase/restaurar-respaldo.mjs respaldos/respaldo-2026-09-23.json.gz
//          node --env-file=.env.local supabase/restaurar-respaldo.mjs respaldos/respaldo-2026-09-23.json.gz --escribir
//          ... --coleccion piezas --escribir     solo una colección
//
// **Por omisión no escribe nada**: muestra, colección por colección, cuántos
// documentos volverían a como estaban en el respaldo. Con `--escribir` los
// vuelve a esa versión. **No borra** lo que se creó después del respaldo: lo
// nuevo que no estaba no se toca. Volver atrás una base entera es la clase de
// cosa que se hace una vez y con la aplicación sin usar.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const TABLA = "documentos";
const DEPOSITO = "respaldos";

const args = process.argv.slice(2);
const escribir = args.includes("--escribir");
const bajar = args.includes("--bajar");
const soloColeccion = args.includes("--coleccion") ? args[args.indexOf("--coleccion") + 1] : null;

function credenciales() {
  const url = process.env.SUPABASE_URL?.trim();
  const llave = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !llave) {
    console.error(
      "Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY. Corrélo así, desde la carpeta del proyecto:\n" +
        "  node --env-file=.env.local supabase/restaurar-respaldo.mjs ..."
    );
    process.exit(1);
  }
  return { url, llave };
}

async function pedir(ruta, opciones = {}) {
  const { url, llave } = credenciales();
  const { prefer, ...resto } = opciones;
  const r = await fetch(`${url}/${ruta}`, {
    ...resto,
    headers: {
      apikey: llave,
      Authorization: `Bearer ${llave}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase devolvió ${r.status}: ${await r.text()}`);
  return r;
}

// **Sin `process.exit` al terminar bien**: en Windows, salir así con pedidos
// de red recién cerrados hace que Node se queje al irse.
async function principal() {
  if (bajar) {
    const dia = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
    const lista = await (
      await pedir(`storage/v1/object/list/${DEPOSITO}`, {
        method: "POST",
        body: JSON.stringify({ prefix: "", limit: 1000, offset: 0 }),
      })
    ).json();
    const nombres = lista.map((o) => o.name).filter((n) => n.startsWith("respaldo-")).sort();
    const nombre = dia ? `respaldo-${dia}.json.gz` : nombres.at(-1);
    if (!nombre || !nombres.includes(nombre)) {
      console.error(
        `No hay ${dia ? `respaldo del ${dia}` : "ningún respaldo"}.` +
          (nombres.length ? ` Los que hay:\n  ${nombres.join("\n  ")}` : "")
      );
      process.exitCode = 1;
      return;
    }
    const contenido = Buffer.from(
      await (await pedir(`storage/v1/object/${DEPOSITO}/${nombre}`)).arrayBuffer()
    );
    await mkdir("respaldos", { recursive: true });
    const destino = path.join("respaldos", nombre);
    await writeFile(destino, contenido);
    console.log(`Bajado: ${destino} (${Math.round(contenido.length / 1024)} KB)`);
    return;
  }

  const archivo = args.find((a) => a.endsWith(".json.gz"));
  if (!archivo) {
    console.error("¿Qué respaldo? Pasale el archivo, o --bajar para traer el último.");
    process.exitCode = 1;
      return;
  }

  const { hecho, filas: todas } = JSON.parse(gunzipSync(await readFile(archivo)).toString());
  const filas = todas.filter((f) => !soloColeccion || f.coleccion === soloColeccion);

  // Lo que hay hoy, para decir qué cambiaría.
  const hoy = new Map();
  for (let desde = 0; ; desde += 1000) {
    const pagina = await (
      await pedir(
        `rest/v1/${TABLA}?select=coleccion,id,datos&order=creado.asc,id.asc&limit=1000&offset=${desde}`
      )
    ).json();
    for (const f of pagina) hoy.set(`${f.coleccion}\u0000${f.id}`, JSON.stringify(f.datos));
    if (pagina.length < 1000) break;
  }

  const porColeccion = new Map();
  const aCargar = [];
  for (const f of filas) {
    const actual = hoy.get(`${f.coleccion}\u0000${f.id}`);
    const cuenta = porColeccion.get(f.coleccion) ?? { vuelven: 0, faltaban: 0, iguales: 0 };
    if (actual === undefined) cuenta.faltaban++;
    else if (actual !== JSON.stringify(f.datos)) cuenta.vuelven++;
    else cuenta.iguales++;
    porColeccion.set(f.coleccion, cuenta);
    if (actual !== JSON.stringify(f.datos)) aCargar.push({ coleccion: f.coleccion, id: f.id, datos: f.datos });
  }

  console.log(`Respaldo del ${hecho}: ${filas.length} documentos${soloColeccion ? ` de ${soloColeccion}` : ""}.\n`);
  console.log(`  ${"colección".padEnd(22)} ${"cambiados".padStart(9)} ${"borrados".padStart(9)} ${"iguales".padStart(8)}`);
  for (const [c, n] of [...porColeccion].sort()) {
    console.log(`  ${c.padEnd(22)} ${String(n.vuelven).padStart(9)} ${String(n.faltaban).padStart(9)} ${String(n.iguales).padStart(8)}`);
  }
  console.log(
    "\n«cambiados»: hoy están distintos y volverían a como estaban.\n" +
      "«borrados»: estaban en el respaldo y hoy no; volverían a aparecer."
  );

  if (!escribir) {
    console.log(`\nNo se escribió nada. Para cargar estos ${aCargar.length}, agregá --escribir.`);
    return;
  }

  const TANDA = 200;
  for (let i = 0; i < aCargar.length; i += TANDA) {
    await pedir(`rest/v1/${TABLA}?on_conflict=coleccion,id`, {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: JSON.stringify(aCargar.slice(i, i + TANDA)),
    });
    console.log(`  cargados ${Math.min(i + TANDA, aCargar.length)}/${aCargar.length}`);
  }
  console.log("\nListo. Abrí la aplicación y fijate que esté lo que tenía que volver.");
}

await principal();
