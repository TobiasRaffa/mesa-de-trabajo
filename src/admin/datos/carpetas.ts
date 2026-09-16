// Lo que la agencia ve: todos los clientes, todas sus carpetas, incluso las
// que el cliente no ve.
//
// Es la diferencia con el portal, y es a propósito. El portal recibe solo lo
// visible —no puede filtrar lo que nunca le llegó—. Acá llega todo, porque de
// eso se trata la pantalla: decidir qué se muestra.

import { ajustesDe, esCarpetaReservada, type AjustesDeCarpeta } from "@/lib/ajustes";
import { clientePorId, todosLosClientes, type Cliente } from "@/lib/clientes";
import { sinLeerPorCliente } from "@/lib/conversaciones";
import { datosDeCarpeta, subcarpetasDe } from "@/lib/google";
import { piezasDeLaCarpeta, estadosDe } from "@/lib/piezas";
import { plazosDe } from "@/lib/plazos";
import { responsablesDe } from "@/lib/responsables";
import { DIAS_POR_OMISION } from "@/lib/dias";
import { publicacionesDe, type DiaSuelto } from "@/lib/publicaciones";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import { agruparVersiones, identidadDePieza } from "@/lib/versiones";

// ---------------------------------------------------------------------------

export type PiezaParaFechar = {
  /** La pieza. No es un archivo: sobrevive a que se suba una vuelta nueva. */
  id: string;
  /**
   * El archivo de Drive de la última vuelta.
   *
   * Va aparte del identificador a propósito. La fecha de publicación es de la
   * **pieza** —no se vuelve a poner cada vez que se sube una V2— pero la
   * miniatura que se ve arrastrando es la del **archivo** de la última vuelta.
   * Mezclar las dos cosas en un solo campo fue lo que hizo que subir una
   * vuelta nueva borrara la fecha del calendario.
   */
  archivo: string;
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
    piezasDeLaCarpeta(carpetaId),
  ]);

  // Hay piezas guardadas de cuando aprobar mudaba el archivo a «Entregas
  // finales»: Drive ya no las lista acá. Se las trae por su identificador,
  // porque la historia de una pieza aprobada es justamente la que más se
  // consulta. Lo nuevo no se muda, así que esto solo alcanza a lo de antes.
  const agrupadas = agruparVersiones(archivos);
  const identidades = agrupadas.map((p) =>
    identidadDePieza(carpetaId, p.versiones[0].archivo.name)
  );
  const [dias, estados] = await Promise.all([
    publicacionesDe(identidades),
    estadosDe(carpetaId, identidades),
  ]);

  return {
    cliente,
    historia: agrupadas.map((pieza, i) => ({
      ...estados[identidades[i]],
      id: identidades[i],
      nombre: pieza.titulo,
    })),
    carpeta: {
      id: carpetaId,
      nombre: datos.name,
      enlaceDrive: datos.webViewLink,
      ...ajustes,
    },
    piezas: agrupadas.map((pieza, i) => {
      const ultima = pieza.versiones[pieza.versiones.length - 1].archivo;
      return {
        id: identidades[i],
        archivo: ultima.id,
        nombre: pieza.titulo,
        modificado: ultima.modifiedTime,
        vueltas: pieza.versiones.length,
        dia: dias[identidades[i]] ?? null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------

/**
 * Un cliente, como lo ve la pantalla de administración.
 *
 * **Sin el tag.** Es el dato con el que alguien entra a su portal: no viaja al
 * navegador hasta que alguien escribe la contraseña y lo pide. Lo que sí viaja
 * es si lo tiene o no, que hace falta para avisar que falta.
 */
export type ClienteEnGestion = Omit<Cliente, "tag"> & {
  tieneClave: boolean;
  /** Cuántas carpetas de trabajo tiene, sin contar las reservadas. */
  carpetas: number;
  carpetasVisibles: number;
  /** Mensajes del cliente que la agencia todavía no leyó. */
  sinLeer: number;
  /** Los días que corren para este cliente, ya con el de omisión aplicado. */
  dias: number;
  /** Los días están puestos acá y no son el de omisión. */
  diasPropios: boolean;
  /** Quién lleva este cliente. `null` es «nadie». */
  responsable: string | null;
  /** Está puesto acá y no es la falta de una decisión. */
  responsablePropio: boolean;
};

/** Todos los clientes que el robot ve, para la pantalla que los administra. */
export async function panelDeClientes(): Promise<ClienteEnGestion[]> {
  const [clientes, sinLeer] = await Promise.all([
    todosLosClientes(),
    sinLeerPorCliente("agencia"),
  ]);
  const ids = clientes.map((c) => c.id);
  const [propios, quienes] = await Promise.all([plazosDe(ids), responsablesDe(ids)]);

  return Promise.all(
    clientes.map(async (cliente): Promise<ClienteEnGestion> => {
      // De un cliente apagado no se cuenta nada: no se le pide a Drive lo que
      // no se va a mostrar.
      const { tag, ...sinTag } = cliente;
      const comun = {
        ...sinTag,
        tieneClave: tag.trim() !== "",
        dias: propios[cliente.id] ?? DIAS_POR_OMISION,
        diasPropios: propios[cliente.id] !== undefined,
        responsable: quienes[cliente.id] ?? null,
        responsablePropio: cliente.id in quienes,
      };

      if (!cliente.habilitado) {
        return { ...comun, carpetas: 0, carpetasVisibles: 0, sinLeer: 0 };
      }

      const subcarpetas = await subcarpetasDe(cliente.id);
      const deTrabajo = subcarpetas.filter((c) => !esCarpetaReservada(c.name));
      const visibles = await Promise.all(
        deTrabajo.map(async (c) => (await ajustesDe(c.id)).visible)
      );

      return {
        ...comun,
        carpetas: deTrabajo.length,
        carpetasVisibles: visibles.filter(Boolean).length,
        sinLeer: sinLeer[cliente.id] ?? 0,
      };
    })
  );
}
