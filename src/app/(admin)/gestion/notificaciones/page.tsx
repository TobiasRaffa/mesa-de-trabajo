// Las notificaciones: qué hizo el cliente, y si se le pudo avisar a alguien.
//
// Vivían adentro del tablero, arriba de todo, y eran dos cosas distintas
// peleando por la misma pantalla: una lista de lo que pasó —que se lee una vez
// y se archiva— y el estado de los trabajos —que se mira para decidir qué
// hacer—. Separadas, cada una puede ser lo que es.
//
// El título de la pantalla **es** el desplegable, y no hay otro arriba: dos
// títulos con el mismo nombre, uno encima del otro, es lo que pasa cuando algo
// se muda de lugar y nadie saca lo que quedó.

import { misAvisos } from "@/admin/datos/clientes";
import { correoConfigurado } from "@/lib/correo";
import { Bandeja } from "@/admin/Bandeja";

export const dynamic = "force-dynamic";

export default async function Notificaciones() {
  const avisos = await misAvisos();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Bandeja
        titulo="Notificaciones"
        avisos={avisos}
        correoConfigurado={correoConfigurado()}
      />
      <p className="mt-3 text-menudo text-apagado">
        Todo lo que hizo el cliente queda acá, haya salido por correo o no.
      </p>
    </main>
  );
}
