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

import type { Estado } from "@/dominio/pieza";
import { ajustesDe, soloLasVisibles, type Vista } from "@/lib/ajustesDeCarpeta";
import { agruparVersiones } from "@/lib/versiones";
import { archivosDe, datosDeCarpeta, subcarpetasDe } from "@/lib/google";

/** Una vuelta anterior de la misma pieza. */
export type VersionDePieza = {
  numero: number;
  driveFileId: string;
  modificado?: string;
  entregadaEl: Date;
  /** Para abrirla en Drive. Solo funciona para quien ya tenga acceso. */
  enlaceDrive?: string;
};

export type PiezaDeCarpeta = {
  id: string;
  nombre: string;
  driveFileId: string;
  modificado?: string;
  /** El archivo en Drive: el de la vuelta que se está mirando. */
  enlaceDrive?: string;
  estado: Estado;
  ronda: number;
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

export async function portalDelCliente(): Promise<PortalDeCliente> {
  const raiz = process.env.DRIVE_CARPETA_CLIENTE;
  if (!raiz) {
    throw new Error(
      "Falta DRIVE_CARPETA_CLIENTE: sin eso no se sabe qué carpeta mostrar. " +
        "Se configura en .env.local, y en Netlify en Site settings → Environment variables."
    );
  }

  const [cliente, subcarpetas] = await Promise.all([
    datosDeCarpeta(raiz),
    subcarpetasDe(raiz),
  ]);

  const visibles = await soloLasVisibles(subcarpetas);

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
      const agrupadas = agruparVersiones(archivos);

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

          return {
            id: ultima.driveFileId,
            nombre: pieza.titulo,
            driveFileId: ultima.driveFileId,
            modificado: ultima.modificado,
            enlaceDrive: ultima.enlaceDrive,
            // Sin base de datos, todo empieza donde empieza de verdad:
            // entregado y sin revisar. Lo que el cliente vaya decidiendo lo
            // guarda su navegador hasta que exista dónde anotarlo.
            estado: "entregada" as Estado,
            // La ronda sale de cuántas vueltas hay: la segunda versión de un
            // archivo es, por definición, la ronda uno.
            ronda: versiones.length - 1,
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
