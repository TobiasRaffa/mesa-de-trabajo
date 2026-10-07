"use client";

// El resumen de un trabajo, en una ventana.
//
// Existe porque el tablero tiene que poder mirarse sin abandonarlo. Antes, para
// saber qué había adentro de una carpeta había que irse a la ficha del cliente,
// abrir el árbol y volver: cuatro pantallas para contestar «¿qué es lo que
// falta acá?». Eso hace que el tablero deje de ser el lugar donde se mira cómo
// viene todo y pase a ser un índice.
//
// **Tiene la forma exacta de la ventana del cliente**, y eso es la decisión de
// diseño de este archivo, no una casualidad. Tres zonas fijas:
//
//   encabezado   qué se está mirando, abrir la carpeta, cerrar.
//   medio        la pieza y lo que se sabe de ella. Nada más. Se desplaza.
//   abajo        **todos** los botones, juntos y quietos.
//
// Los botones estaban repartidos —uno debajo de la foto, otro debajo del
// detalle, otro adentro de la ficha— y esa es la versión de esta pantalla que
// no funcionaba: para saber qué se podía hacer con una pieza había que
// recorrerla entera con la vista, y lo que se podía hacer cambiaba de lugar
// según la pieza. Abajo siempre están todos, en el mismo orden, y la barra no
// se mueve aunque el detalle sea largo.
//
// **Y por eso se mira de a una pieza.** Una barra de acciones que valga para
// «todas las piezas de la carpeta» no existe: «Abrir en Drive» abre un archivo,
// no cinco. Si los botones son de una pieza, la ventana es de una pieza, y se
// pasa de una a otra con las flechas del encabezado, igual que el cliente.
//
// **Las piezas se piden al abrir y no antes.** El tablero ya cuesta una vuelta
// a Drive por carpeta; traer además todas las piezas de todas las carpetas para
// una ventana que se abre de a una sería pagar por adelantado algo que casi
// nunca se mira.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  abrirCarpeta,
  habilitarExtraDePieza,
  historiaDeCarpeta,
  unirConLaOtra,
} from "@/app/(admin)/gestion/acciones";
import { DetalleDePieza } from "@/admin/DetalleDePieza";
import { ConfigurarPieza } from "@/admin/ConfigurarPieza";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import { Entregar } from "@/admin/Entregar";
import { RarezasDeNombres } from "@/admin/RarezasDeNombres";
import { VueltaSinAsignar } from "@/admin/VueltaSinAsignar";
import { Estado } from "@/ui/Estado";
import { Miniatura } from "@/ui/Miniatura";
import { Boton, BotonEnlace } from "@/ui/Boton";
import { urlDeMiniatura } from "@/lib/miniaturas";
import {
  diasConNosotros,
  hayAlgoParaEntregar,
  laTenemosNosotros,
  sigueEnJuego,
} from "@/dominio/pieza";
import { Ampliada, type Lamina } from "@/ui/Ampliada";
import {
  IconoAmpliar,
  IconoComparar,
  IconoConfig,
  IconoDrive,
  IconoFlecha,
} from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import {
  ControlDeVentana,
  ENLACE_DE_VENTANA,
  EncabezadoDeVentana,
} from "@/ui/EncabezadoDeVentana";
import { Fondo } from "@/ui/Fondo";
import { enPalabrasElDia, enPalabrasElDiaDe, yaSePublico } from "@/dominio/tiempo";
import { tonoDeEspera } from "@/ui/tonos";
import type { NodoArchivo, NodoPendiente } from "@/admin/datos/arbol";
import type { Persona } from "@/lib/equipo";

/**
 * Lo que esta ventana necesita saber de un trabajo.
 *
 * **Es su propio tipo y no el del tablero.** La abren dos pantallas que
 * guardan cosas distintas —el tablero y el árbol de clientes—, y obligar a una
 * a fabricar la forma de la otra terminaba en campos inventados.
 *
 * Son seis cosas y ninguna es un número del tablero. Los tenía —«1 en juego, 1
 * sin revisar»— para dibujar mientras Drive contestaba, y esa línea se fue:
 * decía en chiquito lo mismo que la pieza dice abajo en grande, y encima lo
 * decía mal apenas se entregaba algo desde acá, porque era una foto sacada al
 * abrir la pantalla de atrás.
 */
/**
 * Las dos columnas de la ventana: la pieza y lo que se sabe de ella.
 *
 * **La ficha y la barra de abajo usan las mismas**, así los botones de mirar
 * quedan justo del ancho de la imagen. Escritas dos veces, un día una cambia
 * y la otra no.
 */
const COLUMNAS = "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-8";

/**
 * Los botones de mirar: en computadora se reparten el ancho de la imagen en
 * partes iguales. En el teléfono no entran tres iguales en 390 píxeles —el
 * último quedaba cortado afuera de la pantalla—, así que ahí ocupan lo que
 * necesitan y pasan al renglón de abajo si hace falta.
 */
const DE_LA_IMAGEN = "flex-auto px-3! whitespace-nowrap lg:min-w-0 lg:flex-1";

export type TrabajoParaMirar = {
  clienteId: string;
  cliente: string;
  carpetaId: string;
  carpeta: string;
  /** Lo que se hereda hacia las piezas mientras no tengan lo suyo. */
  diasQueCorren: number;
  responsableQueCorre: string | null;
};

export function ResumenDeTrabajo({
  carpeta: c,
  equipo,
  soloPieza,
  onCerrar,
}: {
  carpeta: TrabajoParaMirar;
  equipo: Persona[];
  /**
   * Con cuál pieza abrir.
   *
   * **Desde el árbol se abre por archivo y no por carpeta**: una carpeta con
   * dos archivos no deja decir cuál se quiere mirar. Desde el tablero se abre
   * la carpeta y arranca por la primera. En los dos casos se puede pasar a las
   * demás con las flechas: la ventana es la misma y muestra la carpeta entera.
   */
  soloPieza?: string;
  onCerrar: () => void;
}) {
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);
  const [piezas, setPiezas] = useState<NodoArchivo[] | null>(null);
  /** Las vueltas que nadie asignó: no se pueden entregar hasta que alguien diga de qué son. */
  const [pendientes, setPendientes] = useState<NodoPendiente[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Se vuelve a pedir la carpeta cuando algo de acá adentro la cambió —una
  // entrega, una revisión extra— para que no siga mostrando lo de hace un
  // minuto.
  const [vuelta, setVuelta] = useState(0);
  const recargar = () => setVuelta((n) => n + 1);

  // Lo que pasó en cada pieza: los cambios que pidió el cliente, lo que
  // escribieron encima del archivo en Drive, y cuándo. Se pide aparte porque
  // cuesta una vuelta por pieza y solo hace falta con la ventana abierta.
  const [historia, setHistoria] = useState<PiezaConHistoria[] | null>(null);
  /**
   * Por qué no se pudo leer lo que pidió el cliente.
   *
   * **El fallo se tragaba entero.** `.then((r) => r.ok && setHistoria(...))` y
   * un `.catch(() => {})`: con Drive caído, `historia` se quedaba en `null`
   * para siempre y la ventana se dibujaba como si el cliente no hubiera pedido
   * nada. Alguien miraba, veía la pieza limpia, y entregaba la misma vuelta de
   * vuelta sin atender un solo cambio.
   */
  const [errorHistoria, setErrorHistoria] = useState<string | null>(null);

  // **Cuál se está mirando, por su id y no por su posición.** Entregar algo
  // cambia su estado, y el orden de la lista sale del estado: guardando el
  // número, entregar la pieza que estaba abierta movía la ventana a otra.
  const [abierta, setAbierta] = useState<string | null>(soloPieza ?? null);

  // Estas dos son de la pieza que se está mirando, y por eso se guardan con su
  // id: pasar a la siguiente tiene que dejar de comparar y cerrar lo que se
  // estaba configurando, sin un efecto que lo limpie a mano.
  const [comparando, setComparando] = useState<string | null>(null);
  const [configurando, setConfigurando] = useState<string | null>(null);
  /** La pieza, en grande. Es el mismo visor que usa el portal. */
  const [ampliada, setAmpliada] = useState<Lamina[] | null>(null);

  useEffect(() => {
    let vivo = true;
    historiaDeCarpeta(c.carpetaId)
      .then((r) => {
        if (!vivo) return;
        if (r.ok) {
          setHistoria(r.piezas);
          setErrorHistoria(null);
        } else {
          setErrorHistoria(r.motivo);
        }
      })
      .catch(() => vivo && setErrorHistoria("No pude leer lo que pidió el cliente."));
    return () => {
      vivo = false;
    };
  }, [c.carpetaId, vuelta]);

  useEffect(() => {
    let vivo = true;
    abrirCarpeta(c.carpetaId, {
      dias: c.diasQueCorren,
      responsable: c.responsableQueCorre,
    })
      .then((r) => {
        if (!vivo) return;
        if (r.ok) {
          setPiezas(r.contenido.archivos);
          setPendientes(r.contenido.pendientes);
        } else setError(r.motivo);
      })
      .catch(() => vivo && setError("No pude leer la carpeta."));
    return () => {
      vivo = false;
    };
  }, [c.carpetaId, c.diasQueCorren, c.responsableQueCorre, vuelta]);

  // **Lo que sigue en juego primero.** Lo aprobado no desaparece —acá nada
  // desaparece— pero no es lo que se vino a mirar: queda al final, con su
  // estado puesto.
  const enOrden = [
    ...(piezas ?? []).filter((p) => sigueEnJuego(p.estado)),
    ...(piezas ?? []).filter((p) => !sigueEnJuego(p.estado)),
  ];

  /**
   * Cuál se está mirando.
   *
   * **«No la encontré» no puede significar «mostrá la primera».** Era
   * `Math.max(0, findIndex(...))`, que convierte el -1 en 0: si la pieza que se
   * pidió no estaba en la lista de esta carpeta, la ventana abría **otra** con
   * el mismo encabezado —y con su botón de Configurar— sin decir una palabra.
   * Pasaba de verdad con los archivos de una subcarpeta, y el que configuraba
   * la pieza equivocada no tenía cómo enterarse.
   *
   * Sin pieza pedida —se abrió la carpeta entera— sí arranca por la primera,
   * que es lo que se quiere.
   */
  const buscada = abierta ? enOrden.findIndex((p) => p.id === abierta) : 0;
  const noEstaLaPedida = Boolean(abierta) && buscada === -1 && (piezas?.length ?? 0) > 0;
  const donde = Math.max(0, buscada);
  const pieza = noEstaLaPedida ? undefined : enOrden[donde];
  const detalle = pieza && historia?.find((h) => h.id === pieza.id);

  const ir = (paso: number) => {
    const siguiente = enOrden[(donde + paso + enOrden.length) % enOrden.length];
    if (siguiente) setAbierta(siguiente.id);
  };

  /**
   * Pasar de pieza con las flechas del teclado.
   *
   * **Ir a la siguiente era cruzar la ventana en diagonal.** Los botones están
   * arriba a la derecha y lo que se mira está abajo a la izquierda, así que
   * revisar diez piezas eran diez viajes completos del mouse. Las flechas son
   * lo que cualquiera prueba primero en una ventana que dice «pieza 2 de 5».
   *
   * No se atienden mientras se escribe: adentro hay campos y desplegables
   * donde la flecha mueve el cursor o cambia el valor.
   */
  useEffect(() => {
    if (enOrden.length < 2) return;

    const alTeclado = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const donde = document.activeElement?.tagName;
      if (donde === "INPUT" || donde === "SELECT" || donde === "TEXTAREA") return;
      e.preventDefault();
      ir(e.key === "ArrowLeft" ? -1 : 1);
    };

    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  });

  return (
    <>
      {/* La configuración se dibuja al lado y no adentro: es una ventana
          aparte, apilada encima. Que tocar su fondo no cierre además esta es
          cosa de <Fondo>, que lo resuelve para todas. */}
      <Fondo
        onCerrar={onCerrar}
        className="z-50 flex items-end justify-center sm:items-center sm:p-6"
      >
        <div
          ref={marco}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`${c.cliente}: ${c.carpeta}`}
          className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-tarjeta bg-lienzo sm:rounded-tarjeta"
        >
          {/*
            El encabezado: qué se está mirando y cómo salir. Nada más que eso.
            Lo único que hay acá que no es el título es «Ver la carpeta», y
            está porque es la única acción de la ventana que no es de una pieza
            sino del trabajo entero: al lado del nombre del trabajo es donde
            alguien la va a buscar.
          */}
          <EncabezadoDeVentana
            rotulo={
              // `aria-live` para que un lector de pantalla diga «pieza 2 de 5»
              // al pasar con las flechas, que es lo único que cambia.
              <span aria-live="polite">
                {c.cliente} · {c.carpeta}
                {enOrden.length > 1 && ` · pieza ${donde + 1} de ${enOrden.length}`}
              </span>
            }
            // **El nombre de verdad, el de Drive.** Decía «stickers» donde el
            // archivo se llama «V2_stickers.pdf»: quien lo lee acá y después
            // va a buscarlo a Drive tiene que adivinar cuál es.
            titulo={pieza ? pieza.nombreCompleto : c.carpeta}
            onCerrar={onCerrar}
            controles={
              <>
                {/* Las flechas solo aparecen si hay a dónde ir. */}
                {enOrden.length > 1 && (
                  <>
                    <ControlDeVentana onClick={() => ir(-1)} aria-label="Pieza anterior">
                      <IconoFlecha className="rotate-180" />
                    </ControlDeVentana>
                    <ControlDeVentana onClick={() => ir(1)} aria-label="Pieza siguiente">
                      <IconoFlecha />
                    </ControlDeVentana>
                  </>
                )}
                {/* La única acción de la ventana que no es de una pieza sino
                    del trabajo entero: al lado del nombre es donde se busca. */}
                <Link
                  href={`/gestion/cliente/${c.clienteId}/carpeta/${c.carpetaId}`}
                  className={`${ENLACE_DE_VENTANA} ml-1`}
                >
                  Ver la carpeta
                </Link>
              </>
            }
          />

          {/* El medio: la pieza y lo que se sabe de ella. Se desplaza, y no
              tiene un solo botón de acción. */}
          {/* El lugar de la barra de desplazamiento se reserva acá y en la
              barra de abajo por igual: si no, cuando aparece, angosta la
              imagen y los botones de abajo dejan de medir lo mismo. */}
          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            {error && (
              <p className="px-5 py-4 text-normal font-semibold text-alerta">{error}</p>
            )}

            {!error && piezas === null && (
              <p className="px-5 py-4 text-normal text-apagado">Leyendo la carpeta…</p>
            )}

            {/* **Arriba de todo, porque frena la entrega.** Una V2 subida y
                sin asignar no es parte de ningún trabajo: si no se ve acá,
                «Entregar» contesta que no hay nada y nadie sabe por qué. */}
            {pendientes.map((pendiente) => (
              <div
                key={pendiente.id}
                className="mx-5 mt-4 border-l-4 border-alerta bg-alerta-tenue px-4 py-3"
              >
                <VueltaSinAsignar
                  carpetaId={c.carpetaId}
                  pendiente={pendiente}
                  trabajos={(piezas ?? []).map((p) => ({ id: p.id, nombre: p.nombre }))}
                  alAsignar={recargar}
                />
              </div>
            ))}

            {piezas !== null && enOrden.length === 0 && pendientes.length === 0 && (
              <p className="px-5 py-4 text-normal text-apagado">
                Esta carpeta no tiene piezas.
              </p>
            )}

            {/* Lo dice en vez de mostrar otra: una ventana que abre la pieza
                equivocada con el encabezado correcto es peor que una que avisa. */}
            {noEstaLaPedida && (
              <p className="px-5 py-4 text-normal text-alerta">
                No encontré esa pieza en esta carpeta.
              </p>
            )}

            {pieza && errorHistoria && (
              <p className="mx-5 mt-4 border-l-4 border-alerta bg-alerta-tenue px-4 py-3 text-menudo font-semibold text-alerta">
                No pude leer lo que pidió el cliente: {errorHistoria}
              </p>
            )}

            {pieza && (
              <Ficha
                pieza={pieza}
                detalle={detalle}
                comparando={comparando === pieza.id}
                carpetaId={c.carpetaId}
                alUnir={recargar}
              />
            )}
          </div>

          {/*
            Abajo: todos los botones, siempre los mismos y en el mismo orden.
            Primero los de mirar la pieza, después los de decidir sobre ella,
            y en la punta derecha configurar, que no es de la imagen ni decide
            nada: es de la pieza. El
            que no se puede hacer no se dibuja, pero ninguno cambia de lugar por
            eso: la fila se lee de izquierda a derecha sin buscar.
          */}
          {pieza && (
            <footer
              className={`grid gap-2 overflow-y-auto border-t-2 border-tinta bg-lienzo px-5 py-3
                         pb-[calc(0.75rem+env(safe-area-inset-bottom))] [scrollbar-gutter:stable]
                         sm:pb-3 ${COLUMNAS}`}
            >
              {/* **Los de mirar, del ancho de la imagen.** Van en la misma
                  columna que la pieza, repartidos en partes iguales: son los
                  botones de esa imagen, y así se leen. */}
              <div className="flex flex-wrap gap-2 lg:flex-nowrap">
              {pieza.enlaceDrive && (
                <BotonEnlace
                  variante="contorno"
                  href={pieza.enlaceDrive}
                  target="_blank"
                  rel="noreferrer noopener"
                  title="Abrir en Drive"
                  className={DE_LA_IMAGEN}
                >
                  <IconoDrive />
                  Drive
                </BotonEnlace>
              )}

              {/* **Ver en grande, acá adentro.** Para mirar la pieza que se
                  está por decidir había que abrirla en otra pestaña del
                  navegador —el toque sobre la miniatura lleva a Drive— y
                  volver. El visor ya existe: lo usa el portal. */}
              <Boton
                variante="contorno"
                title="Ver en grande"
                className={DE_LA_IMAGEN}
                onClick={() => {
                  const ultima = pieza.archivos[pieza.archivos.length - 1];
                  const previa = pieza.archivos[pieza.archivos.length - 2];
                  const anterior = pieza.versiones.at(-2)?.numero ?? 1;
                  const lamina = (id: string, n: number, rotulo?: string) => ({
                    src: urlDeMiniatura(id, 1600, pieza.modificado),
                    alt: `${pieza.nombreCompleto}, vuelta ${n}`,
                    rotulo,
                  });
                  setAmpliada(
                    comparando === pieza.id && previa
                      ? [
                          lamina(previa, anterior, `Antes · v${anterior}`),
                          lamina(ultima, pieza.version, `Ahora · v${pieza.version}`),
                        ]
                      : [lamina(ultima, pieza.version)]
                  );
                }}
              >
                <IconoAmpliar />
                Ampliar
              </Boton>

              {pieza.vueltas > 1 && (
                <Boton
                  variante={comparando === pieza.id ? "principal" : "contorno"}
                  aria-pressed={comparando === pieza.id}
                  className={DE_LA_IMAGEN}
                  onClick={() => setComparando(comparando === pieza.id ? null : pieza.id)}
                >
                  <IconoComparar />
                  {/* El número de la vuelta anterior, no cuántas hay: con
                      «V2» y «V5» en la carpeta, «comparar con la v1» manda a
                      buscar un archivo que no existe. */}
                  {comparando === pieza.id
                    ? "Solo la última"
                    : `Comparar v${pieza.versiones[pieza.versiones.length - 2]?.numero ?? 1}`}
                </Boton>
              )}
              </div>

              {/* Lo que empuja a la derecha lo que hay que decidir: mirar es
                  gratis, entregar y otorgar una vuelta extra no. */}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {pieza.estado === "extra_pedida" && (
                  <RevisionExtra
                    carpetaId={c.carpetaId}
                    piezaId={pieza.id}
                    onHecho={recargar}
                  />
                )}

                {/* **Decide solo si se muestra.** Envuelto en una condición de
                    afuera, entregar lo último lo hacía desaparecer con el
                    mensaje para el cliente adentro, justo cuando hacía falta. */}
                <Entregar
                  key={pieza.id}
                  carpetaId={c.carpetaId}
                  carpeta={pieza.nombreCompleto}
                  piezaId={pieza.id}
                  cuantas={
                    hayAlgoParaEntregar(
                      pieza.estado,
                      pieza.versiones[pieza.versiones.length - 1]?.numero ?? 1,
                      pieza.versionEntregada
                    )
                      ? 1
                      : 0
                  }
                  dias={pieza.diasQueCorren}
                  alEntregar={recargar}
                />

                {/* **Y cuando no hay nada para entregar, qué falta.** El botón
                    simplemente no estaba: quien venía a entregar miraba la
                    fila, no lo encontraba, y no tenía cómo saber si le faltaba
                    hacer algo o si la pantalla estaba rota. Lo que falta es
                    siempre lo mismo y se puede decir. */}
                {pieza.estado === "en_curso" &&
                  !hayAlgoParaEntregar(
                    pieza.estado,
                    pieza.versiones[pieza.versiones.length - 1]?.numero ?? 1,
                    pieza.versionEntregada
                  ) && (
                    <span className="text-menudo text-apagado">
                      Falta una vuelta nueva
                    </span>
                  )}

                <Boton variante="contorno" onClick={() => setConfigurando(pieza.id)}>
                  <IconoConfig />
                  Configurar
                </Boton>
              </div>
            </footer>
          )}
        </div>
      </Fondo>

      {ampliada && <Ampliada laminas={ampliada} onCerrar={() => setAmpliada(null)} />}

      {configurando && pieza && (
        <ConfigurarPieza
          pieza={detalle}
          archivo={pieza}
          carpetaId={c.carpetaId}
          equipo={equipo}
          onCambio={recargar}
          onCerrar={() => setConfigurando(null)}
        />
      )}
    </>
  );
}

/**
 * La pieza: de un lado se la mira, del otro se lee lo que se sabe de ella.
 *
 * **La miniatura importa más de lo que parece.** Una lista de nombres obliga a
 * acordarse de qué era «9312»; con la imagen al lado se reconoce sin leer, que
 * es la diferencia entre mirar el tablero y tener que ir a buscar.
 */
function Ficha({
  pieza: p,
  detalle,
  comparando,
  carpetaId,
  alUnir,
}: {
  pieza: NodoArchivo;
  detalle?: PiezaConHistoria;
  comparando: boolean;
  carpetaId: string;
  /** Se unió con la otra: hay que volver a pedir la carpeta. */
  alUnir: () => void;
}) {
  // La última vuelta es la que se está mirando, y es la que tiene imagen.
  const archivo = p.archivos[p.archivos.length - 1];
  const anterior = p.archivos[p.archivos.length - 2];
  // **Comparando, las dos vueltas ocupan el ancho entero.** La ficha vive en
  // una grilla de dos columnas —la imagen y el detalle—, así que al comparar
  // las dos vueltas se repartían una sola columna: unos 210 píxeles cada una
  // en una pantalla normal, que no alcanza para comparar nada. Lo que se vino
  // a hacer es mirar dos imágenes; el detalle puede ir abajo.
  const aLaPar = comparando && anterior !== undefined;

  const nuestros = detalle
    ? diasConNosotros(detalle.estado, detalle.historia.at(-1)?.cuando, new Date())
    : null;

  return (
    <div
      className={`grid gap-6 p-5 lg:gap-8 ${aLaPar ? "" : COLUMNAS}`}
    >
      {/* Los rótulos llevan el nombre del archivo y no «v1» a secas: comparar
          dos imágenes parecidas sin saber cuál archivo es cuál es la mitad de
          la comparación. */}
      <div className={`grid gap-1 self-start ${aLaPar ? "grid-cols-2" : ""}`}>
        {aLaPar && (
          <Vuelta
            archivo={anterior}
            nombre={p.nombre}
            rotulo={p.versiones[p.versiones.length - 2]?.nombre ?? "anterior"}
          />
        )}
        <Vuelta
          archivo={archivo}
          nombre={p.nombre}
          modificado={p.modificado}
          rotulo={aLaPar ? p.nombreCompleto : undefined}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {/*
          **La descripción del trabajo, en un tamaño que se lea.** Estaba en
          letra micro y gris: «Nari» y «vence 17 sept» no se veían, y son justo
          lo que se pregunta después del nombre.
        */}
        {/*
          **Lo primero, porque es lo que hay que arreglar antes que nada.** Un
          archivo subido que no llega a ningún lado no es un detalle del
          trabajo: es trabajo hecho que el cliente no va a ver.
        */}
        {/*
          **Es el aviso que evita una confusión que nadie puede diagnosticar.**
          Un trabajo se arma juntando los archivos que, después de la marca de
          versión, dicen lo mismo. Sacarle la marca a uno lo saca del grupo y
          funda otro trabajo: lo anotado se queda con el que conservó el
          nombre, y el cliente puede terminar mirando un archivo distinto del
          que estaba revisando, sin que nadie se entere de nada.

          **El botón renombra en Drive, que es de donde salió el problema.**
          No muda lo anotado de un trabajo al otro —sería lo más delicado que
          la aplicación podría hacer— sino que le devuelve la marca de versión
          al archivo que la perdió, y el grupo se rehace solo. Lo decide una
          persona porque desde afuera no se puede saber si son un trabajo
          partido o el mismo entregado en dos formatos, que pasa todo el tiempo.
        */}
        {p.comparteNombre && (
          <Unir carpetaId={carpetaId} pieza={p} alUnir={alUnir} />
        )}

        {p.vueltaAtrasada && (
          <p className="border-l-4 border-alerta bg-alerta-tenue px-3 py-2 text-menudo font-semibold text-alerta">
            Se subió «{p.vueltaAtrasada.subida}» pero se muestra «{p.vueltaAtrasada.actual}».
          </p>
        )}

        <RarezasDeNombres
          archivo={p}
          clase="border-l-4 border-alerta bg-alerta-tenue px-3 py-2 text-menudo font-semibold text-alerta"
        />

        {/*
          **La franja: quién, cuándo y en qué anda, de un vistazo.** Es lo que
          se pregunta después del nombre, así que va con el tamaño de lo que
          se lee primero y no en letra micro y gris. El estado va acá adentro
          y no arriba suelto: es un dato más de la misma pregunta.
        */}
        <dl className="flex flex-wrap items-start gap-x-7 gap-y-4 rounded-tarjeta bg-hueco/60 px-5 py-4">
          {/* **El estado primero, arriba a la izquierda.** Iba al final,
              empujado a la derecha, y en cuanto la franja no entraba en una
              línea caía solo abajo, lejos de todo. */}
          <div className="flex basis-full flex-wrap items-center gap-2">
            <Estado estado={p.estado} mirada="agencia" />
            {!p.visible && (
              <span className="rounded-full bg-tinta px-2.5 py-1 font-mono text-micro font-bold uppercase tracking-wider text-lienzo">
                Oculta
              </span>
            )}
          </div>
          <Dato rotulo="A cargo de">
            {p.responsableA ? (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 place-items-center rounded-full bg-lima font-mono text-menudo font-bold uppercase text-tinta"
                >
                  {p.responsableA.trim().charAt(0)}
                </span>
                {p.responsableA}
              </span>
            ) : (
              <span className="text-espera">sin asignar</span>
            )}
          </Dato>
          {/*
            **Un reloj a la vez, el que de verdad corre.**
            Hay dos y son distintos: el del cliente —los días que tiene para
            revisar, que se le vencen— y el nuestro, que no es un plazo sino la
            cuenta de cuánto hace que algo no se mueve. Se mostraban los dos
            juntos, así que se leía «vence el 11 oct» sobre una pieza que el
            cliente ya contestó: un reloj que no corre para nadie.
          */}
          {laTenemosNosotros(p.estado) ? (
            <>
              {p.entregadaEl && (
                <Dato rotulo="Se entregó">
                  {enPalabrasElDiaDe(p.entregadaEl)}
                </Dato>
              )}
              {nuestros !== null && (
                <Dato rotulo="Con nosotros" tono={tonoDeEspera(nuestros)}>
                  {nuestros} {nuestros === 1 ? "día" : "días"}
                </Dato>
              )}
            </>
          ) : (
            /* **Y ninguno cuando ya no espera a nadie.** Una pieza aprobada o
               caída no vence: mostraba «Vence 11 oct» pegado a la pastilla
               «Aprobada», una fecha en la que no va a pasar nada. */
            <>
              {sigueEnJuego(p.estado) && p.vence && (
                <Dato rotulo="Vence">{enPalabrasElDia(p.vence)}</Dato>
              )}
              {/* **Aprobada o caída: cuándo se entregó.** Era el único caso
                  sin ningún dato de tiempo, y justamente el que más se
                  consulta después —«¿esto cuándo se lo mandamos?»—. La rama de
                  arriba ya lo dice mientras la pieza es nuestra; acá faltaba. */}
              {!sigueEnJuego(p.estado) && p.entregadaEl && (
                <Dato rotulo="Se entregó">{enPalabrasElDiaDe(p.entregadaEl)}</Dato>
              )}
            </>
          )}
          {/* La fecha en que se publica, la que se pone en el calendario de
              la carpeta. Decía «Sale», y no se entendía qué salía. */}
          {p.publicaEl && (
            <Dato rotulo={yaSePublico(p.publicaEl) ? "Se publicó" : "Se publica"}>
              {enPalabrasElDia(p.publicaEl)}
            </Dato>
          )}
        </dl>

        {detalle && <DetalleDePieza pieza={detalle} version={p.version} />}
      </div>
    </div>
  );
}

/**
 * El aviso de que un renombre partió un trabajo en dos, con cómo arreglarlo.
 *
 * Renombrar en el Drive del cliente no es poca cosa, así que pide confirmar y
 * dice exactamente qué va a pasar. Se puede deshacer renombrando de nuevo.
 */
function Unir({
  carpetaId,
  pieza,
  alUnir,
}: {
  carpetaId: string;
  pieza: NodoArchivo;
  alUnir: () => void;
}) {
  const [seguro, setSeguro] = useState(false);
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unir() {
    setYendo(true);
    setError(null);
    try {
      const r = await unirConLaOtra(carpetaId, pieza.id);
      if (r.ok) alUnir();
      else setError(r.motivo);
    } catch {
      setError("No pude unirlos.");
    } finally {
      setYendo(false);
    }
  }

  return (
    <div className="border-l-4 border-alerta bg-alerta-tenue px-3 py-2">
      <p className="text-menudo font-semibold text-alerta">
        Hay otro trabajo en esta carpeta que también se llama «{pieza.nombre}», en otro
        formato. Si son el mismo, unilos; si de verdad son dos, dejalo así.
      </p>

      {!seguro ? (
        <button
          type="button"
          onClick={() => setSeguro(true)}
          className="rounded-full mt-2 min-h-toque border-2 border-alerta px-3 text-menudo font-bold
                     tracking-tight text-alerta transition-colors hover:bg-alerta/10"
        >
          Es el mismo trabajo: unirlos
        </button>
      ) : (
        <div className="mt-2">
          <p className="text-menudo text-alerta">
            {pieza.versiones.length === 1
              ? "Este archivo va a pasar a ser la vuelta siguiente"
              : `Estos ${pieza.versiones.length} archivos van a pasar a ser las vueltas siguientes`}{" "}
            del otro. Queda anotado acá: en Drive no se renombra nada.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={unir}
              disabled={yendo}
              className="rounded-full min-h-toque bg-alerta px-3 text-menudo font-bold tracking-tight
                         text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {yendo ? "Uniendo…" : "Sí, unirlos"}
            </button>
            <button
              type="button"
              onClick={() => setSeguro(false)}
              className="min-h-toque px-3 text-menudo font-semibold text-alerta underline
                         underline-offset-2"
            >
              Mejor no
            </button>
          </div>
        </div>
      )}

      {error && (
        <p aria-live="polite" className="mt-2 text-menudo font-semibold text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}

function Dato({
  rotulo,
  tono = "",
  children,
}: {
  rotulo: string;
  tono?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="font-mono text-micro font-bold uppercase tracking-widest text-apagado">
        {rotulo}
      </dt>
      <dd
        className={`cifras mt-1 flex min-h-7 items-center text-guia font-extrabold leading-none tracking-tight ${tono}`}
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * La vuelta extra que pidió el cliente, con el botón para dársela.
 *
 * **Es lo único de esta barra que contesta a alguien que está esperando.** El
 * cliente se quedó sin vueltas incluidas, pidió una más, y el portal le dijo
 * «te avisamos cuando la habiliten». Antes había que ir a buscar el botón a la
 * ficha del archivo, en otra pantalla.
 *
 * Es un botón pelado a propósito: qué pasó ya lo dice el estado de la pieza,
 * que está a dos centímetros.
 */
function RevisionExtra({
  carpetaId,
  piezaId,
  onHecho,
}: {
  carpetaId: string;
  piezaId: string;
  onHecho: () => void;
}) {
  const [yendo, setYendo] = useState(false);
  const [dicho, setDicho] = useState<string | null>(null);

  return (
    <>
      {dicho && (
        <span aria-live="polite" className="text-menudo font-semibold text-tinta-suave">
          {dicho}
        </span>
      )}
      <Boton
        variante="contorno"
        disabled={yendo}
        onClick={async () => {
          setYendo(true);
          // **Con `try`/`finally`, y no es ceremonia.** Sin él, una acción que
          // rechaza —la red se cayó, el servidor contestó mal— dejaba `yendo`
          // en verdadero para siempre: el botón quedaba apagado mostrando «…»
          // hasta recargar la página, y sin decir qué pasó.
          try {
            const r = await habilitarExtraDePieza(carpetaId, piezaId);
            setDicho(r.motivo);
            if (r.ok) onHecho();
          } catch {
            setDicho("No se pudo. Probá de nuevo.");
          } finally {
            setYendo(false);
          }
        }}
      >
        {yendo ? "…" : "Otorgar revisión extra"}
      </Boton>
    </>
  );
}

/**
 * Una vuelta de la pieza: la imagen, y tocándola se abre el archivo.
 *
 * Lleva su número cuando hay dos al lado: sin eso, comparar es mirar dos
 * imágenes parecidas sin saber cuál es cuál.
 */
function Vuelta({
  archivo,
  nombre,
  modificado,
  rotulo,
}: {
  archivo: string;
  nombre: string;
  modificado?: string;
  rotulo?: string;
}) {
  return (
    <a
      href={`/api/archivo/${archivo}?ver=1`}
      target="_blank"
      rel="noreferrer noopener"
      title={`Abrir ${nombre}`}
      className="relative block h-[38vh] w-full overflow-hidden border border-linea bg-hueco
                 transition-colors hover:border-tinta lg:h-[52vh]"
    >
      <Miniatura
        src={urlDeMiniatura(archivo, 800, modificado)}
        alt={nombre}
        nombre={nombre}
        className="absolute inset-0 h-full w-full object-contain p-1"
      />
      {rotulo && (
        <span className="absolute left-0 right-0 top-0 truncate bg-tinta px-1.5 py-0.5 text-micro font-extrabold tracking-wider text-lienzo">
          {rotulo}
        </span>
      )}
    </a>
  );
}
