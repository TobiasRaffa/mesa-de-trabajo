// El tablero: cómo viene todo, de un vistazo.
//
// Es la primera pantalla del día, y reemplaza el «¿alguien sabe cómo viene lo
// de Café Otoño?» de los lunes.
//
// **Tres canchas, y adentro los clientes cerrados.** Las columnas contestan la
// pregunta de la mañana —de quién es el próximo movimiento— y los clientes
// cerrados evitan que una cuenta con tres trabajos llene la columna entera: lo
// que se ve de un vistazo deja de verse cuando hay que recorrerlo.
//
// Lo vencido va arriba de todo y fuera de las columnas: es lo único que hay
// que ver aunque no se abra nada.
//
// Las notificaciones se fueron a su propia sección. Eran dos cosas distintas
// peleando por la misma pantalla: una lista de lo que pasó, que se lee una vez
// y se archiva, y el estado de los trabajos, que se mira para decidir.

import { Campana } from "@/admin/Campana";
import { PANTALLA } from "@/admin/EncabezadoDePagina";
import { misAvisos } from "@/admin/datos/clientes";
import { elTablero } from "@/admin/datos/tablero";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";
import { TableroPorCliente } from "@/admin/TableroPorCliente";
import { elEquipo } from "@/lib/equipo";
import { quienSoy } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function TableroPagina() {
  let tablero;
  try {
    tablero = await elTablero();
  } catch (error) {
    return <ErrorDeDrive error={error} titulo="Tablero" />;
  }

  return (
    <main className={PANTALLA}>
      {/* **El encabezado y el cartel de vencidos los dibuja el tablero.** Acá
          no se sabe qué filtro hay puesto, y las cifras de arriba tienen que
          hablar de lo que se está viendo: con «Solo los míos» puesto, esta
          pantalla decía «12 trabajos · 5 para hacer» sobre tres trabajos. */}
      <TableroPorCliente
        carpetas={tablero.carpetas}
        equipo={await elEquipo()}
        campana={
          /* La campana despliega las notificaciones acá mismo y dice cuántas
             hay sin leer. */
          <Campana avisos={await misAvisos()} yo={(await quienSoy())?.nombre} />
        }
      />

    </main>
  );
}
