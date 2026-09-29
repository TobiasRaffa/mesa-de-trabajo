// Lo que la agencia ve: todos los clientes, todas sus carpetas, incluso las
// que el cliente no ve.
//
// Es la diferencia con el portal, y es a propósito. El portal recibe solo lo
// visible —no puede filtrar lo que nunca le llegó—. Acá llega todo, porque de
// eso se trata la pantalla: decidir qué se muestra.

import {
  ajustesDe,
  ajustesDeVarias,
  esCarpetaReservada,
  type AjustesDeCarpeta,
} from "@/lib/ajustes";
import {
  esCarpetaDeMiCliente,
  miCliente,
  todosMisClientes,
  type Cliente,
} from "@/admin/datos/clientes";
import { sinLeerPorCliente } from "@/lib/conversaciones";
import { datosDeCarpeta, subcarpetasDe } from "@/lib/google";
import { conLosComentariosDelCliente } from "@/lib/comentariosDelCliente";
import { estadosDe } from "@/lib/piezas";
import { trabajosDeLaCarpeta } from "@/lib/trabajos";
import { plazosDe } from "@/lib/plazos";
import { responsablesDe } from "@/lib/responsables";
import { DIAS_POR_OMISION } from "@/lib/dias";
import { publicacionesDe, type DiaSuelto } from "@/lib/publicaciones";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import { conSusArchivos } from "@/lib/versiones";
import { ultimasVisitas } from "@/lib/visitas";

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
  /**
   * En qué vuelta va, según el número escrito en el archivo más alto.
   *
   * **No es cuántos archivos hay.** Con «V1», «V2», «V4» y «V6» son cuatro
   * archivos y la vuelta seis; la pastilla del calendario mostraba lo primero
   * con una «v» adelante, así que decía «v4» sobre un archivo llamado «V6».
   */
  version: number;
  /** `AAAA-MM-DD`, o `null` si todavía no tiene día. */
  dia: DiaSuelto | null;
};

export type CarpetaParaFechar = {
  cliente: Cliente;
  carpeta: { id: string; nombre: string; enlaceDrive?: string } & AjustesDeCarpeta;
  piezas: PiezaParaFechar[];
};

/** Todo lo que hace falta para armar el calendario de una carpeta. */
export async function carpetaParaFechar(
  clienteId: string,
  carpetaId: string
): Promise<CarpetaParaFechar> {
  const cliente = await miCliente(clienteId);
  if (!cliente) throw new Error("No encontré ese cliente.");
  // La carpeta tiene que ser **de este** cliente. Los dos identificadores
  // vienen por la dirección, y la dirección se escribe a mano.
  if (!(await esCarpetaDeMiCliente(clienteId, carpetaId))) {
    throw new Error("Esa carpeta no es de este cliente.");
  }

  const [datos, ajustes, { agrupadas }] = await Promise.all([
    datosDeCarpeta(carpetaId),
    ajustesDe(carpetaId),
    trabajosDeLaCarpeta(carpetaId),
  ]);

  // Hay piezas guardadas de cuando aprobar mudaba el archivo a «Entregas
  // finales»: Drive ya no las lista acá. Se las trae por su identificador,
  // porque la historia de una pieza aprobada es justamente la que más se
  // consulta. Lo nuevo no se muda, así que esto solo alcanza a lo de antes.
  const conArchivos = conSusArchivos(carpetaId, agrupadas);
  const identidades = conArchivos.map((p) => p.id);
  // `estadosDe` primero: si una pieza cambió de nombre, ahí se muda su ficha
  // junto con su fecha. Leída en paralelo, la fecha aparecía perdida en esta
  // pantalla hasta la próxima vez. Se llama por ese efecto —mudar la ficha—
  // aunque lo leído no se use acá: los estados con sus comentarios los arma
  // `historiaConComentariosDeCarpeta`, aparte, porque preguntar a Drive por los
  // comentarios de cada archivo es lo lento y no hace falta para el calendario.
  await estadosDe(carpetaId, conArchivos);
  const dias = await publicacionesDe(identidades);

  return {
    cliente,
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
        version: conArchivos[i].version,
        dia: dias[identidades[i]] ?? null,
      };
    }),
  };
}

/**
 * La historia de cada pieza con lo que el cliente escribió en Drive.
 *
 * **Va aparte de `carpetaParaFechar` porque es la parte lenta.** Pregunta a
 * Drive por los comentarios de cada archivo de cada pieza —una vuelta por
 * archivo—, y eso es lo que hacía esperar a la pantalla entera antes de dibujar
 * nada. Separada, el calendario aparece primero y esto llega detrás, y la
 * ventana del tablero —que solo quiere la historia— deja de calcular el
 * calendario y las fechas que después tiraba.
 *
 * Copiar lo del cliente a su lista de cambios queda del lado de
 * `comentariosDelCliente`, igual que antes, **porque el portal tiene que ver
 * exactamente lo mismo**. Nunca rompe por un tropiezo de Drive: una pieza que
 * no se pudo leer queda como estaba.
 */
export async function historiaConComentariosDeCarpeta(
  clienteId: string,
  carpetaId: string
): Promise<PiezaConHistoria[]> {
  // La carpeta tiene que ser de este cliente: esto también se pide desde la
  // ventana del tablero y desde una parte de la pantalla que se dibuja sola.
  if (!(await esCarpetaDeMiCliente(clienteId, carpetaId))) {
    throw new Error("Esa carpeta no es de este cliente.");
  }

  const { agrupadas } = await trabajosDeLaCarpeta(carpetaId);
  const conArchivos = conSusArchivos(carpetaId, agrupadas);
  const identidades = conArchivos.map((p) => p.id);
  const guardados = await estadosDe(carpetaId, conArchivos);

  const { estados, sinCopiar } = await conLosComentariosDelCliente(
    agrupadas.map((pieza, i) => ({
      id: identidades[i],
      // Todas las versiones, no solo la última: lo que el cliente escribió
      // encima de la V1 no puede desaparecer porque se subió la V2.
      archivos: pieza.versiones.map((v) => ({ id: v.archivo.id, version: v.numero })),
    })),
    guardados
  );

  return agrupadas.map((pieza, i) => ({
    ...estados[identidades[i]],
    id: identidades[i],
    nombre: pieza.titulo,
    comentarios: sinCopiar[identidades[i]] ?? [],
  }));
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
  /** Cuándo entró al portal por última vez, ISO. `null` si nunca. */
  ultimaVisita: string | null;
};

/** Todos los clientes que el robot ve, para la pantalla que los administra. */
export async function panelDeClientes(): Promise<ClienteEnGestion[]> {
  const [clientes, sinLeer] = await Promise.all([
    todosMisClientes(),
    sinLeerPorCliente("agencia"),
  ]);
  const ids = clientes.map((c) => c.id);
  const [propios, quienes, visitas] = await Promise.all([
    plazosDe(ids),
    responsablesDe(ids),
    ultimasVisitas(ids),
  ]);

  // **Las carpetas de trabajo de todos, antes del `map`.** Los ajustes se
  // pedían de a uno, adentro de dos `map` anidados: un documento por carpeta,
  // por cliente, en cada visita a la pantalla que más se abre del día. Con
  // ocho clientes de cinco carpetas son cuarenta viajes de red para dibujar
  // una lista cerrada. Es el mismo atajo que ya usa `subcarpetasDeCarpeta`.
  const deTrabajoPorCliente = new Map<string, string[]>();
  await Promise.all(
    clientes
      .filter((c) => c.habilitado)
      .map(async (cliente) => {
        const subcarpetas = await subcarpetasDe(cliente.id);
        deTrabajoPorCliente.set(
          cliente.id,
          subcarpetas.filter((c) => !esCarpetaReservada(c.name)).map((c) => c.id)
        );
      })
  );
  const ajustes = await ajustesDeVarias([...deTrabajoPorCliente.values()].flat());

  return clientes.map((cliente): ClienteEnGestion => {
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
      ultimaVisita: visitas[cliente.id] ?? null,
    };

    if (!cliente.habilitado) {
      return { ...comun, carpetas: 0, carpetasVisibles: 0, sinLeer: 0 };
    }

    const deTrabajo = deTrabajoPorCliente.get(cliente.id) ?? [];

    return {
      ...comun,
      carpetas: deTrabajo.length,
      carpetasVisibles: deTrabajo.filter((id) => ajustes[id]?.visible).length,
      sinLeer: sinLeer[cliente.id] ?? 0,
    };
  });
}
