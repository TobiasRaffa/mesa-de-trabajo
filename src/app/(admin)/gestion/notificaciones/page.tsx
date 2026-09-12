// Las notificaciones: qué hizo el cliente, y si se le pudo avisar a alguien.
//
// Vivían adentro del tablero, arriba de todo, y eran dos cosas distintas
// peleando por la misma pantalla: una lista de lo que pasó —que se lee una vez
// y se archiva— y el estado de los trabajos —que se mira para decidir qué
// hacer—. Separadas, cada una puede ser lo que es.

import { losAvisos } from "@/lib/avisos";
import { correoConfigurado } from "@/lib/correo";
import { Bandeja } from "@/admin/Bandeja";

export const dynamic = "force-dynamic";

export default async function Notificaciones() {
  const avisos = await losAvisos();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="border-b-2 border-tinta pb-6">
        <h1 className="text-grande font-extrabold tracking-tight">Notificaciones</h1>
        <p className="mt-1 text-menudo text-apagado">
          Todo lo que hizo el cliente queda acá, haya salido por correo o no.
        </p>
      </header>

      {/* Sin plegar: esta pantalla **es** la lista. Plegarla dejaría un título
          con una flecha y nada debajo, que es lo que se ve al entrar cuando
          está todo leído. */}
      <Bandeja avisos={avisos} correoConfigurado={correoConfigurado()} plegable={false} />
    </main>
  );
}
