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
import { puedeEscribirCambios, type Evento, type Pieza } from "@/dominio/pieza";
import { Boton, BotonEnlace } from "@/ui/Boton";
import { ControlDeVentana, EncabezadoDeVentana } from "@/ui/EncabezadoDeVentana";
import { Fondo } from "@/ui/Fondo";
import { Comparador } from "@/ui/Comparador";
import type { Lamina } from "@/ui/Ampliada";
import { pasoActual, Seguimiento } from "@/ui/Seguimiento";
import { LARGO_MAXIMO } from "@/dominio/texto";
import {
  IconoAmpliar,
  IconoAprobar,
  IconoBorrar,
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
import { urlDeMiniatura } from "@/lib/miniaturas";
import { Miniatura } from "@/ui/Miniatura";
import type { VersionDePieza } from "@/portal/datos/cliente";
import type { Cambio } from "@/lib/piezas";
import { enPalabrasElDiaDe } from "@/dominio/tiempo";

// El tipo vive en `lib/piezas` porque también lo usa el servidor: es lo que se
// guarda, no solo lo que se dibuja.
export type { Cambio };

export type PiezaAbierta = Pieza & {
  id: string;
  nombre: string;
  driveFileId: string;
  modificado?: string;
  /** Hasta cuándo se lo espera, si se entregó. */
  vence?: Date;
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
  /**
   * Con qué nombre viene aprobando, si este navegador ya lo sabe.
   *
   * **Aprobar pedía dos ventanas siempre.** La primera vez tiene sentido: una
   * aprobación es una decisión con nombre y hay que preguntarlo. De la segunda
   * en adelante, la ventana venía con el nombre ya puesto y un botón «Sí,
   * aprobar»: una pregunta que ya está contestada, y que hay que volver a
   * contestar por cada pieza. `null` es «todavía no lo sabemos».
   */
  firma?: string | null;
  /** Abrir la ventana para cambiar con qué nombre se aprueba. */
  onCambiarFirma?: () => void;
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
  firma = null,
  onCambiarFirma,
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
  // Lo dice el dominio y no esta pantalla: una pieza aprobada no admite
  // cambios aunque todavía no se haya enviado la revisión. Antes acá se miraba
  // solo `enviada`, y la ventana ofrecía «Agregar cambio» sobre una aprobada;
  // el servidor lo rechazaba, pero el botón estaba.
  const sePuedeTocar = puedeEscribirCambios(pieza.estado, pieza.enviada);

  const srcGrande = urlDeMiniatura(pieza.driveFileId, 1200, pieza.modificado);

  const version = (indice: number) => {
    const v = pieza.versiones[indice];
    return {
      numero: v.numero,
      src: urlDeMiniatura(v.driveFileId, 1200, v.modificado),
      pie: `Entregada el ${enPalabrasElDiaDe(v.entregadaEl)}`,
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
    // Tocar el fondo cierra, como en toda ventana de la aplicación. `<Fondo>`
    // se ocupa de que solo cierre el fondo mismo y no un toque adentro.
    <Fondo
      onCerrar={onCerrar}
      className="z-40 flex items-stretch justify-center sm:items-center sm:p-6"
    >
      <div
        ref={marco}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={pieza.nombre}
        className="flex w-full flex-col overflow-hidden bg-papel sm:max-h-[88vh] sm:max-w-6xl sm:rounded-tarjeta"
      >
        {/* La banda de color dice de quién es la pieza, cómo se llama y en qué
            anda, sin que haya que buscarlo. */}
        <EncabezadoDeVentana
          rotulo={
            <>
              Pieza {posicion.actual} de {posicion.total}
              {pieza.publicaEl && ` · sale el ${enPalabrasElDiaDe(pieza.publicaEl)}`}
            </>
          }
          titulo={pieza.nombre}
          onCerrar={onCerrar}
          controles={
            <>
              <span className="mr-1.5 hidden rounded-full bg-white/15 px-3 py-1.5 font-mono text-micro font-bold uppercase tracking-wider sm:block">
                {pasoActual(
                  pieza.versiones.map((v) => v.numero),
                  pieza.ronda,
                  pieza.rondasIncluidas,
                  pieza.estado === "final"
                )}
              </span>
              {/* **Con una sola pieza no están, no quedan apagadas.** En la
                  misma ventana del lado de la agencia desaparecen, y acá se
                  dibujaban grises: dos botones que no se pueden apretar
                  pegados a la cruz, en el borde, justo donde en el teléfono
                  hay que acertarle a la cruz. */}
              {posicion.total > 1 && (
                <>
                  <ControlDeVentana onClick={() => onIr(-1)} aria-label="Pieza anterior">
                    <IconoFlecha className="rotate-180" />
                  </ControlDeVentana>
                  <ControlDeVentana onClick={() => onIr(1)} aria-label="Pieza siguiente">
                    <IconoFlecha />
                  </ControlDeVentana>
                </>
              )}
            </>
          }
        />

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
                  <Miniatura
                    src={srcGrande}
                    alt={pieza.nombre}
                    nombre={pieza.nombre}
                    rotulo={pieza.esPdf ? "PDF" : undefined}
                    className="absolute inset-0 h-full w-full object-contain p-2"
                  />
                </button>
              )}

              {/* **Los dos del mismo tamaño.** Uno tenía `chico` y el otro no,
                  así que en la misma fila uno se veía la mitad del otro: dos
                  botones que hacen lo mismo —mirar la pieza— no pueden pesar
                  distinto. */}
              <div className="flex flex-wrap gap-2">
                {pieza.esPdf ? (
                    /* Un PDF tiene más de una página y la miniatura muestra
                       solo la primera. El archivo de verdad lo abre el visor
                       del propio navegador, que las muestra todas: pasa por
                       nuestra ruta, así que el cliente no necesita permiso de
                       Drive para nada. */
                    <BotonEnlace
                      variante="contorno"
                      tamano="chico"
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
                      : `Comparar con la v${
                          pieza.versiones[pieza.versiones.length - 2]?.numero ?? 1
                        }`}
                  </Boton>
                )}
              </div>
            </div>

            {/* Las decisiones */}
            <div className="flex flex-col gap-5">
              <Seguimiento
                vueltas={pieza.versiones.map((v) => v.numero)}
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

              {/* **Si hay algo anotado, se ve.** Se mostraba solo mientras el
                  cliente estuviera pidiendo cambios, o después de mandarlos.
                  Con lo que escribe en Drive eso dejó de alcanzar: su
                  comentario entra a esta lista sin que él toque nada acá, y la
                  pieza se abría sin rastro de él. Iba a aprobar sobre un
                  pedido suyo sin contestar. */}
              {(pidiendoCambios || pieza.cambios.length > 0) && (
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
                                  className="rounded-full grid h-11 w-11 place-items-center text-apagado transition-colors hover:bg-hueco hover:text-tinta"
                                >
                                  <IconoEditar />
                                </button>
                                {/* **Si es el último, pregunta.** Medían 32
                                    píxeles y estaban pegados: errarle al lápiz
                                    era borrar lo escrito, sin vuelta atrás. Y
                                    borrar el último no borra un renglón:
                                    devuelve la pieza a «sin decidir» y se
                                    lleva la sección entera de la pantalla, que
                                    es un cambio que nadie pidió. */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      pieza.cambios.length === 1 &&
                                      !confirm(
                                        "¿Borrás el único cambio? La pieza vuelve a quedar sin decidir."
                                      )
                                    ) {
                                      return;
                                    }
                                    onBorrarCambio(cambio.id);
                                  }}
                                  aria-label={`Borrar el cambio ${i + 1}`}
                                  className="rounded-full grid h-11 w-11 place-items-center text-apagado transition-colors hover:bg-alerta-tenue hover:text-alerta"
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
                    **Drive va acá, con las decisiones, y no arriba con las
                    formas de mirar.** Estaba al lado de «Ver en grande», que es
                    donde parecía corresponder —las dos muestran la pieza—, pero
                    no es para eso que se abre: se abre para comentar encima del
                    archivo, con las herramientas de Google, y comentar es
                    decidir. Al lado de «Pedir cambios» es donde alguien lo va a
                    buscar.

                    Solo aparece si la agencia además le compartió la carpeta
                    desde Drive; si no, el link lleva a una pantalla de Google
                    pidiendo un permiso que el cliente no tiene.
                  */}
                  {pieza.enlaceDrive && (
                    <BotonEnlace
                      href={pieza.enlaceDrive}
                      target="_blank"
                      rel="noreferrer noopener"
                      variante="contorno"
                    >
                      <IconoDrive />
                      Ver en Drive
                    </BotonEnlace>
                  )}
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
                    <span className="flex flex-col items-center gap-0.5">
                      <Boton
                        variante="contorno"
                        onClick={() => onEvento({ tipo: "pedir_revision_extra" })}
                      >
                        <IconoEditar />
                        Pedir una revisión adicional
                      </Boton>
                      {/* En un renglón y no en un `title`: en el teléfono no
                          existe, y es justo la frase que contesta «¿y ahora
                          qué pasa?». */}
                      <span className="text-micro text-apagado">
                        Se lo pedimos al equipo; te avisamos cuando la habiliten.
                      </span>
                    </span>
                  )}
                  {/* Con el nombre ya sabido, aprobar es un toque y queda
                      dicho con quién queda firmado. La ventana de la firma
                      sigue existiendo para la primera vez y para cambiarlo. */}
                  <span className="flex flex-col items-center gap-0.5">
                    <Boton
                      variante="aprobar"
                      onClick={() =>
                        firma === null
                          ? onEvento({ tipo: "aprobar", por: "cliente" })
                          : onEvento({ tipo: "aprobar", por: firma })
                      }
                    >
                      <IconoAprobar />
                      Aprobar
                    </Boton>
                    {firma !== null && (
                      <span className="text-micro text-apagado">
                        aprobás como {firma || "Cliente"}
                        {onCambiarFirma && (
                          <>
                            {" · "}
                            <button
                              type="button"
                              onClick={onCambiarFirma}
                              className="font-semibold underline underline-offset-2 hover:text-tinta"
                            >
                              cambiar
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  </span>
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
                {/* **Y nada más.** Había también un «Enviar revisión», y sobre
                    una pieza aprobada no hay nada que enviar: el servidor no
                    hace nada y la pantalla no dice por qué. Un botón que no
                    hace nada es peor que no tenerlo. */}
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
    </Fondo>
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
      {/* El tope lo respeta el campo y no solo el servidor: recortaba en
          silencio, así que quien pegaba un brief largo guardaba las primeras
          dos carillas y no se enteraba de que había perdido el resto. */}
      <textarea
        value={valor}
        onChange={(e) => onEscribir(e.target.value)}
        maxLength={LARGO_MAXIMO}
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
