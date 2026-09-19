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
//
// **Muestra solo lo que le toca a cada uno, y eso no es la protección.** La
// dirección se escribe a mano: quien protege es `proxy.ts`. Esto es para no
// ofrecerle a alguien una puerta que le va a dar en la cara.

import Link from "next/link";
import { Marca } from "@/ui/Marca";
import { usePathname } from "next/navigation";
import { salir } from "@/app/(admin)/gestion/entrar/acciones";
import {
  NOMBRE_DE_SECCION,
  RUTA_DE,
  seccionDeLaRuta,
  type Seccion,
} from "@/dominio/roles";

/** El trabajo de todos los días. */
const ARRIBA: readonly Seccion[] = ["tablero", "clientes", "conversaciones", "notificaciones"];

/**
 * Lo que se toca de vez en cuando, abajo y aparte.
 *
 * Las facturas y la administración no son trabajo diario: se miran cada tanto.
 * Mezcladas con las secciones de todos los días ocupan el mismo peso visual que
 * «Clientes» y no lo valen. Abajo del todo están donde se las busca cuando se
 * las busca.
 *
 * El diagnóstico no está en ninguna de las dos listas: cuando Drive falla, cada
 * pantalla lo dice donde pasa. La ruta sigue existiendo para cuando haga falta
 * mirar la conexión.
 */
const ABAJO: readonly Seccion[] = ["facturas", "admin"];

export function BarraLateral({
  quien,
  secciones,
}: {
  /** Quién entró. `null` con la llave del equipo, que no es de nadie. */
  quien: string | null;
  /** Qué partes le tocan. Lo que no está acá no se dibuja. */
  secciones: readonly Seccion[];
}) {
  const ruta = usePathname();

  // En la puerta no hay a dónde ir todavía. Mostrar el menú de secciones a
  // quien no entró es ofrecerle lo que no puede abrir, y de paso contarle qué
  // hay adentro.
  if (ruta === "/gestion/entrar") return null;

  const arriba = ARRIBA.filter((s) => secciones.includes(s));
  const abajo = ABAJO.filter((s) => secciones.includes(s));
  const actual = seccionDeLaRuta(ruta);

  return (
    <aside
      className="flex w-full flex-col gap-6 bg-tinta p-6 text-lienzo
                 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto"
    >
      <Link
        href={RUTA_DE[arriba[0] ?? abajo[0] ?? "clientes"]}
        className="transition-opacity hover:opacity-80"
      >
        <Marca tono="sobre_oscuro" />
      </Link>

      {arriba.length > 0 && <Secciones cuales={arriba} actual={actual} etiqueta="Secciones" />}

      {/* `mt-auto` lo empuja al pie de la columna en pantalla grande. En el
          teléfono la barra es una fila y sigue a lo anterior, con una línea que
          lo separa para que se lea como otro grupo. */}
      <div className="mt-2 border-t border-lienzo/15 pt-2 lg:mt-auto lg:pt-4">
        {abajo.length > 0 && (
          <Secciones cuales={abajo} actual={actual} etiqueta="Administración" />
        )}

        {/* **Quién entró, a la vista.** Lo que se hace queda firmado con ese
            nombre: si la máquina quedó con la sesión de otra, hay que poder
            darse cuenta antes de entregarle algo a un cliente en su nombre. */}
        <form action={salir} className="mt-4 flex items-center gap-2 border-t border-lienzo/15 pt-4">
          <span className="min-w-0 flex-1 truncate text-micro text-lienzo/45">
            {quien ?? "El equipo"}
          </span>
          <button
            type="submit"
            className="shrink-0 font-mono text-micro font-bold uppercase tracking-widest
                       text-lienzo/45 transition-colors hover:text-lienzo"
          >
            Salir
          </button>
        </form>
      </div>
    </aside>
  );
}

function Secciones({
  cuales,
  actual,
  etiqueta,
}: {
  cuales: readonly Seccion[];
  /**
   * En qué sección se está parado.
   *
   * Lo decide el dominio y no una comparación de acá: con una propia, estando
   * adentro de un cliente quedaban dos secciones marcadas a la vez —«Clientes»
   * es prefijo de todo lo demás—, que es peor que ninguna.
   */
  actual: Seccion | null;
  etiqueta: string;
}) {
  return (
    <nav aria-label={etiqueta}>
      <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
        {cuales.map((seccion) => (
          <li key={seccion} className="shrink-0 lg:shrink">
            <Link
              href={RUTA_DE[seccion]}
              aria-current={seccion === actual ? "page" : undefined}
              // Un filo marca dónde estás: se ve de reojo, sin leer. Va del
              // lado por donde corre la lista —abajo cuando es una fila, a
              // la izquierda cuando es una columna—; puesto al costado en
              // una fila horizontal parece que separa, no que señala.
              className={`flex min-h-toque items-center whitespace-nowrap border-b-4 px-3
                          text-normal font-bold tracking-tight transition-colors
                          lg:border-b-0 lg:border-l-4 ${
                            seccion === actual
                              ? "border-lienzo bg-lienzo/10 text-lienzo"
                              : "border-transparent text-lienzo/70 hover:bg-lienzo/5 hover:text-lienzo"
                          }`}
            >
              {NOMBRE_DE_SECCION[seccion]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
