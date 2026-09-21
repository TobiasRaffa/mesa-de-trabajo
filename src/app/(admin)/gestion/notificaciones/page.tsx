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
import { quienSoy } from "@/lib/sesion";
import { Bandeja } from "@/admin/Bandeja";
import { EncabezadoDePagina, PANTALLA } from "@/admin/EncabezadoDePagina";

export const dynamic = "force-dynamic";

export default async function Notificaciones() {
  const [avisos, yo] = await Promise.all([misAvisos(), quienSoy()]);

  return (
    <main className={PANTALLA}>
      {/* **Sin bajada y sin pastilla.** La bajada repetía lo que ya dice el
          título, y la pastilla decía el mismo número que el rótulo del grupo
          de abajo —«3 nuevas» arriba, «Nuevas · 3» pegado a las nuevas— con
          tres palabras distintas para lo mismo. Al marcarlas leídas la de
          arriba bajaba a cero y terminaba contradiciendo a la lista. */}
      <EncabezadoDePagina titulo="Notificaciones" />
      <Bandeja
        avisos={avisos}
        correoConfigurado={correoConfigurado()}
        yo={yo?.nombre}
      />
    </main>
  );
}
