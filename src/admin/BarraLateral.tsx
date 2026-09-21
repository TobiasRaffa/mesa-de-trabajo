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

import Link, { useLinkStatus } from "next/link";
import { Logo, Marca } from "@/ui/Marca";
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
 * **El diagnóstico está acá.** No estaba en ninguna lista: existía como
 * dirección y había que sabérsela de memoria, con lo cual la pantalla que
 * contesta «¿anda Drive?» era la más difícil de encontrar justo el día que
 * Drive no anda. La barra ya filtra por sección, así que solo la ve quien la
 * tiene.
 */
const ABAJO: readonly Seccion[] = ["facturas", "admin", "diagnostico"];

export function BarraLateral({
  quien,
  secciones,
  sinLeer = 0,
}: {
  /** Quién entró. `null` con la llave del equipo, que no es de nadie. */
  quien: string | null;
  /** Qué partes le tocan. Lo que no está acá no se dibuja. */
  secciones: readonly Seccion[];
  /**
   * Cuántas notificaciones sin leer tiene quien mira.
   *
   * **Vivía solo en el tablero**, adentro de la campana: desde Clientes, desde
   * Conversaciones o desde la ficha de un cliente no había una sola señal de
   * que hubiera llegado algo, y enterarse costaba ir al tablero a propósito.
   */
  sinLeer?: number;
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
    // **En el teléfono ocupa lo que necesita.** Con `p-6`, `gap-6` y la marca
    // entera arriba, la barra se comía casi un tercio del alto antes de llegar
    // al trabajo: en una pantalla de 640 de alto quedaban 430 para la lista.
    <aside
      className="flex w-full flex-col gap-2 bg-tinta p-2 text-lienzo
                 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:gap-6 lg:overflow-y-auto lg:p-6"
    >
      {/* En angosto el logo comparte renglón con quién entró y «Salir», que
          es todo lo que no son secciones: tres bloques apilados costaban un
          tercio del alto antes de llegar al trabajo. */}
      <div className="flex items-center gap-3 lg:block">
        <Link
          href={RUTA_DE[arriba[0] ?? abajo[0] ?? "clientes"]}
          className="shrink-0 transition-opacity hover:opacity-80"
        >
          {/* Solo el logo: el nombre y la bajada dicen de quién es la
              herramienta, y eso se lee una vez. */}
          <Logo className="h-8 w-8 lg:hidden" />
          <span className="hidden lg:block">
            <Marca tono="sobre_oscuro" />
          </span>
        </Link>
        <Salir quien={quien} className="ml-auto flex items-center gap-2 lg:hidden" />
      </div>

      {/* **Todas juntas en angosto.** Separar «Administración» en su propio
          bloque con línea y márgenes es correcto en una columna alta; en una
          barra horizontal son dos renglones más de alto para siete etiquetas
          cortas que entran en dos. */}
      <div className="lg:hidden">
        <Secciones
          cuales={[...arriba, ...abajo]}
          actual={actual}
          etiqueta="Secciones"
          sinLeer={sinLeer}
        />
      </div>

      <div className="hidden lg:block">
        {arriba.length > 0 && (
          <Secciones cuales={arriba} actual={actual} etiqueta="Secciones" sinLeer={sinLeer} />
        )}
      </div>

      {/* `mt-auto` lo empuja al pie de la columna en pantalla grande. */}
      <div className="hidden border-t border-lienzo/15 lg:mt-auto lg:block lg:pt-4">
        {abajo.length > 0 && (
          <Secciones cuales={abajo} actual={actual} etiqueta="Administración" />
        )}
        <Salir
          quien={quien}
          className="mt-4 flex items-center gap-2 border-t border-lienzo/15 pt-4"
        />
      </div>
    </aside>
  );
}

/**
 * Quién entró, y cómo salir.
 *
 * **El nombre a la vista.** Lo que se hace queda firmado con él: si la máquina
 * quedó con la sesión de otra, hay que poder darse cuenta antes de entregarle
 * algo a un cliente en su nombre.
 */
function Salir({ quien, className }: { quien: string | null; className: string }) {
  return (
    <form action={salir} className={className}>
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
  );
}

function Secciones({
  cuales,
  actual,
  etiqueta,
  sinLeer = 0,
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
  sinLeer?: number;
}) {
  return (
    <nav aria-label={etiqueta}>
      {/* **Se acomoda en dos renglones en vez de correrse de costado.** Con
          `overflow-x-auto`, la última etiqueta quedaba cortada por la mitad
          —«Notificacion…»— y había que arrastrar una fila para descubrir que
          había algo más. Cuatro palabras cortas entran en dos renglones. */}
      <ul className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-0">
        {cuales.map((seccion) => (
          <li key={seccion} className="shrink-0 lg:shrink">
            <Link
              href={RUTA_DE[seccion]}
              aria-current={seccion === actual ? "page" : undefined}
              // Un filo marca dónde estás: se ve de reojo, sin leer. Va del
              // lado por donde corre la lista —abajo cuando es una fila, a
              // la izquierda cuando es una columna—; puesto al costado en
              // una fila horizontal parece que separa, no que señala.
              className={`flex min-h-toque items-center whitespace-nowrap border-b-4 px-2
                          text-menudo font-bold tracking-tight transition-colors
                          lg:border-b-0 lg:border-l-4 lg:px-3 lg:text-normal ${
                            seccion === actual
                              ? "border-lienzo bg-lienzo/10 text-lienzo"
                              : "border-transparent text-lienzo/70 hover:bg-lienzo/5 hover:text-lienzo"
                          }`}
            >
              {NOMBRE_DE_SECCION[seccion]}
              {seccion === "notificaciones" && sinLeer > 0 && (
                <span className="cifras ml-2 rounded-full bg-lima px-1.5 text-micro font-extrabold leading-5 text-tinta">
                  {sinLeer}
                </span>
              )}
              <Yendo />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Tres puntitos mientras la pantalla nueva se trae.
 *
 * **Contesta la pregunta «¿lo toqué?».** Todas las pantallas de gestión leen
 * de Drive, así que entre el toque y el cambio pasan segundos en los que no
 * pasaba absolutamente nada: la pantalla anterior seguía entera y el renglón
 * tocado sin marcar. Lo primero que hace cualquiera es tocar de nuevo.
 */
function Yendo() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span aria-hidden="true" className="ml-2 animate-pulse text-micro font-extrabold">
      ···
    </span>
  );
}
