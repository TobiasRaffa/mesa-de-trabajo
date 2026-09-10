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

import { ajustesDe, soloLasVisibles, type Vista } from "@/lib/ajustesDeCarpeta";
import { estadosDe, mudadasDe, type EstadoDePieza } from "@/lib/piezas";
import { fechaDeDia, publicacionesDe } from "@/lib/publicaciones";
import { agruparVersiones } from "@/lib/versiones";
import {
  archivosDe,
  datosDeCarpeta,
  metadatosArchivo,
  subcarpetasDe,
  type ArchivoDrive,
} from "@/lib/google";

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
 * Lo que ve un cliente, leído de su carpeta.
 *
 * Recibe **de qué cliente se trata** y no lo saca de la configuración: hay
 * varios, y quién es sale del link con el que entró.
 */
export async function portalDelCliente(
  raiz: string,
  /** Si viene, se muestra esa carpeta sola: es el link de una carpeta. */
  soloEsta?: string
): Promise<PortalDeCliente> {
  const [cliente, subcarpetas] = await Promise.all([
    datosDeCarpeta(raiz),
    subcarpetasDe(raiz),
  ]);

  const visibles = (await soloLasVisibles(subcarpetas)).filter(
    (c) => !soloEsta || c.id === soloEsta
  );

  // Las carpetas se leen en paralelo: son pocas y esperar una por una haría
  // que la pantalla tarde la suma de todas.
  const carpetas = await Promise.all(
    visibles.map(async (carpeta): Promise<CarpetaDeTrabajo> => {
      const { vista } = await ajustesDe(carpeta.id);
      const archivos = (await archivosDe(carpeta.id)).filter((a) =>
        MOSTRABLES.test(a.mimeType)
      );

      // «9304.jpeg» y «9304 V2.jpeg» son una sola pieza en dos vueltas, no
      // dos piezas. La regla vive en `versiones.ts` y está probada aparte.
      // Una pieza aprobada se mudó a «Entregas finales» y Drive ya no la lista
      // acá. Se la vuelve a traer por su identificador: sacarla de la vista
      // sería castigar al cliente por haber aprobado.
      const mudadas = await mudadasDe(carpeta.id);
      const faltantes = mudadas.filter((id) => !archivos.some((a) => a.id === id));
      const recuperadas = (
        await Promise.all(
          faltantes.map(async (id) => {
            try {
              const datos = await metadatosArchivo(id);
              const recuperado: ArchivoDrive = {
                id: datos.id,
                name: datos.name,
                mimeType: datos.mimeType,
                thumbnailLink: datos.thumbnailLink,
                modifiedTime: datos.modifiedTime,
                webViewLink: datos.webViewLink,
              };
              return recuperado;
            } catch {
              return null;
            }
          })
        )
      ).filter((a) => a !== null);

      const agrupadas = agruparVersiones([...archivos, ...recuperadas]);

      // Las fechas las puso la agencia arrastrando en el calendario. Se piden
      // todas juntas: una consulta por pieza serían doce lecturas del archivo.
      const ultimas = agrupadas.map(
        (p) => p.versiones[p.versiones.length - 1].archivo.id
      );
      const [dias, estados] = await Promise.all([
        publicacionesDe(ultimas),
        estadosDe(carpeta.id, ultimas),
      ]);

      return {
        id: carpeta.id,
        nombre: carpeta.name,
        enlaceDrive: carpeta.webViewLink,
        vista,
        piezas: agrupadas.map((pieza) => {
          const versiones = pieza.versiones.map((v, i) => ({
            // Se renumeran de corrido: si alguien salteó la V2, el cliente no
            // tiene por qué ver un hueco.
            numero: i + 1,
            driveFileId: v.archivo.id,
            modificado: v.archivo.modifiedTime,
            enlaceDrive: v.archivo.webViewLink,
            entregadaEl: v.archivo.modifiedTime
              ? new Date(v.archivo.modifiedTime)
              : new Date(),
          }));
          const ultima = versiones[versiones.length - 1];

          const guardado = estados[ultima.driveFileId];

          return {
            ...guardado,
            id: ultima.driveFileId,
            nombre: pieza.titulo,
            driveFileId: ultima.driveFileId,
            modificado: ultima.modificado,
            enlaceDrive: ultima.enlaceDrive,
            // La fecha va con la vuelta que se está mirando: si se subió una
            // V2, es esa la que sale publicada.
            publicaEl: dias[ultima.driveFileId]
              ? fechaDeDia(dias[ultima.driveFileId])
              : undefined,
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
    cliente: { id: raiz, nombre: cliente.name, enlaceDrive: cliente.webViewLink },
    // Una carpeta vacía no se muestra: no hay nada que revisar adentro.
    carpetas: carpetas.filter((c) => c.piezas.length > 0),
    rondasIncluidas: RONDAS_INCLUIDAS,
    rondasExtra: 0,
  };
}
