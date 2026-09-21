// Lo que se ve mientras la pantalla de gestión se trae de Drive.
//
// Next lo usa como respaldo de Suspense para todo este segmento, así que con
// un solo archivo todas las pantallas de la agencia dejan de quedarse mudas.
// Las que tienen forma propia —el tablero, que son cuatro columnas— ponen el
// suyo al lado de su `page.tsx`.

import { Esqueleto } from "@/admin/Esqueleto";

export default function Cargando() {
  return <Esqueleto />;
}
