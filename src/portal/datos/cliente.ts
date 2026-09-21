// Lo que el portal le muestra a un cliente, leído de Drive.
//
// La forma es la que la agencia ya usa y no una inventada por la aplicación:
//
//     Carpeta del cliente/          ← lo único que se comparte con el robot
//     ├── Logos/                       una carpeta de trabajo
//     │   ├── 9304.jpeg                un archivo, que acá es una pieza
//     │   └── 9304 V2.jpeg
//     └── Calendario septiembre/
//
// Crear una carpeta en Drive alcanza para que aparezca en el portal. No hay
// nada que cargar en ningún lado, que era el punto: el trabajo ya está hecho
// cuando se sube el archivo.
//
// Todavía no hay base de datos, así que de acá sale **la estructura**, no el
// estado. En qué anda cada pieza —aprobada, con cambios, en qué ronda— lo
// lleva el navegador hasta que exista dónde guardarlo de verdad.

import {
  ajustesDe,
  escondidosEntre,
  esCarpetaDeEntregas,
  soloLoVisible,
  type Vista,
} from "@/lib/ajustes";
import { piezasDeLaCarpeta, estadosDe, type EstadoDePieza } from "@/lib/piezas";
import { conLosComentariosDelCliente } from "@/lib/comentariosDelCliente";
import { fechaDeDia, publicacionesDe } from "@/lib/publicaciones";
import { agruparVersiones, conSusArchivos } from "@/lib/versiones";
import { RONDAS_INCLUIDAS_POR_DEFECTO } from "@/dominio/pieza";
import { clientePorId } from "@/lib/clientes";
import { calcularVencimiento } from "@/lib/fechas";
import { plazoDe, plazoQueCorre, plazosDe } from "@/lib/plazos";
import { datosDeCarpeta, subcarpetasDe } from "@/lib/google";

/** Una vuelta anterior de la misma pieza. */
export type VersionDePieza = {
  numero: number;
  driveFileId: string;
  modificado?: string;
  entregadaEl: Date;
  /** Para abrirla en Drive. Solo funciona para quien ya tenga acceso. */
  enlaceDrive?: string;
};

/**
 * Una pieza, **como la ve el cliente**.
 *
 * **Los campos se eligen uno por uno, y no es manía de orden.** Era
 * `EstadoDePieza & {...}`, y lo guardado se copiaba entero con un `...guardado`:
 * adentro venía `historia`, que lleva el **nombre propio** de quien del equipo
 * entregó, reabrió o habilitó cada cosa, y `detalle`, que guarda el motivo
 * crudo de un error de Drive. `Portal` es una pantalla del navegador, así que
 * todo lo que entra acá viaja en el HTML que se sirve por el link público,
 * dibujado o no —y esto no se dibujaba en ninguna parte—. La pantalla del
 * token ya se negaba a mostrarle esos textos al cliente por este mismo motivo.
 *
 * Elegidos a mano, agregarle un campo a lo guardado no lo publica solo. Hay una
 * prueba que lo verifica, porque esta es la clase de cosa que vuelve sola.
 */
export type PiezaDeCarpeta = {
  /** En qué anda: es lo que decide qué puede hacer el cliente con ella. */
  estado: EstadoDePieza["estado"];
  /** En qué vuelta va. */
  ronda: number;
  /** Rondas habilitadas por encima de las incluidas. */
  rondasExtra: number;
  /** Lo que pidió cambiar en esta vuelta. */
  cambios: EstadoDePieza["cambios"];
  /** Si ya mandó la revisión: lo escrito queda firme. */
  enviada: boolean;
  id: string;
  nombre: string;
  driveFileId: string;
  /**
   * Si es un PDF.
   *
   * La miniatura de un PDF es su primera página y nada más. Para verlo entero
   * hay que abrir el archivo de verdad, y el visor del propio navegador las
   * muestra todas: no hace falta que escribamos uno.
   */
  esPdf: boolean;
  modificado?: string;
  /** El archivo en Drive: el de la vuelta que se está mirando. */
  enlaceDrive?: string;
  versiones: VersionDePieza[];
  /** Cuándo sale publicada. Solo en carpetas que se miran como calendario. */
  publicaEl?: Date;
  /**
   * Cuándo vence la revisión, si se entregó. Es el mismo plazo que ve la
   * agencia: el cliente tiene que poder ver hasta cuándo se lo espera.
   */
  vence?: Date;
};

export type CarpetaDeTrabajo = {
  id: string;
  nombre: string;
  /**
   * Qué clase de carpeta es.
   *
   * `entregas` es «Entregas finales»: no es trabajo a revisar, es el cajón con
   * lo que el cliente ya aprobó. Se muestra para mirar y descargar, y sus
   * piezas llegan ya cerradas —no puede haber un botón de aprobar sobre algo
   * que se aprobó—.
   */
  clase: "trabajo" | "entregas";
  /** Para abrirla en Drive. Solo funciona para quien ya tenga acceso. */
  enlaceDrive?: string;
  vista: Vista;
  piezas: PiezaDeCarpeta[];
};

export type PortalDeCliente = {
  cliente: { id: string; nombre: string; enlaceDrive?: string };
  carpetas: CarpetaDeTrabajo[];
  rondasIncluidas: number;
  rondasExtra: number;
};

/**
 * Lo que se le promete al cliente por defecto mientras no exista el panel.
 *
 * Sale del dominio: es la misma cuenta con la que el servidor decide si un
 * pedido de cambios entra o no. Escrita acá otra vez, la pantalla podía
 * prometer una ronda que la acción iba a rechazar.
 */
const RONDAS_INCLUIDAS = RONDAS_INCLUIDAS_POR_DEFECTO;

/** Solo se muestran las imágenes y los PDF: el resto no se puede revisar. */
const MOSTRABLES = /^(image\/|application\/pdf$)/;

/**
 * Hasta dónde se baja buscando carpetas.
 *
 * Es un tope, no una expectativa. Drive deja armar atajos que hacen ciclos, y
 * sin un límite una estructura rara se convierte en una cadena infinita de
 * pedidos a Google. El mismo número que usa el permiso, para que lo que se
 * muestra y lo que se sirve no puedan opinar distinto.
 */
const HONDURA = 6;

/**
 * Todas las carpetas visibles que cuelgan de una, a cualquier profundidad.
 *
 * **El cliente ve todo lo que la agencia dejó visible**, esté donde esté. Antes
 * se miraba un solo nivel: si había archivos en una subcarpeta, el cliente no
 * los veía y nadie se enteraba, porque desde gestión tampoco se veían.
 *
 * Lo que vuelve es una lista **llana**, con el camino en el nombre —«Calendario
 * septiembre / Semana 1»—, y no un árbol para ir abriendo. Es a propósito: el
 * cliente entra una vez cada varios días, desde el teléfono, a hacer una cosa.
 * Hacerlo navegar carpetas es ponerle entre él y el trabajo la parte de Drive
 * que el portal vino a sacar del medio. Con el camino en el nombre no se pierde
 * de dónde salió cada cosa, y no hay nada que aprender.
 */
async function carpetasVisiblesBajo(
  raiz: string,
  camino: string[],
  hondura: number
): Promise<Array<{ id: string; name: string; webViewLink?: string; camino: string[] }>> {
  if (hondura >= HONDURA) return [];

  const hijas = await soloLoVisible(await subcarpetasDe(raiz));

  const salida = await Promise.all(
    hijas.map(async (hija) => {
      const suCamino = [...camino, hija.name];
      const nietas = await carpetasVisiblesBajo(hija.id, suCamino, hondura + 1).catch(
        // Una subcarpeta que Drive no contesta no puede tumbar la pantalla
        // entera: se pierde esa rama, no el portal.
        () => []
      );
      return [{ ...hija, camino: suCamino }, ...nietas];
    })
  );

  return salida.flat();
}

/**
 * Lo que ve un cliente, leído de su carpeta.
 *
 * Recibe **de qué cliente se trata** y no lo saca de la configuración: hay
 * varios, y quién es sale del link con el que entró.
 */
export async function portalDelCliente(
  raiz: string,
  /** Si viene, se muestra esa carpeta y lo que cuelgue de ella: es su link. */
  soloEsta?: string
): Promise<PortalDeCliente> {
  const cliente = await datosDeCarpeta(raiz);

  /**
   * Si a este cliente se le muestran los links a Drive.
   *
   * **Apagado, los links no se mandan al navegador.** No alcanza con no
   * dibujarlos: un link que lleva a una pantalla de Google pidiendo un permiso
   * que el cliente no tiene es peor que no tener botón, y lo que no se manda
   * no se puede dibujar por accidente.
   *
   * El portal existe justamente para que no haga falta Drive: ver y descargar
   * pasan por nuestro servidor. Esto es para los clientes a los que la agencia
   * además les compartió la carpeta, que es algo que pasa afuera de acá.
   */
  const conDrive = (await clientePorId(raiz))?.verEnDrive ?? false;
  const siDrive = (url?: string) => (conDrive ? url : undefined);

  const todas = await carpetasVisiblesBajo(raiz, [], 0);
  const diasDelCliente = await plazoDe(raiz);

  // El link de una carpeta muestra esa y lo que tenga adentro, no el resto.
  const elegidas = soloEsta
    ? todas.filter((c) => c.id === soloEsta || perteneceA(c, todas, soloEsta))
    : todas;

  // La carpeta del cliente también puede tener archivos sueltos. Antes no se
  // miraban, así que un archivo dejado ahí no lo veía nadie.
  const conLaRaiz = [
    { id: raiz, name: cliente.name, webViewLink: cliente.webViewLink, camino: [] as string[] },
    ...elegidas,
  ];
  const aMirar = soloEsta ? elegidas : conLaRaiz;

  // Se leen en paralelo: esperar una por una haría que la pantalla tarde la
  // suma de todas.
  const carpetas = await Promise.all(
    aMirar.map(async (carpeta): Promise<CarpetaDeTrabajo> => {
      const { vista } = await ajustesDe(carpeta.id);

      // Incluye las que ya se mudaron a «Entregas finales»: aprobar no puede
      // costarle al cliente perder de vista lo que acaba de aprobar.
      const enLaCarpeta = (await piezasDeLaCarpeta(carpeta.id)).filter((a) =>
        MOSTRABLES.test(a.mimeType)
      );

      // Un archivo se puede apagar solo, sin apagar su carpeta. Se filtra acá
      // y además no se sirve: la pantalla no es el permiso, pero tampoco puede
      // ofrecer algo que después va a dar «no encontrado».
      const escondidos = await escondidosEntre(enLaCarpeta.map((a) => a.id));
      const archivos = enLaCarpeta.filter((a) => !escondidos.has(a.id));

      // «9304.jpeg» y «9304 V2.jpeg» son una sola pieza en dos vueltas, no
      // dos piezas. La regla vive en `versiones.ts` y está probada aparte.
      const agrupadas = agruparVersiones(archivos);

      // Todo lo anotado sobre el trabajo va por la identidad de la pieza, no
      // por el archivo: subir una vuelta nueva no puede hacer desaparecer los
      // cambios que el cliente pidió ni la fecha en que sale publicada.
      const conArchivos = conSusArchivos(carpeta.id, agrupadas);
      const identidades = conArchivos.map((p) => p.id);
      const entregas = esCarpetaDeEntregas(carpeta.name);

      const [dias, deLaBase, propios, diasDeLaCarpeta] = await Promise.all([
        publicacionesDe(identidades),
        estadosDe(carpeta.id, conArchivos),
        plazosDe(identidades),
        plazoDe(carpeta.id),
      ]);

      // **Lo que el cliente escribió encima del archivo, en Drive, es un
      // pedido suyo igual.** Entra a su lista de cambios con la hoja adelante,
      // y lo espera ahí hasta que toque «Enviar revisión»: un comentario
      // suelto no es una devolución. Lo escribe la misma función que usa la
      // pantalla de gestión, para que los dos vean lo mismo.
      const { estados: guardados } = await conLosComentariosDelCliente(
        agrupadas.map((pieza, i) => ({
          id: identidades[i],
          // Todas las versiones, no solo la última: lo que el cliente escribió
          // encima de la V1 no puede desaparecer porque se subió la V2.
          archivos: pieza.versiones.map((v) => ({ id: v.archivo.id, version: v.numero })),
        })),
        deLaBase
      );

      // En «Entregas finales» todo está aprobado por definición: llegó ahí
      // porque el cliente lo aprobó. Lo anotado de cada pieza vive bajo su
      // carpeta de origen, así que preguntar acá devolvería piezas «sin tocar»
      // —con botón de aprobar incluido— sobre trabajo ya cerrado.
      const estados = entregas
        ? Object.fromEntries(
            Object.entries(guardados).map(([id, p]) => [
              id,
              { ...p, estado: "final" as const, mudada: true },
            ])
          )
        : guardados;

      // **Lo que el cliente ve de una carpeta de trabajo.** Dos filtros, y los
      // dos son decisiones tomadas:
      //
      //   - `en_curso` no se muestra: todavía no se entregó. Antes un archivo
      //     se veía en el instante en que tocaba Drive, así que el JPG a medio
      //     hacer y la prueba de color le llegaban al cliente sin que nadie lo
      //     decidiera.
      //   - Lo ya mudado a «Entregas finales» tampoco: está en el cajón de lo
      //     terminado, y repetirlo acá dejaba la misma pieza dos veces en la
      //     pantalla. La carpeta de trabajo muestra lo que falta.
      //
      // En «Entregas finales» no se filtra nada: lo que está ahí, está.
      //   - **Pero lo que ya se entregó alguna vez sí se muestra**, aunque
      //     haya vuelto a `en_curso`. Una pieza que el cliente devolvió con
      //     cambios queda ahí mientras el equipo la rehace, y con el filtro
      //     puesto desaparecía del portal al recargar: el cliente mandaba ocho
      //     pedidos de cambio y la pantalla se le vaciaba, sin una palabra. El
      //     grupo «Con el equipo» existe exactamente para eso, con su texto ya
      //     escrito: «Ya las tiene la agencia. No hay nada que hacer de tu
      //     lado.»
      const seMuestra = (p: EstadoDePieza) =>
        entregas ||
        ((p.estado !== "en_curso" || p.entregadaEl !== undefined) && !p.mudada);

      const aLaVista = agrupadas
        .map((pieza, i) => ({ pieza, suya: identidades[i] }))
        .filter(({ suya }) => seMuestra(estados[suya]));

      return {
        id: carpeta.id,
        clase: entregas ? ("entregas" as const) : ("trabajo" as const),
        // El camino completo, para no tener dos «Semana 1» idénticas en la
        // lista y no saber de cuál mes es cada una.
        nombre: carpeta.camino.length > 0 ? carpeta.camino.join(" / ") : carpeta.name,
        enlaceDrive: siDrive(carpeta.webViewLink),
        vista,
        piezas: aLaVista.map(({ pieza, suya }) => {
          const versiones = pieza.versiones.map((v) => ({
            // **El número que dice el archivo.** Se renumeraban de corrido
            // para que el cliente no viera huecos, y el precio era peor que el
            // hueco: veía «V4» sobre un archivo llamado «V5_stickers.jpeg», y
            // al hablar con la agencia cada uno nombraba otra cosa. Si el
            // equipo saltea un número, el salto se ve —está en Drive— y lo
            // arregla quien nombra los archivos.
            numero: v.numero,
            driveFileId: v.archivo.id,
            modificado: v.archivo.modifiedTime,
            enlaceDrive: siDrive(v.archivo.webViewLink),
            entregadaEl: v.archivo.modifiedTime
              ? new Date(v.archivo.modifiedTime)
              : new Date(),
          }));
          const ultima = versiones[versiones.length - 1];

          const guardado = estados[suya];

          return {
            estado: guardado.estado,
            rondasExtra: guardado.rondasExtra,
            enviada: guardado.enviada,
            // **Una pieza aprobada no tiene cambios a medio escribir.** Aprobar
            // los borra, pero hay piezas guardadas de antes de que lo hiciera,
            // y el portal mostraba «Aprobada, sale tal cual» con una lista de
            // pedidos abajo. Lo mandado sí queda: ya es historia.
            cambios:
              guardado.estado === "final" && !guardado.enviada ? [] : guardado.cambios,
            id: suya,
            esPdf:
              pieza.versiones[pieza.versiones.length - 1].archivo.mimeType ===
              "application/pdf",
            nombre: pieza.titulo,
            driveFileId: ultima.driveFileId,
            modificado: ultima.modificado,
            enlaceDrive: ultima.enlaceDrive,
            // La fecha va con la vuelta que se está mirando: si se subió una
            // V2, es esa la que sale publicada.
            publicaEl: dias[suya] ? fechaDeDia(dias[suya]) : undefined,
            vence: guardado.entregadaEl
              ? calcularVencimiento(
                  new Date(guardado.entregadaEl),
                  plazoQueCorre(propios[suya], diasDeLaCarpeta, diasDelCliente)
                )
              : undefined,
            // **La ronda es la que dice el dominio, y nada más.**
            //
            // Era la mayor entre esa y la cantidad de archivos que hay en
            // Drive, con la idea de que subir una V2 ya es estar en la ronda
            // uno. El efecto real era otro: **los archivos le gastaban las
            // revisiones al cliente**. Una pieza recién entregada, con cuatro
            // archivos de historia atrás, le llegaba sin ninguna vuelta
            // incluida y sin el botón de pedir cambios.
            //
            // Una revisión la gasta el cliente cuando pide cambios; subir una
            // versión es trabajo nuestro. Y para *mostrar* en qué versión va,
            // el camino ya usa los números de los archivos, que es de donde
            // tiene que salir.
            ronda: guardado.ronda,
            versiones,
          };
        }),
      };
    })
  );

  return {
    cliente: { id: raiz, nombre: cliente.name, enlaceDrive: siDrive(cliente.webViewLink) },
    // Una carpeta vacía no se muestra: no hay nada que revisar adentro.
    //
    // «Entregas finales» va al final de la lista, siempre. Es lo terminado, y
    // arriba tiene que estar lo que espera una decisión: si se ordenara por
    // nombre quedaría primera, delante del trabajo que hay que mirar.
    carpetas: carpetas
      .filter((c) => c.piezas.length > 0)
      .sort((a, b) => Number(a.clase === "entregas") - Number(b.clase === "entregas")),
    rondasIncluidas: RONDAS_INCLUIDAS,
    rondasExtra: 0,
  };
}

/** Si esta carpeta cuelga de aquella, mirando el camino que ya calculamos. */
function perteneceA(
  carpeta: { camino: string[] },
  todas: Array<{ id: string; camino: string[] }>,
  ancestro: string
): boolean {
  const suyo = todas.find((c) => c.id === ancestro);
  if (!suyo) return false;
  return (
    carpeta.camino.length > suyo.camino.length &&
    suyo.camino.every((paso, i) => carpeta.camino[i] === paso)
  );
}
