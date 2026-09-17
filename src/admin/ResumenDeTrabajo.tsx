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
} from "@/app/(admin)/gestion/acciones";
import { DetalleDePieza } from "@/admin/DetalleDePieza";
import { ConfigurarPieza } from "@/admin/ConfigurarPieza";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import { Entregar } from "@/admin/Entregar";
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
import {
  IconoCerrar,
  IconoComparar,
  IconoConfig,
  IconoDrive,
  IconoFlecha,
} from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import { Fondo } from "@/ui/Fondo";
import { enPalabrasElDia } from "@/admin/cuando";
import { tonoDeEspera } from "@/ui/tonos";
import type { NodoArchivo } from "@/admin/datos/arbol";
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

  // **Cuál se está mirando, por su id y no por su posición.** Entregar algo
  // cambia su estado, y el orden de la lista sale del estado: guardando el
  // número, entregar la pieza que estaba abierta movía la ventana a otra.
  const [abierta, setAbierta] = useState<string | null>(soloPieza ?? null);

  // Estas dos son de la pieza que se está mirando, y por eso se guardan con su
  // id: pasar a la siguiente tiene que dejar de comparar y cerrar lo que se
  // estaba configurando, sin un efecto que lo limpie a mano.
  const [comparando, setComparando] = useState<string | null>(null);
  const [configurando, setConfigurando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    historiaDeCarpeta(c.carpetaId)
      .then((r) => vivo && r.ok && setHistoria(r.piezas))
      .catch(() => {});
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
        if (r.ok) setPiezas(r.contenido.archivos);
        else setError(r.motivo);
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

  const donde = Math.max(
    0,
    enOrden.findIndex((p) => p.id === abierta)
  );
  const pieza = enOrden[donde];
  const detalle = pieza && historia?.find((h) => h.id === pieza.id);

  const ir = (paso: number) => {
    const siguiente = enOrden[(donde + paso + enOrden.length) % enOrden.length];
    if (siguiente) setAbierta(siguiente.id);
  };

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
          className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden bg-lienzo"
        >
          {/*
            El encabezado: qué se está mirando y cómo salir. Nada más que eso.
            Lo único que hay acá que no es el título es «Abrir la carpeta», y
            está porque es la única acción de la ventana que no es de una pieza
            sino del trabajo entero: al lado del nombre del trabajo es donde
            alguien la va a buscar.
          */}
          <header className="flex items-center gap-3 bg-tinta px-5 py-4 text-lienzo">
            <div className="min-w-0 flex-1">
              <p className="truncate text-micro font-extrabold uppercase tracking-widest text-lienzo/45">
                {c.cliente} · {c.carpeta}
                {enOrden.length > 1 && ` · pieza ${donde + 1} de ${enOrden.length}`}
              </p>
              {/* **El nombre de verdad, el de Drive.** Decia «stickers» donde
                  el archivo se llama «V2_stickers.pdf»: quien lo lee aca y
                  despues va a buscarlo a Drive tiene que adivinar cual es. Y
                  no lleva al lado la vuelta en la que va, porque el nombre ya
                  la dice: era escribir «v2» dos veces en el mismo renglon. */}
              <h2
                title={pieza?.nombreCompleto}
                className="truncate text-titulo font-extrabold leading-tight tracking-tight"
              >
                {pieza ? pieza.nombreCompleto : c.carpeta}
              </h2>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {/* Las flechas solo aparecen si hay a dónde ir. */}
              {enOrden.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => ir(-1)}
                    aria-label="Pieza anterior"
                    className="grid h-9 w-9 place-items-center bg-white/15 transition-colors hover:bg-white/25"
                  >
                    <IconoFlecha className="rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => ir(1)}
                    aria-label="Pieza siguiente"
                    className="grid h-9 w-9 place-items-center bg-white/15 transition-colors hover:bg-white/25"
                  >
                    <IconoFlecha />
                  </button>
                </>
              )}
              {/* Del mismo alto que la cruz y con fondo propio: son un par, y
                  contra el fondo oscuro un botón de contorno se pierde. */}
              <Link
                href={`/gestion/cliente/${c.clienteId}/carpeta/${c.carpetaId}`}
                className="ml-2 inline-flex h-9 items-center bg-lienzo px-3 text-menudo
                           font-bold tracking-tight text-tinta transition-colors hover:bg-lienzo/90"
              >
                Abrir la carpeta
              </Link>
              <button
                type="button"
                onClick={onCerrar}
                aria-label="Cerrar"
                className="grid h-9 w-9 place-items-center bg-lienzo text-tinta transition-colors hover:bg-lienzo/90"
              >
                <IconoCerrar />
              </button>
            </div>
          </header>

          {/* El medio: la pieza y lo que se sabe de ella. Se desplaza, y no
              tiene un solo botón de acción. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {error && (
              <p className="px-5 py-4 text-normal font-semibold text-alerta">{error}</p>
            )}

            {!error && piezas === null && (
              <p className="px-5 py-4 text-normal text-apagado">Leyendo la carpeta…</p>
            )}

            {piezas !== null && enOrden.length === 0 && (
              <p className="px-5 py-4 text-normal text-apagado">
                Esta carpeta no tiene piezas.
              </p>
            )}

            {pieza && (
              <Ficha pieza={pieza} detalle={detalle} comparando={comparando === pieza.id} />
            )}
          </div>

          {/*
            Abajo: todos los botones, siempre los mismos y en el mismo orden.
            Primero los de mirar la pieza, después los de decidir sobre ella. El
            que no se puede hacer no se dibuja, pero ninguno cambia de lugar por
            eso: la fila se lee de izquierda a derecha sin buscar.
          */}
          {pieza && (
            <footer
              className="flex flex-wrap items-center gap-2 border-t-2 border-tinta bg-lienzo
                         px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3"
            >
              {pieza.enlaceDrive && (
                <BotonEnlace
                  variante="contorno"
                  href={pieza.enlaceDrive}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <IconoDrive />
                  Abrir en Drive
                </BotonEnlace>
              )}

              {pieza.vueltas > 1 && (
                <Boton
                  variante={comparando === pieza.id ? "principal" : "contorno"}
                  aria-pressed={comparando === pieza.id}
                  onClick={() => setComparando(comparando === pieza.id ? null : pieza.id)}
                >
                  <IconoComparar />
                  {/* El número de la vuelta anterior, no cuántas hay: con
                      «V2» y «V5» en la carpeta, «comparar con la v1» manda a
                      buscar un archivo que no existe. */}
                  {comparando === pieza.id
                    ? "Ver solo la última"
                    : `Comparar con la v${
                        pieza.versiones[pieza.versiones.length - 2]?.numero ?? 1
                      }`}
                </Boton>
              )}

              <Boton variante="contorno" onClick={() => setConfigurando(pieza.id)}>
                <IconoConfig />
                Configurar
              </Boton>

              {/* Lo que empuja a la derecha lo que hay que decidir: mirar es
                  gratis, entregar y otorgar una vuelta extra no. */}
              <div className="ml-auto flex flex-wrap items-center gap-2">
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
              </div>
            </footer>
          )}
        </div>
      </Fondo>

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
}: {
  pieza: NodoArchivo;
  detalle?: PiezaConHistoria;
  comparando: boolean;
}) {
  // La última vuelta es la que se está mirando, y es la que tiene imagen.
  const archivo = p.archivos[p.archivos.length - 1];
  const anterior = p.archivos[p.archivos.length - 2];
  const aLaPar = comparando && anterior !== undefined;

  const nuestros = detalle
    ? diasConNosotros(detalle.estado, detalle.historia.at(-1)?.cuando, new Date())
    : null;

  return (
    <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-8">
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
        <div className="flex flex-wrap items-center gap-2">
          <Estado estado={p.estado} />
          {!p.visible && (
            <span className="bg-tinta px-2 py-1 text-micro font-extrabold uppercase tracking-wider text-lienzo">
              Oculta
            </span>
          )}
        </div>

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
        {p.vueltaAtrasada && (
          <p className="border-l-4 border-alerta bg-alerta-tenue px-3 py-2 text-menudo font-semibold text-alerta">
            Se subió «{p.vueltaAtrasada.subida}», pero la vuelta que se muestra y se
            entrega sigue siendo «{p.vueltaAtrasada.actual}», que tiene un número más
            alto. Renombrala con un número mayor para que sea la última.
          </p>
        )}

        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-menudo">
          <Dato rotulo="A cargo de">{p.responsableA ?? "sin asignar"}</Dato>
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
                  {enPalabrasElDia(p.entregadaEl.slice(0, 10))}
                </Dato>
              )}
              {nuestros !== null && (
                <Dato rotulo="Con nosotros" tono={tonoDeEspera(nuestros)}>
                  {nuestros} {nuestros === 1 ? "día" : "días"}
                </Dato>
              )}
            </>
          ) : (
            p.vence && <Dato rotulo="Vence">{enPalabrasElDia(p.vence)}</Dato>
          )}
          {p.publicaEl && <Dato rotulo="Sale">{enPalabrasElDia(p.publicaEl)}</Dato>}
        </dl>

        {detalle && <DetalleDePieza pieza={detalle} vueltas={p.vueltas} />}
      </div>
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
    <div className="flex gap-2">
      <dt className="text-apagado">{rotulo}</dt>
      <dd className={`cifras font-bold tracking-tight ${tono}`}>{children}</dd>
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
          const r = await habilitarExtraDePieza(carpetaId, piezaId);
          setYendo(false);
          setDicho(r.motivo);
          if (r.ok) onHecho();
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
