// Sube a Supabase lo que hay en `datos/`.
//
// **Se corre una sola vez, el día de la mudanza.** La base arranca vacía y en
// esta computadora están los clientes, las claves, los calendarios, los chats
// y en qué estado quedó cada pieza. Sin esto, la aplicación en internet abre
// impecable y no sabe nada de nadie.
//
// Cada archivo de `datos/` es una colección, cada clave adentro es un
// documento:
//
//     datos/clientes.json  { "abc": {...} }  ->  ('clientes', 'abc', {...})
//
// Cómo se usa, desde la carpeta del proyecto y con las variables cargadas en
// `.env.local`:
//
//     node supabase/subir-datos.mjs            mira qué haría, sin escribir
//     node supabase/subir-datos.mjs --escribir  lo escribe
//
// **Por omisión no escribe nada.** Un script de migración que escribe con solo
// llamarlo es el que un día se corre por accidente encima de la base buena.
//
// **No borra ni pisa lo que ya esté**, salvo que se lo pidan con `--pisar`: si
// la base ya tiene algo cargado, lo más probable es que la migración ya se
// haya hecho y esto sea la segunda vez.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const CARPETA = path.join(process.cwd(), "datos");
const TABLA = "documentos";

const escribir = process.argv.includes("--escribir");
const pisar = process.argv.includes("--pisar");

function credenciales() {
  const url = process.env.SUPABASE_URL?.trim();
  const llave = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !llave) {
    console.error(
      "Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY.\n" +
        "Están en Supabase → Project Settings → API. Cargalas así:\n" +
        "  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node supabase/subir-datos.mjs"
    );
    process.exit(1);
  }
  return { url, llave };
}

async function pedir(ruta, opciones = {}) {
  const { url, llave } = credenciales();
  const { prefer, ...resto } = opciones;
  const r = await fetch(`${url}/rest/v1/${ruta}`, {
    ...resto,
    headers: {
      apikey: llave,
      Authorization: `Bearer ${llave}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase devolvió ${r.status}: ${await r.text()}`);
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

/**
 * Las que son **un solo documento** y no una colección.
 *
 * `secreto.json` es una cadena y `leidos.json` es un objeto con dos lados: no
 * son «muchos documentos con su identificador», son uno. Tratarlos como
 * colección parte `leidos` en dos filas —«agencia» y «cliente»— y la
 * aplicación, que pide la fila «unico», no encuentra ninguna: el día después
 * de la mudanza todos los chats aparecen con todo sin leer, y nadie sabe por
 * qué. Hay un guardián en `migraciones.test.ts` que verifica que esta lista
 * siga siendo la que el código usa.
 */
const SUELTOS = new Set(["secreto", "leidos"]);

/** Lo que hay en `datos/`, colección por colección. */
async function leerLoCargado() {
  const archivos = (await readdir(CARPETA)).filter((n) => n.endsWith(".json"));

  const filas = [];
  for (const archivo of archivos.sort()) {
    const coleccion = archivo.replace(/\.json$/, "");
    const crudo = JSON.parse(await readFile(path.join(CARPETA, archivo), "utf8"));

    if (SUELTOS.has(coleccion)) {
      filas.push({ coleccion, id: "unico", datos: crudo });
      continue;
    }

    // Un archivo que no es un objeto de documentos no es una colección: mejor
    // avisar y saltearlo que subir algo con una forma que nadie espera.
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) {
      console.warn(`  ! ${archivo}: no tiene forma de colección, se saltea.`);
      continue;
    }

    for (const [id, datos] of Object.entries(crudo)) {
      filas.push({ coleccion, id, datos });
    }
  }
  return filas;
}

const filas = await leerLoCargado();

const porColeccion = new Map();
for (const f of filas) porColeccion.set(f.coleccion, (porColeccion.get(f.coleccion) ?? 0) + 1);

console.log(`En datos/ hay ${filas.length} documentos:`);
for (const [coleccion, cuantos] of [...porColeccion].sort()) {
  console.log(`  ${coleccion.padEnd(22)} ${cuantos}`);
}

if (!escribir) {
  console.log(
    "\nNo se escribió nada. Para escribir de verdad:\n" +
      "  node supabase/subir-datos.mjs --escribir"
  );
  process.exit(0);
}

// **Antes de escribir, mirar si ya hay algo.** Si la base tiene documentos, lo
// más probable es que la migración ya se haya hecho y esto sea la segunda vez.
const yaHay = await pedir(`${TABLA}?select=coleccion&limit=1`);
if (yaHay?.length > 0 && !pisar) {
  console.error(
    "\nLa base ya tiene documentos cargados. No se escribió nada.\n" +
      "Si de verdad querés pisar lo que hay, agregá --pisar."
  );
  process.exit(1);
}

// De a tandas: mandar tres mil filas en un solo pedido es cómo se descubre el
// límite de tamaño del otro lado, a mitad de la migración.
const TANDA = 200;
let subidos = 0;
for (let i = 0; i < filas.length; i += TANDA) {
  const tanda = filas.slice(i, i + TANDA);
  await pedir(`${TABLA}?on_conflict=coleccion,id`, {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: JSON.stringify(tanda),
  });
  subidos += tanda.length;
  console.log(`  subidos ${subidos}/${filas.length}`);
}

console.log(
  `\nListo: ${subidos} documentos.\n` +
    "Abrí la aplicación con las variables de Supabase puestas y fijate que se " +
    "vea todo: los clientes, el tablero y una conversación."
);
