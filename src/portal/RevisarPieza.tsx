"use client";

// Una pieza, abierta para revisarla.
//
// Es una ventana y no un despliegue hacia abajo: se abre desde el calendario o
// desde la lista, se resuelve, se cierra y sigue la que viene. Trae el paso a
// la anterior y a la siguiente, para hacer las doce de una sentada.
//
// **Los cambios son una lista, no un texto.** Un cliente no piensa el pedido
// entero de una vez: se acuerda de una cosa hoy y de otra mañana. Con un solo
// campo, agregar significa reabrir, releer y escribir al final —y el riesgo de
// pisar lo anterior—. Con una lista, agregar es agregar. Cada punto se edita y
// se borra por separado, hasta que la revisión se envía; después queda firme.
//
// **La pieza tiene que verse sin desplazar.** Es lo que se vino a mirar: si
// hay que buscarla moviendo la pantalla, la ventana falló. Por eso la imagen
// se mide contra el alto de la pantalla y no contra su propia proporción.

import { useState } from "react";
import type { Evento, Pieza } from "@/dominio/pieza";
import { Boton, BotonEnlace } from "@/ui/Boton";
import { Comparador } from "@/ui/Comparador";
import type { Lamina } from "@/ui/Ampliada";
import { pasoActual, Seguimiento } from "@/ui/Seguimiento";
import {
  IconoAmpliar,
  IconoAprobar,
  IconoBorrar,
  IconoCerrar,
  IconoComparar,
  IconoDescargar,
  IconoDeshacer,
  IconoDrive,
  IconoEditar,
  IconoEnviar,
  IconoFlecha,
  IconoMas,
} from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import { fechaCorta } from "@/lib/fechas";
import { urlDeMiniatura } from "@/lib/miniaturas";
import type { VersionDePieza } from "@/portal/datos/cliente";
import type { Cambio } from "@/lib/piezas";

// El tipo vive en `lib/piezas` porque también lo usa el servidor: es lo que se
// guarda, no solo lo que se dibuja.
export type { Cambio };

export type PiezaAbierta = Pieza & {
  id: string;
  nombre: string;
  driveFileId: string;
  modificado?: string;
  /** El archivo en Drive, para abrirlo allá. */
  enlaceDrive?: string;
  /** Si es un PDF: la miniatura solo muestra la primera página. */
  esPdf: boolean;
  versiones: VersionDePieza[];
  publicaEl?: Date;
  /** Los puntos que el cliente pidió cambiar, en el orden en que los escribió. */
  cambios: Cambio[];
  enviada: boolean;
};

type Props = {
  pieza: PiezaAbierta;
  posicion: { actual: number; total: number };
  onIr: (paso: -1 | 1) => void;
  onCerrar: () => void;
  onEvento: (evento: Evento) => void;
  onAgregarCambio: (texto: string) => void;
  onEditarCambio: (id: string, texto: string) => void;
  onBorrarCambio: (id: string) => void;
  onEnviarEsta: () => void;
  onAmpliar: (laminas: Lamina[]) => void;
  /** Lo que contestó el servidor cuando dijo que no. Se muestra acá adentro. */
  rechazo?: string | null;
};

export function RevisarPieza({
  pieza,
  posicion,
  onIr,
  onCerrar,
  onEvento,
  onAgregarCambio,
  onEditarCambio,
  onBorrarCambio,
  onEnviarEsta,
  onAmpliar,
  rechazo,
}: Props) {
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);
  const [comparando, setComparando] = useState(false);

  // Qué se está escribiendo: el id de un cambio existente, "nuevo", o nada.
  // Es estado de pantalla y no del negocio, así que vive acá y no en el
  // dominio — confundir las dos cosas fue justamente lo que rompió el botón
  // de editar, que le pedía al dominio un evento que el dominio rechazaba.
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");

  const hayAnterior = pieza.versiones.length > 1;

  // Las mismas cuentas que hace el dominio. Se repiten acá solo para decidir
  // qué botón dibujar: quién puede hacer qué lo sigue decidiendo el servidor.
  const quedanRondas = pieza.ronda < pieza.rondasIncluidas + pieza.rondasExtra;
  const pendiente =
    !pieza.enviada && (pieza.estado === "entregada" || pieza.estado === "en_revision");
  const pidiendoCambios = !pieza.enviada && pieza.estado === "cambios_marcados";
  const sePuedeTocar = !pieza.enviada;

  const srcGrande = urlDeMiniatura(pieza.driveFileId, 1200, pieza.modificado);

  const version = (indice: number) => {
    const v = pieza.versiones[indice];
    return {
      numero: v.numero,
      src: urlDeMiniatura(v.driveFileId, 1200, v.modificado),
      pie: `Entregada el ${fechaCorta(v.entregadaEl)}`,
    };
  };

  /**
   * Agrandar muestra lo que se está mirando.
   *
   * Si se están comparando dos versiones, se agrandan las dos: agrandar solo
   * la actual perdería justo lo que se estaba haciendo.
   */
  function ampliarLoQueSeVe() {
    if (comparando && hayAnterior) {
      const antes = version(pieza.versiones.length - 2);
      const ahora = version(pieza.versiones.length - 1);
      onAmpliar([
        { src: antes.src, alt: `${pieza.nombre}, versión ${antes.numero}`, rotulo: `Antes · v${antes.numero}` },
        { src: ahora.src, alt: `${pieza.nombre}, versión ${ahora.numero}`, rotulo: `Ahora · v${ahora.numero}` },
      ]);
    } else {
      onAmpliar([{ src: srcGrande, alt: pieza.nombre }]);
    }
  }

  function guardarLoEscrito() {
    const texto = borrador.trim();
    if (texto) {
      if (escribiendo === "nuevo") onAgregarCambio(texto);
      else if (escribiendo) onEditarCambio(escribiendo, texto);
    }
    setEscribiendo(null);
    setBorrador("");
  }

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-tinta/50 sm:items-center sm:p-6">
      <div
        ref={marco}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={pieza.nombre}
        className="flex w-full flex-col overflow-hidden bg-papel sm:max-h-[94vh] sm:max-w-6xl"
      >
        {/* La banda de color dice de quién es la pieza, cómo se llama y en qué
            anda, sin que haya que buscarlo. */}
        <header className="flex items-center gap-4 bg-acento px-4 py-4 text-white sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-micro font-extrabold uppercase tracking-widest text-white/60">
              Pieza {posicion.actual} de {posicion.total}
              {pieza.publicaEl && ` · sale el ${fechaCorta(pieza.publicaEl)}`}
            </p>
            <h2 className="mt-0.5 truncate text-titulo font-extrabold tracking-tight">
              {pieza.nombre}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden bg-white/15 px-3 py-1.5 text-micro font-extrabold uppercase tracking-wider sm:block">
              {pasoActual(pieza.ronda, pieza.rondasIncluidas, pieza.estado === "final")}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onIr(-1)}
                disabled={posicion.total < 2}
                aria-label="Pieza anterior"
                className="grid h-9 w-9 place-items-center bg-white/15 transition-colors hover:bg-white/25 disabled:opacity-35"
              >
                <IconoFlecha className="rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => onIr(1)}
                disabled={posicion.total < 2}
                aria-label="Pieza siguiente"
                className="grid h-9 w-9 place-items-center bg-white/15 transition-colors hover:bg-white/25 disabled:opacity-35"
              >
                <IconoFlecha />
              </button>
              <button
                type="button"
                onClick={onCerrar}
                aria-label="Cerrar"
                className="grid h-9 w-9 place-items-center bg-white text-acento transition-colors hover:bg-white/90"
              >
                <IconoCerrar />
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">

            {/* La pieza, medida contra la pantalla y no contra su proporción. */}
            <div className="flex flex-col gap-3">
              {comparando && hayAnterior ? (
                <Comparador
                  nombre={pieza.nombre}
                  antes={version(pieza.versiones.length - 2)}
                  ahora={version(pieza.versiones.length - 1)}
                  onAmpliar={() => ampliarLoQueSeVe()}
                />
              ) : (
                <button
                  type="button"
                  onClick={ampliarLoQueSeVe}
                  aria-label={`Ver ${pieza.nombre} en grande`}
                  className="relative grid h-[38vh] w-full place-items-center overflow-hidden
                             border border-linea bg-lienzo sm:h-[46vh] lg:h-[58vh]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={srcGrande}
                    alt={pieza.nombre}
                    className="absolute inset-0 h-full w-full object-contain p-2"
                  />
                </button>
              )}

              <div className="flex flex-wrap gap-2">
                {pieza.esPdf ? (
                    /* Un PDF tiene más de una página y la miniatura muestra
                       solo la primera. El archivo de verdad lo abre el visor
                       del propio navegador, que las muestra todas: pasa por
                       nuestra ruta, así que el cliente no necesita permiso de
                       Drive para nada. */
                    <BotonEnlace
                      variante="fantasma"
                      href={`/api/archivo/${pieza.driveFileId}?ver=1`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <IconoAmpliar />
                      Ver el PDF entero
                    </BotonEnlace>
                  ) : (
                    <Boton variante="contorno" tamano="chico" onClick={ampliarLoQueSeVe}>
                  <IconoAmpliar />
                  {comparando && hayAnterior ? "Agrandar las dos" : "Ver en grande"}
                </Boton>
                  )}

                {/* El archivo en Drive: para quien quiera verlo con las
                    herramientas de Google, o bajarlo desde ahí. Solo abre para
                    quien ya tenga acceso a esa carpeta. */}
                {pieza.enlaceDrive && (
                  <BotonEnlace
                    href={pieza.enlaceDrive}
                    target="_blank"
                    rel="noreferrer noopener"
                    variante="contorno"
                    tamano="chico"
                  >
                    <IconoDrive />
                    Abrir en Drive
                  </BotonEnlace>
                )}

                {hayAnterior && (
                  <Boton
                    variante={comparando ? "principal" : "contorno"}
                    tamano="chico"
                    onClick={() => setComparando(!comparando)}
                    aria-pressed={comparando}
                  >
                    <IconoComparar />
                    {comparando
                      ? "Ver solo la última"
                      : `Comparar con la v${pieza.versiones.length - 1}`}
                  </Boton>
                )}
              </div>
            </div>

            {/* Las decisiones */}
            <div className="flex flex-col gap-5">
              <Seguimiento
                ronda={pieza.ronda}
                rondasIncluidas={pieza.rondasIncluidas}
                rondasExtra={pieza.rondasExtra}
                aprobada={pieza.estado === "final"}
              />

              {pieza.enviada && (
                <p className="bg-hueco px-4 py-3 text-normal font-semibold text-tinta-suave">
                  Ya se lo mandamos al equipo.
                </p>
              )}

              {!pieza.enviada && pieza.estado === "final" && (
                <p className="bg-acento-tenue px-4 py-3 text-normal font-semibold text-acento">
                  Aprobada. Va a salir tal cual está.
                </p>
              )}

              {(pidiendoCambios || (pieza.enviada && pieza.cambios.length > 0)) && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-titulo font-extrabold tracking-tight">
                      Qué habría que cambiar
                    </h3>
                    {sePuedeTocar && escribiendo === null && (
                      <Boton
                        variante="contorno"
                        tamano="chico"
                        onClick={() => {
                          setEscribiendo("nuevo");
                          setBorrador("");
                        }}
                      >
                        <IconoMas />
                        Agregar cambio
                      </Boton>
                    )}
                  </div>

                  <ol className="flex flex-col divide-y divide-linea border-y border-linea">
                    {pieza.cambios.map((cambio, i) => (
                      <li key={cambio.id} className="py-3">
                        {escribiendo === cambio.id ? (
                          <CampoDeCambio
                            valor={borrador}
                            onEscribir={setBorrador}
                            onGuardar={guardarLoEscrito}
                            onCancelar={() => {
                              setEscribiendo(null);
                              setBorrador("");
                            }}
                          />
                        ) : (
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 shrink-0 bg-tinta px-2 py-0.5 text-micro font-extrabold text-lienzo">
                              {i + 1}
                            </span>
                            <p className="min-w-0 flex-1 whitespace-pre-wrap text-normal">
                              {cambio.texto}
                            </p>
                            {sePuedeTocar && escribiendo === null && (
                              <span className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEscribiendo(cambio.id);
                                    setBorrador(cambio.texto);
                                  }}
                                  aria-label={`Editar el cambio ${i + 1}`}
                                  className="grid h-8 w-8 place-items-center text-apagado transition-colors hover:bg-hueco hover:text-tinta"
                                >
                                  <IconoEditar />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onBorrarCambio(cambio.id)}
                                  aria-label={`Borrar el cambio ${i + 1}`}
                                  className="grid h-8 w-8 place-items-center text-apagado transition-colors hover:bg-alerta-tenue hover:text-alerta"
                                >
                                  <IconoBorrar />
                                </button>
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    ))}

                    {escribiendo === "nuevo" && (
                      <li className="py-3">
                        <CampoDeCambio
                          valor={borrador}
                          onEscribir={setBorrador}
                          onGuardar={guardarLoEscrito}
                          onCancelar={() => {
                            setEscribiendo(null);
                            setBorrador("");
                          }}
                        />
                      </li>
                    )}
                  </ol>

                  {pieza.cambios.length === 0 && escribiendo === null && (
                    <p className="text-menudo text-apagado">
                      Todavía no anotaste ningún cambio.
                    </p>
                  )}

                </div>
              )}

              {pieza.estado === "extra_pedida" && (
                <p className="border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-normal font-semibold text-espera">
                  Le pedimos al equipo una revisión adicional. Te avisamos cuando la
                  habiliten.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Lo que dijo el servidor, adentro de la ventana.

            Vivía en la página de atrás, y esta ventana la tapa entera: cada
            mensaje de error que pasara con una pieza abierta era invisible. El
            cliente tocaba un botón, el servidor contestaba que no, y en la
            pantalla no pasaba absolutamente nada. */}
        {rechazo && (
          <p
            role="alert"
            className="border-t-2 border-alerta bg-alerta-tenue px-4 py-3 text-normal font-semibold text-alerta sm:px-6"
          >
            {rechazo}
          </p>
        )}

        <footer className="border-t-2 border-tinta bg-lienzo px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {pendiente && (
              <>
                <Boton variante="sutil" tamano="chico" onClick={onCerrar}>
                  Dejar esta para después
                </Boton>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {/*
                    Sin rondas, «Pedir cambios» no lleva a ningún lado: el
                    servidor lo rechaza. Y su mensaje se dibujaba **detrás** de
                    esta ventana, así que desde donde el cliente miraba el botón
                    estaba roto: lo tocaba y no pasaba nada.

                    Ahora el botón dice lo que de verdad se puede hacer.
                  */}
                  {quedanRondas ? (
                    <Boton
                      variante="contorno"
                      onClick={() => {
                        onEvento({ tipo: "pedir_cambios" });
                        setEscribiendo("nuevo");
                        setBorrador("");
                      }}
                    >
                      <IconoEditar />
                      Pedir cambios
                    </Boton>
                  ) : (
                    <Boton
                      variante="contorno"
                      onClick={() => onEvento({ tipo: "pedir_revision_extra" })}
                      title="Se lo pedimos al equipo. Te avisamos cuando la habiliten."
                    >
                      <IconoEditar />
                      Pedir una revisión adicional
                    </Boton>
                  )}
                  <Boton
                    variante="aprobar"
                    onClick={() => onEvento({ tipo: "aprobar", por: "cliente" })}
                  >
                    <IconoAprobar />
                    Aprobar
                  </Boton>
                </div>
              </>
            )}

            {pidiendoCambios && (
              <>
                <Boton
                  variante="sutil"
                  tamano="chico"
                  onClick={() => onEvento({ tipo: "descartar_cambios" })}
                >
                  <IconoDeshacer />
                  Descartar todo
                </Boton>
                <Boton
                  variante="principal"
                  onClick={onEnviarEsta}
                  disabled={pieza.cambios.length === 0}
                >
                  <IconoEnviar />
                  Enviar revisión
                </Boton>
              </>
            )}

            {!pieza.enviada && pieza.estado === "final" && (
              <>
                <BotonEnlace
                  href={`/api/archivo/${pieza.driveFileId}`}
                  download
                  variante="contorno"
                  tamano="chico"
                >
                  <IconoDescargar />
                  Descargar original
                </BotonEnlace>
                <Boton variante="principal" onClick={onEnviarEsta}>
                  <IconoEnviar />
                  Enviar revisión
                </Boton>
              </>
            )}

            {pieza.enviada && (
              <>
                <span className="hidden sm:block" />
                {pieza.estado === "final" && (
                  <BotonEnlace
                    href={`/api/archivo/${pieza.driveFileId}`}
                    download
                    variante="contorno"
                    tamano="chico"
                  >
                    <IconoDescargar />
                    Descargar original
                  </BotonEnlace>
                )}
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** El campo para escribir un punto del pedido. */
function CampoDeCambio({
  valor,
  onEscribir,
  onGuardar,
  onCancelar,
}: {
  valor: string;
  onEscribir: (t: string) => void;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={valor}
        onChange={(e) => onEscribir(e.target.value)}
        rows={3}
        autoFocus
        placeholder="Una cosa por vez: «el sol pisa la bajada», «la fecha tiene que decir 12/3»…"
        className="w-full resize-y border border-linea bg-lienzo p-3 text-normal
                   transition-colors placeholder:text-apagado
                   focus:border-acento focus:outline-none focus:ring-4 focus:ring-acento-tenue"
      />
      <div className="flex gap-2">
        <Boton
          variante="principal"
          tamano="chico"
          onClick={onGuardar}
          disabled={valor.trim().length === 0}
        >
          Guardar
        </Boton>
        <Boton variante="sutil" tamano="chico" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}
