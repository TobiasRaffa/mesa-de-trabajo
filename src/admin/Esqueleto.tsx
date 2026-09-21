// La pantalla mientras Drive contesta.
//
// **No había ninguna.** Se tocaba una sección de la barra y no pasaba nada
// durante segundos: la pantalla anterior seguía entera, con el renglón tocado
// sin marcar, y lo primero que hace cualquiera es tocar otra vez. Todas las
// pantallas de gestión leen de Drive, que es una red de por medio, así que la
// espera no es un caso raro: es lo normal.
//
// Lo que se dibuja es el marco de siempre —el mismo ancho, el mismo encabezado
// con su línea— y unos renglones grises donde va la lista. Así la pantalla no
// salta cuando llega lo de verdad, que es lo que hace que una espera se sienta
// corta.

import { PANTALLA } from "@/admin/EncabezadoDePagina";

/** Un renglón gris del alto de una fila de lista. */
function Renglon({ ancho }: { ancho: string }) {
  return (
    <li className="flex items-center gap-3 border-b border-linea px-4 py-4">
      <span className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-hueco" />
      <span className={`h-4 animate-pulse bg-hueco ${ancho}`} />
    </li>
  );
}

/** Los anchos van variando: todos iguales se leen como una tabla vacía. */
const ANCHOS = ["w-48", "w-72", "w-56", "w-64", "w-40", "w-60"];

export function Esqueleto({
  titulo,
  cuantos = 6,
}: {
  /** El nombre de la pantalla que viene, si se sabe. */
  titulo?: string;
  cuantos?: number;
}) {
  return (
    <main className={PANTALLA} aria-busy="true">
      <header className="border-b-2 border-tinta pb-6">
        {titulo ? (
          <h1 className="text-grande font-extrabold tracking-tight">{titulo}</h1>
        ) : (
          <span className="block h-9 w-56 animate-pulse bg-hueco" />
        )}
      </header>
      <ul className="mt-8 border-t border-linea">
        {Array.from({ length: cuantos }, (_, i) => (
          <Renglon key={i} ancho={ANCHOS[i % ANCHOS.length]} />
        ))}
      </ul>
      <p className="sr-only" role="status">
        Leyendo de Drive…
      </p>
    </main>
  );
}
