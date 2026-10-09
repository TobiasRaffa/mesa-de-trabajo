// La tarea de todas las mañanas.
//
// En internet la aplicación no tiene un proceso vivo que mire la hora: cada
// pedido arranca y termina. Esto es lo único que corre solo: Netlify lo llama
// todos los días a las 8 de la mañana de Buenos Aires (11 UTC), y hace dos
// cosas:
//
//   1. **Guarda el respaldo del día** de toda la base.
//   2. **Manda los recordatorios de plazo** —«va por la mitad», «se cumplió»—
//      aunque nadie haya abierto el tablero.
//
// El trabajo de verdad lo hace la aplicación, en `/api/tareas`: acá solo se
// la llama, con la llave que sale de `CLAVE_DE_ADMIN` (ver `src/lib/tareas.ts`,
// que la calcula igual). Primero el respaldo y la lista de clientes; después
// un pedido por cliente, todos a la vez, para no pasarse del tiempo que
// Netlify le da a cada uno.
//
// Si algo falla queda en el registro de la función, en Netlify → Logs →
// Functions → tarea-diaria. Para probarla sin esperar a mañana, ese mismo
// panel tiene «Run now».

import { createHmac } from "node:crypto";

export default async function tareaDiaria() {
  // El sitio del portal también tiene esta función programada. Sin este corte,
  // cada mañana se harían dos respaldos y se mandarían dos recordatorios.
  if (process.env.SOLO_PORTAL === "1") return;
  const clave = process.env.CLAVE_DE_ADMIN?.trim();
  // `URL` la pone Netlify: es la dirección principal del sitio.
  const sitio = process.env.URL;
  if (!clave || !sitio) {
    console.error("[tarea] Falta CLAVE_DE_ADMIN o URL: no corre nada.");
    return;
  }

  const llave = createHmac("sha256", clave).update("tarea-diaria").digest("base64url");
  const pedir = (consulta = "") =>
    fetch(`${sitio}/api/tareas${consulta}`, {
      method: "POST",
      headers: { authorization: `Bearer ${llave}` },
    });

  const r = await pedir();
  if (!r.ok) {
    console.error(`[tarea] /api/tareas devolvió ${r.status}: ${await r.text()}`);
    return;
  }
  const { respaldo, clientes } = await r.json();
  console.log("[tarea] Respaldo:", JSON.stringify(respaldo));

  const resultados = await Promise.allSettled(
    clientes.map(async (id) => {
      const c = await pedir(`?cliente=${encodeURIComponent(id)}`);
      if (!c.ok) throw new Error(`${c.status}: ${(await c.text()).slice(0, 200)}`);
    })
  );
  const fallaron = resultados.filter((x) => x.status === "rejected");
  for (const f of fallaron) console.error("[tarea] Un cliente falló:", f.reason);
  console.log(`[tarea] Plazos revisados: ${clientes.length - fallaron.length} de ${clientes.length} clientes.`);
}

export const config = {
  schedule: "0 11 * * *",
};
