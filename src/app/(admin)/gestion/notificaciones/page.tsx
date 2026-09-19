// Las notificaciones: qué hizo el cliente, y si se le pudo avisar a alguien.
//
// Vivían adentro del tablero, arriba de todo, y eran dos cosas distintas
// peleando por la misma pantalla: una lista de lo que pasó —que se lee una vez
// y se archiva— y el estado de los trabajos —que se mira para decidir qué
// hacer—. Separadas, cada una puede ser lo que es.
//
// El título es el encabezado de todas las pantallas, con cuántas hay sin leer
// al lado. La lista es la bandeja, y nada más.

import { misAvisos } from "@/admin/datos/clientes";
import { correoConfigurado } from "@/lib/correo";
import { Bandeja } from "@/admin/Bandeja";
import { EncabezadoDePagina, PANTALLA } from "@/admin/EncabezadoDePagina";

export const dynamic = "force-dynamic";

export default async function Notificaciones() {
  const avisos = await misAvisos();
  const sinVer = avisos.filter((a) => !a.visto).length;

  return (
    <main className={PANTALLA}>
      <EncabezadoDePagina
        titulo="Notificaciones"
        bajada="Todo lo que hizo el cliente queda acá, haya salido por correo o no."
        alLado={
          sinVer > 0 ? (
            <span className="rounded-full bg-lima px-3 py-1 font-mono text-micro font-bold uppercase tracking-wider text-tinta">
              {sinVer} {sinVer === 1 ? "nueva" : "nuevas"}
            </span>
          ) : (
            avisos.length > 0 && (
              <span className="font-mono text-micro uppercase tracking-wider text-apagado">
                {avisos.length} anotadas
              </span>
            )
          )
        }
      />
      <Bandeja avisos={avisos} correoConfigurado={correoConfigurado()} />
    </main>
  );
}
