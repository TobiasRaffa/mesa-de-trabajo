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
import { fechaDeDia, publicacionesDe } from "@/lib/publicaciones";
import { agruparVersiones, identidadDePieza } from "@/lib/versiones";
import { clientePorId } from "@/lib/clientes";
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

export type PiezaDeCarpeta = EstadoDePieza & {
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

/** Lo que se le promete al cliente por defecto mientras no exista el panel. */
const RONDAS_INCLUIDAS = 2;

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
      const identidades = agrupadas.map((p) =>
        identidadDePieza(carpeta.id, p.versiones[0].archivo.name)
      );
      const entregas = esCarpetaDeEntregas(carpeta.name);

      const [dias, guardados] = await Promise.all([
        publicacionesDe(identidades),
        estadosDe(carpeta.id, identidades),
      ]);

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
      const seMuestra = (p: EstadoDePieza) =>
        entregas || (p.estado !== "en_curso" && !p.mudada);

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
          const versiones = pieza.versiones.map((v, i) => ({
            // Se renumeran de corrido: si alguien salteó la V2, el cliente no
            // tiene por qué ver un hueco.
            numero: i + 1,
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
            ...guardado,
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
            // La ronda es la mayor entre lo que dice el estado guardado y las
            // vueltas que hay en Drive: subir una V2 es entrar en la ronda uno
            // aunque nadie haya tocado el portal todavía.
            ronda: Math.max(guardado.ronda, versiones.length - 1),
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
