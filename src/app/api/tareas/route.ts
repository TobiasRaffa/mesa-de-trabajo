// Lo que corre todas las mañanas sin que nadie lo pida.
//
// La llama la tarea programada de Netlify (`netlify/functions/tarea-diaria.mjs`)
// y nadie más: no tiene pantalla y no sirve a ninguna sección, así que en vez
// de una sesión pide la llave de la tarea. Sin la llave contesta «no
// encontrado», igual que cualquier dirección que no existe.
//
// Se llama en dos pasos, y es a propósito:
//
//   1. **Sin cliente**: guarda el respaldo del día y contesta qué clientes hay.
//   2. **Con `?cliente=`**: revisa los plazos de ese cliente y manda los
//      recordatorios que falten.
//
// Todo en un solo pedido podía pasarse del tiempo que Netlify le da a cada
// uno: recorrer las carpetas de todos los clientes son muchos viajes a Drive.
// Separado por cliente, la tarea los pide todos a la vez y cada uno termina
// rápido; si uno falla, los demás igual reciben sus avisos.

import { revisarPlazosDe } from "@/admin/datos/tablero";
import { supabaseConfigurado } from "@/lib/almacen";
import { respaldar } from "@/lib/almacen/respaldo";
import { clientePorId, clientesHabilitados } from "@/lib/clientes";
import { esLaTarea } from "@/lib/tareas";

const noEncontrado = () => new Response("No encontrado", { status: 404 });

export async function POST(pedido: Request) {
  if (!esLaTarea(pedido)) return noEncontrado();

  const clienteId = new URL(pedido.url).searchParams.get("cliente");

  if (!clienteId) {
    // El respaldo es de la base: en la computadora, con archivos, no hay
    // nada que respaldar por acá (la carpeta `datos/` se copia a mano).
    let respaldo: unknown = "sin Supabase: no hay base que respaldar";
    if (supabaseConfigurado()) {
      try {
        respaldo = await respaldar();
      } catch (e) {
        // Se cuenta y se sigue: que falle el respaldo no es motivo para que
        // no salgan los recordatorios.
        console.error("[tarea] El respaldo falló:", e);
        respaldo = { error: e instanceof Error ? e.message : String(e) };
      }
    }
    const clientes = (await clientesHabilitados()).map((c) => c.id);
    return Response.json({ respaldo, clientes });
  }

  const cliente = await clientePorId(clienteId);
  if (!cliente || !cliente.habilitado) return noEncontrado();

  await revisarPlazosDe(cliente);
  return Response.json({ listo: true });
}
