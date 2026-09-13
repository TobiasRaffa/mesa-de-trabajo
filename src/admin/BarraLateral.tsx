"use client";

// La barra de gestión: al costado y a lo largo.
//
// Estaba arriba. Al costado hay dos ganancias: la pantalla es más ancha que
// alta —así que el lugar que sobra está a los lados, no arriba—, y una lista
// en columna tiene espacio para decir **dónde estás parado**, que en una fila
// de cuatro palabras no entraba.
//
// Ese señalamiento no es decoración. Las pantallas de gestión se parecen entre
// sí —listas, botones de configuración, un panel a la derecha— y sin una marca
// clara es fácil creer que estás configurando un cliente cuando estás en otro.
//
// En el teléfono vuelve a ser una fila que se corre de costado: en columna se
// comía la pantalla entera antes de llegar al trabajo.

import Link from "next/link";
import { usePathname } from "next/navigation";

/** El trabajo de todos los días. */
const SECCIONES = [
  { href: "/gestion/tablero", texto: "Tablero" },
  // «Clientes» es la raíz, y la ficha de cada cliente cuelga de ella: estando
  // adentro de un cliente, la sección que corresponde marcar sigue siendo esta.
  { href: "/gestion", texto: "Clientes", tambien: "/gestion/cliente" },
  { href: "/gestion/chats", texto: "Conversaciones" },
  { href: "/gestion/notificaciones", texto: "Notificaciones" },
  // El diagnóstico no está acá: cuando Drive falla, cada pantalla lo dice donde
  // pasa. La ruta sigue existiendo para cuando haga falta mirar la conexión.
] as const;

/**
 * Lo que se toca de vez en cuando, abajo y aparte.
 *
 * Las claves de los clientes y el equipo no son trabajo diario: se configuran
 * al dar de alta a alguien y después se miran cada tanto. Mezcladas con las
 * secciones de todos los días, ocupan el mismo peso visual que «Clientes» y
 * no lo valen. Abajo del todo están donde se las busca cuando se las busca.
 */
const ABAJO = [
  { href: "/gestion/facturas", texto: "Facturas" },
  { href: "/gestion/admin", texto: "Admin" },
] as const;

/**
 * Si una sección es la que se está mirando.
 *
 * `/gestion` necesita comparación exacta porque es prefijo de todas las demás:
 * sin eso quedarían dos secciones marcadas a la vez, que es peor que ninguna.
 */
type Seccion = { href: string; texto: string; tambien?: string };

function esLaActual(ruta: string, seccion: Seccion): boolean {
  if (seccion.href === "/gestion") {
    return ruta === "/gestion" || ruta.startsWith(`${seccion.tambien}/`);
  }
  return ruta === seccion.href || ruta.startsWith(`${seccion.href}/`);
}

export function BarraLateral({ abajo }: { abajo?: React.ReactNode }) {
  const ruta = usePathname();

  // En la puerta no hay a dónde ir todavía. Mostrar el menú de secciones a
  // quien no entró es ofrecerle lo que no puede abrir, y de paso contarle qué
  // hay adentro.
  if (ruta === "/gestion/entrar") return null;

  return (
    <aside
      className="flex w-full flex-col gap-6 bg-tinta p-6 text-lienzo
                 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto"
    >
      <Link
        href="/gestion"
        className="text-micro font-extrabold uppercase tracking-widest text-lienzo/45
                   transition-colors hover:text-lienzo/70"
      >
        Mesa de trabajo
      </Link>

      <Secciones cuales={SECCIONES} ruta={ruta} etiqueta="Secciones" />

      {/* `mt-auto` lo empuja al pie de la columna en pantalla grande. En el
          teléfono la barra es una fila y sigue a lo anterior, con una línea que
          lo separa para que se lea como otro grupo. */}
      <div className="mt-2 border-t border-lienzo/15 pt-2 lg:mt-auto lg:pt-4">
        <Secciones cuales={ABAJO} ruta={ruta} etiqueta="Administración" />
        {/* Quién está usando esto. Lo arma el layout, que puede leer la
            sesión; esta barra corre en el navegador y no puede. */}
        {abajo && <div className="mt-4">{abajo}</div>}
      </div>
    </aside>
  );
}

function Secciones({
  cuales,
  ruta,
  etiqueta,
}: {
  cuales: readonly Seccion[];
  ruta: string;
  etiqueta: string;
}) {
  return (
    <nav aria-label={etiqueta}>
        <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
          {cuales.map((seccion) => {
            const actual = esLaActual(ruta, seccion);
            return (
              <li key={seccion.href} className="shrink-0 lg:shrink">
                <Link
                  href={seccion.href}
                  aria-current={actual ? "page" : undefined}
                  // Un filo marca dónde estás: se ve de reojo, sin leer. Va del
                  // lado por donde corre la lista —abajo cuando es una fila, a
                  // la izquierda cuando es una columna—; puesto al costado en
                  // una fila horizontal parece que separa, no que señala.
                  className={`flex min-h-toque items-center whitespace-nowrap border-b-4 px-3
                              text-normal font-bold tracking-tight transition-colors
                              lg:border-b-0 lg:border-l-4 ${
                                actual
                                  ? "border-lienzo bg-lienzo/10 text-lienzo"
                                  : "border-transparent text-lienzo/70 hover:bg-lienzo/5 hover:text-lienzo"
                              }`}
                >
                  {seccion.texto}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}
