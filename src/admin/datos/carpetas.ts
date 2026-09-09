// Lo que la agencia ve de un cliente: todas sus carpetas, incluso las que el
// cliente no ve.
//
// Es la diferencia con el portal, y es a propósito. El portal recibe solo lo
// visible —no puede filtrar lo que nunca le llegó—. Acá llega todo, porque de
// eso se trata la pantalla: decidir qué se muestra.

import {
  ajustesDe,
  esCarpetaReservada,
  type AjustesDeCarpeta,
} from "@/lib/ajustesDeCarpeta";
import { cuentaPorCarpeta } from "@/lib/conversaciones";
import { archivosDe, datosDeCarpeta, subcarpetasDe } from "@/lib/google";
import { agruparVersiones } from "@/lib/versiones";

export type CarpetaEnGestion = AjustesDeCarpeta & {
  id: string;
  nombre: string;
  enlaceDrive?: string;
  /** Cuántas piezas hay adentro, ya agrupadas las versiones. */
  piezas: number;
  /** Cuántos archivos son una segunda vuelta o más. */
  conVueltas: number;
  /** `Entregas finales` no es un trabajo: no se configura ni se muestra. */
  reservada: boolean;
  /** Cuántos mensajes hay en la conversación de esta carpeta. */
  mensajes: number;
};

export type VistaDeGestion = {
  cliente: { id: string; nombre: string; enlaceDrive?: string };
  carpetas: CarpetaEnGestion[];
};

export async function carpetasDelCliente(): Promise<VistaDeGestion> {
  const raiz = process.env.DRIVE_CARPETA_CLIENTE;
  if (!raiz) {
    throw new Error(
      "Falta DRIVE_CARPETA_CLIENTE: sin eso no se sabe qué carpeta administrar."
    );
  }

  const [cliente, subcarpetas, charlas] = await Promise.all([
    datosDeCarpeta(raiz),
    subcarpetasDe(raiz),
    cuentaPorCarpeta(),
  ]);

  const carpetas = await Promise.all(
    subcarpetas.map(async (carpeta): Promise<CarpetaEnGestion> => {
      const reservada = esCarpetaReservada(carpeta.name);
      const ajustes = await ajustesDe(carpeta.id);

      // De una carpeta reservada no hace falta contar nada: no se revisa.
      const piezas = reservada ? [] : agruparVersiones(await archivosDe(carpeta.id));

      return {
        id: carpeta.id,
        nombre: carpeta.name,
        enlaceDrive: carpeta.webViewLink,
        piezas: piezas.length,
        conVueltas: piezas.filter((p) => p.versiones.length > 1).length,
        reservada,
        mensajes: charlas[carpeta.id] ?? 0,
        ...ajustes,
      };
    })
  );

  return {
    cliente: { id: raiz, nombre: cliente.name, enlaceDrive: cliente.webViewLink },
    carpetas,
  };
}
