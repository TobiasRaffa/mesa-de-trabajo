// Lo que la agencia ve: todos los clientes, todas sus carpetas, incluso las
// que el cliente no ve.
//
// Es la diferencia con el portal, y es a propósito. El portal recibe solo lo
// visible —no puede filtrar lo que nunca le llegó—. Acá llega todo, porque de
// eso se trata la pantalla: decidir qué se muestra.

import {
  ajustesDe,
  esCarpetaReservada,
  type AjustesDeCarpeta,
} from "@/lib/ajustesDeCarpeta";
import { clientePorId, todosLosClientes, type Cliente } from "@/lib/clientes";
import { cuentaPorCarpeta } from "@/lib/conversaciones";
import {
  archivosDe,
  datosDeCarpeta,
  metadatosArchivo,
  subcarpetasDe,
  type ArchivoDrive,
} from "@/lib/google";
import { estadosDe, mudadasDe } from "@/lib/piezas";
import { publicacionesDe, type DiaSuelto } from "@/lib/publicaciones";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import { agruparVersiones } from "@/lib/versiones";

const ultimoId = (versiones: Array<{ archivo: ArchivoDrive }>) =>
  versiones[versiones.length - 1].archivo.id;

export type CarpetaEnGestion = AjustesDeCarpeta & {
  id: string;
  nombre: string;
  enlaceDrive?: string;
  /** Cuántas piezas hay adentro, ya agrupadas las versiones. */
  piezas: number;
  /** Cuántos archivos son una segunda vuelta o más. */
  conVueltas: number;
  /** De esas piezas, cuántas ya tienen día de publicación. */
  conFecha: number;
  /** `Entregas finales` no es un trabajo: no se configura ni se muestra. */
  reservada: boolean;
  /** Cuántos mensajes hay en la conversación de esta carpeta. */
  mensajes: number;
};

export type VistaDeGestion = {
  cliente: Cliente;
  carpetas: CarpetaEnGestion[];
};

/** Las carpetas de un cliente, con todo lo que hace falta para configurarlas. */
export async function carpetasDelCliente(clienteId: string): Promise<VistaDeGestion> {
  const cliente = await clientePorId(clienteId);
  if (!cliente) throw new Error("No encontré ese cliente.");

  const [subcarpetas, charlas] = await Promise.all([
    subcarpetasDe(cliente.id),
    cuentaPorCarpeta(),
  ]);

  const carpetas = await Promise.all(
    subcarpetas.map(async (carpeta): Promise<CarpetaEnGestion> => {
      const reservada = esCarpetaReservada(carpeta.name);
      const ajustes = await ajustesDe(carpeta.id);
      const comun = {
        id: carpeta.id,
        nombre: carpeta.name,
        enlaceDrive: carpeta.webViewLink,
        reservada,
        mensajes: charlas[carpeta.id] ?? 0,
        ...ajustes,
      };

      // De una carpeta reservada no hace falta contar nada: no se revisa.
      if (reservada) return { ...comun, piezas: 0, conVueltas: 0, conFecha: 0 };

      const archivos = await archivosDe(carpeta.id);
      const piezas = agruparVersiones(archivos);
      const dias = await publicacionesDe(piezas.map((p) => ultimoId(p.versiones)));

      return {
        ...comun,
        piezas: piezas.length,
        conVueltas: piezas.filter((p) => p.versiones.length > 1).length,
        conFecha: piezas.filter((p) => dias[ultimoId(p.versiones)]).length,
      };
    })
  );

  return { cliente, carpetas };
}

// ---------------------------------------------------------------------------

export type PiezaParaFechar = {
  /** El archivo de la última vuelta: es el que sale publicado. */
  id: string;
  nombre: string;
  modificado?: string;
  vueltas: number;
  /** `AAAA-MM-DD`, o `null` si todavía no tiene día. */
  dia: DiaSuelto | null;
};

export type CarpetaParaFechar = {
  cliente: Cliente;
  carpeta: { id: string; nombre: string; enlaceDrive?: string } & AjustesDeCarpeta;
  piezas: PiezaParaFechar[];
  historia: PiezaConHistoria[];
};

/** Todo lo que hace falta para armar el calendario de una carpeta. */
export async function carpetaParaFechar(
  clienteId: string,
  carpetaId: string
): Promise<CarpetaParaFechar> {
  const cliente = await clientePorId(clienteId);
  if (!cliente) throw new Error("No encontré ese cliente.");

  const [datos, ajustes, archivos] = await Promise.all([
    datosDeCarpeta(carpetaId),
    ajustesDe(carpetaId),
    archivosDe(carpetaId),
  ]);

  // Una pieza aprobada se mudó a «Entregas finales» y Drive ya no la lista acá.
  // Se la trae por su identificador: la historia de una pieza aprobada es
  // justamente la que más se consulta.
  const agrupadas = agruparVersiones([
    ...archivos,
    ...(await recuperarMudadas(carpetaId, archivos)),
  ]);
  const ultimas = agrupadas.map((p) => ultimoId(p.versiones));
  const [dias, estados] = await Promise.all([
    publicacionesDe(ultimas),
    estadosDe(carpetaId, ultimas),
  ]);

  return {
    cliente,
    historia: agrupadas.map((pieza) => {
      const id = ultimoId(pieza.versiones);
      return { ...estados[id], id, nombre: pieza.titulo };
    }),
    carpeta: {
      id: carpetaId,
      nombre: datos.name,
      enlaceDrive: datos.webViewLink,
      ...ajustes,
    },
    piezas: agrupadas.map((pieza) => {
      const ultima = pieza.versiones[pieza.versiones.length - 1].archivo;
      return {
        id: ultima.id,
        nombre: pieza.titulo,
        modificado: ultima.modifiedTime,
        vueltas: pieza.versiones.length,
        dia: dias[ultima.id] ?? null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------

export type ClienteEnGestion = Cliente & {
  /** Cuántas carpetas de trabajo tiene, sin contar las reservadas. */
  carpetas: number;
  carpetasVisibles: number;
  mensajes: number;
};

/** Todos los clientes que el robot ve, para la pantalla que los administra. */
export async function panelDeClientes(): Promise<ClienteEnGestion[]> {
  const [clientes, charlas] = await Promise.all([todosLosClientes(), cuentaPorCarpeta()]);

  return Promise.all(
    clientes.map(async (cliente): Promise<ClienteEnGestion> => {
      // De un cliente apagado no se cuenta nada: no se le pide a Drive lo que
      // no se va a mostrar.
      if (!cliente.habilitado) {
        return { ...cliente, carpetas: 0, carpetasVisibles: 0, mensajes: 0 };
      }

      const subcarpetas = await subcarpetasDe(cliente.id);
      const deTrabajo = subcarpetas.filter((c) => !esCarpetaReservada(c.name));
      const visibles = await Promise.all(
        deTrabajo.map(async (c) => (await ajustesDe(c.id)).visible)
      );

      return {
        ...cliente,
        carpetas: deTrabajo.length,
        carpetasVisibles: visibles.filter(Boolean).length,
        mensajes: subcarpetas.reduce((suma, c) => suma + (charlas[c.id] ?? 0), 0),
      };
    })
  );
}

/** Trae por identificador las piezas que ya no están en la carpeta. */
async function recuperarMudadas(
  carpetaId: string,
  presentes: ArchivoDrive[]
): Promise<ArchivoDrive[]> {
  const mudadas = await mudadasDe(carpetaId);
  const faltantes = mudadas.filter((id) => !presentes.some((a) => a.id === id));

  const traidas = await Promise.all(
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
  );
  return traidas.filter((a) => a !== null);
}
