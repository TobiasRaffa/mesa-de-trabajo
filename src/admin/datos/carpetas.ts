// Lo que la agencia ve: todos los clientes, todas sus carpetas, incluso las
// que el cliente no ve.
//
// Es la diferencia con el portal, y es a propósito. El portal recibe solo lo
// visible —no puede filtrar lo que nunca le llegó—. Acá llega todo, porque de
// eso se trata la pantalla: decidir qué se muestra.

import { ajustesDe, esCarpetaReservada, type AjustesDeCarpeta } from "@/lib/ajustesDeCarpeta";
import { clientePorId, todosLosClientes, type Cliente } from "@/lib/clientes";
import { cuentaPorCarpeta } from "@/lib/conversaciones";
import { datosDeCarpeta, subcarpetasDe, type ArchivoDrive } from "@/lib/google";
import { archivosConLasMudadas, estadosDe } from "@/lib/piezas";
import { publicacionesDe, type DiaSuelto } from "@/lib/publicaciones";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import { agruparVersiones } from "@/lib/versiones";

const ultimoId = (versiones: Array<{ archivo: ArchivoDrive }>) =>
  versiones[versiones.length - 1].archivo.id;

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
    archivosConLasMudadas(carpetaId),
  ]);

  // Una pieza aprobada se mudó a «Entregas finales» y Drive ya no la lista acá.
  // Se la trae por su identificador: la historia de una pieza aprobada es
  // justamente la que más se consulta.
  const agrupadas = agruparVersiones(archivos);
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
