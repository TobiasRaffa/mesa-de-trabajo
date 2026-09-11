// El contenido de una carpeta, nivel por nivel, hasta donde llegue.
//
// **Gestión muestra todo lo que el robot puede ver.** La agencia arma en Drive
// la estructura que le sirve —«Logos», «Calendario septiembre», y adentro las
// subcarpetas que hagan falta— y acá aparece tal cual es, sin un límite de
// profundidad inventado por la aplicación. Lo que no se ve no se puede
// configurar, y lo que no se puede configurar termina siendo una sorpresa.
//
// Es una sola función para cualquier nivel: la carpeta del cliente y una
// subcarpeta de tercer nivel se piden igual. Tener una para «las carpetas del
// cliente» y otra para «los archivos de una carpeta» fue lo que dejó el árbol
// clavado en dos niveles.
//
// Cada nivel se pide **cuando se abre** y no antes: leer de Drive todo lo de
// todos los clientes para dibujar una lista que arranca cerrada sería pagar por
// adelantado algo que casi nunca se mira.
//
// Lo que se hereda —el tiempo de revisión y quién lo lleva— baja de escalón en
// escalón: cada nivel recibe lo que corre arriba y le pasa a sus hijos lo que
// corre en él. Así la regla es la misma a cualquier profundidad.

import { ajustesDe, esCarpetaReservada, escondidosEntre } from "@/lib/ajustes";
import { personaPorId } from "@/lib/equipo";
import { subcarpetasDe } from "@/lib/google";
import { piezasDeLaCarpeta, estadosDe } from "@/lib/piezas";
import { plazoDe, plazosDe, plazoQueCorre } from "@/lib/plazos";
import {
  responsableDe,
  responsablesDe,
  responsableQueCorre,
} from "@/lib/responsables";
import { diaDe, publicacionesDe } from "@/lib/publicaciones";
import { calcularVencimiento } from "@/lib/fechas";
import { agruparVersiones, identidadDePieza } from "@/lib/versiones";
import type { Estado } from "@/dominio/pieza";

export type NodoCarpeta = {
  id: string;
  nombre: string;
  enlaceDrive?: string;
  visible: boolean;
  vista: "lista" | "calendario";
  token?: string;
  /** Quién está puesto a mano acá. `null` es «nadie»; ausente es «hereda». */
  responsable?: string | null;
  /** Quién lo lleva de verdad, ya heredado. */
  responsableQueCorre: string | null;
  /** Su nombre, para mostrar. */
  responsableA: string | null;
  /** Los días de revisión puestos a mano en esta carpeta, si los tiene. */
  dias?: number;
  /** Los que de verdad corren acá, ya heredados. */
  diasQueCorren: number;
  piezas: number;
  sinRevisar: number;
  /** Cuántas carpetas tiene adentro. Una carpeta puede no tener archivos. */
  subcarpetas: number;
  /** `Entregas finales` no es un trabajo: no se configura. */
  reservada: boolean;
};

export type NodoArchivo = {
  id: string;
  nombre: string;
  /** Si el cliente lo ve. Se apaga y se prende igual que una carpeta. */
  visible: boolean;
  /**
   * Los archivos de Drive de esta pieza: todas sus vueltas.
   *
   * Un renglón del árbol es **una pieza**, no un archivo: «9304.jpeg» y
   * «9304 V2.jpeg» son el mismo renglón. Apagar la pieza tiene que apagar
   * todas sus vueltas, o el cliente sigue viendo la V1 de algo que la agencia
   * creyó haber escondido.
   */
  archivos: string[];
  enlaceDrive?: string;
  modificado?: string;
  estado: Estado;
  vueltas: number;
  /** Ya se mudó a «Entregas finales». */
  mudada: boolean;
  /** Cuándo sale publicada, si tiene fecha. */
  publicaEl?: string;
  /** Los días puestos a mano en este archivo, si los tiene. */
  dias?: number;
  /** Los que de verdad corren, ya heredados. */
  diasQueCorren: number;
  /** Cuándo vence, calculado: el día que se subió más los días. */
  vence?: string;
  /** Quién está puesto a mano acá. `null` es «nadie»; ausente es «hereda». */
  responsable?: string | null;
  responsableQueCorre: string | null;
  responsableA: string | null;
};

/**
 * Lo que corre a nivel del cliente: el escalón de más arriba.
 *
 * De acá arranca la herencia y baja sola por cada nivel, sin importar cuántos
 * haya.
 */
export async function heredadoDelCliente(clienteId: string): Promise<Heredado> {
  const [dias, quien] = await Promise.all([plazoDe(clienteId), responsableDe(clienteId)]);
  return {
    dias: plazoQueCorre(undefined, undefined, dias),
    responsable: responsableQueCorre(undefined, undefined, quien),
  };
}

export type Contenido = { carpetas: NodoCarpeta[]; archivos: NodoArchivo[] };

/** Lo que se hereda de arriba, ya resuelto. */
export type Heredado = { dias: number; responsable: string | null };

/**
 * Todo lo que hay dentro de una carpeta: sus subcarpetas y sus archivos.
 *
 * Sirve igual para la carpeta de un cliente que para una subcarpeta de cuarto
 * nivel. Lo único que cambia es qué se hereda, y eso llega como parámetro.
 */
export async function contenidoDe(
  carpetaId: string,
  heredado: Heredado
): Promise<Contenido> {
  const [carpetas, archivos] = await Promise.all([
    subcarpetasDeCarpeta(carpetaId, heredado),
    archivosDeCarpeta(carpetaId, heredado),
  ]);
  return { carpetas, archivos };
}

async function subcarpetasDeCarpeta(
  carpetaId: string,
  heredado: Heredado
): Promise<NodoCarpeta[]> {
  const carpetas = await subcarpetasDe(carpetaId);
  const ids = carpetas.map((c) => c.id);
  const [propios, responsables] = await Promise.all([plazosDe(ids), responsablesDe(ids)]);

  return Promise.all(
    carpetas.map(async (carpeta): Promise<NodoCarpeta> => {
      const reservada = esCarpetaReservada(carpeta.name);
      const ajustes = await ajustesDe(carpeta.id);
      const propio = carpeta.id in responsables ? responsables[carpeta.id] : undefined;
      const quien = responsableQueCorre(propio, heredado.responsable, undefined);
      const persona = await personaPorId(quien ?? undefined);

      const base = {
        id: carpeta.id,
        nombre: carpeta.name,
        enlaceDrive: carpeta.webViewLink,
        visible: ajustes.visible,
        vista: ajustes.vista,
        token: ajustes.token,
        responsable: propio,
        responsableQueCorre: quien,
        responsableA: persona?.nombre ?? null,
        dias: propios[carpeta.id],
        diasQueCorren: plazoQueCorre(propios[carpeta.id], heredado.dias, undefined),
        reservada,
      };

      // Cuántas carpetas tiene adentro se pregunta siempre: una carpeta sin
      // archivos pero con subcarpetas no está vacía, y decir «0 piezas» a
      // secas invitaría a pensar que sí.
      const adentro = await subcarpetasDe(carpeta.id).catch(() => []);

      // De una carpeta reservada no se cuenta nada: no se revisa.
      if (reservada) {
        return { ...base, piezas: 0, sinRevisar: 0, subcarpetas: adentro.length };
      }

      const agrupadas = agruparVersiones(await piezasDeLaCarpeta(carpeta.id));
      const identidades = agrupadas.map((p) =>
        identidadDePieza(carpeta.id, p.versiones[0].archivo.name)
      );
      const estados = await estadosDe(carpeta.id, identidades);

      return {
        ...base,
        piezas: agrupadas.length,
        sinRevisar: Object.values(estados).filter(
          (p) => p.estado === "entregada" || p.estado === "en_revision"
        ).length,
        subcarpetas: adentro.length,
      };
    })
  );
}

async function archivosDeCarpeta(
  carpetaId: string,
  heredado: Heredado
): Promise<NodoArchivo[]> {
  const agrupadas = agruparVersiones(await piezasDeLaCarpeta(carpetaId));

  // Todo lo que se anota sobre el trabajo —el estado, la fecha de publicación,
  // el plazo, quién lo lleva— va por la identidad de la pieza y no por el
  // archivo: si no, subir una vuelta nueva lo dejaba todo guardado bajo un
  // nombre que ya nadie pregunta.
  const identidades = agrupadas.map((p) =>
    identidadDePieza(carpetaId, p.versiones[0].archivo.name)
  );

  const [estados, dias, propios, responsables, escondidos] = await Promise.all([
    estadosDe(carpetaId, identidades),
    publicacionesDe(identidades),
    plazosDe(identidades),
    responsablesDe(identidades),
    escondidosEntre(agrupadas.flatMap((p) => p.versiones.map((v) => v.archivo.id))),
  ]);

  const nombres = new Map<string, string | null>();
  for (const id of new Set(Object.values(responsables))) {
    if (id) nombres.set(id, (await personaPorId(id))?.nombre ?? null);
  }
  const nombreDelHeredado = heredado.responsable
    ? ((await personaPorId(heredado.responsable))?.nombre ?? null)
    : null;

  return agrupadas.map((pieza, i): NodoArchivo => {
    const ultima = pieza.versiones[pieza.versiones.length - 1].archivo;
    const suya = identidades[i];
    const estado = estados[suya];
    const corren = plazoQueCorre(propios[suya], heredado.dias, undefined);
    const propio = suya in responsables ? responsables[suya] : undefined;
    const quien = responsableQueCorre(propio, heredado.responsable, undefined);

    const suyos = pieza.versiones.map((v) => v.archivo.id);

    return {
      id: suya,
      nombre: pieza.titulo,
      // Si alguna vuelta está escondida, la pieza se muestra como escondida:
      // mitad visible y mitad no es un estado que nadie quiso.
      visible: !suyos.some((a) => escondidos.has(a)),
      archivos: suyos,
      enlaceDrive: ultima.webViewLink,
      modificado: ultima.modifiedTime,
      estado: estado.estado,
      vueltas: pieza.versiones.length,
      mudada: estado.mudada,
      publicaEl: dias[suya],
      dias: propios[suya],
      diasQueCorren: corren,
      vence: ultima.modifiedTime
        ? diaDe(calcularVencimiento(new Date(ultima.modifiedTime), corren))
        : undefined,
      responsable: propio,
      responsableQueCorre: quien,
      responsableA: quien
        ? (nombres.get(quien) ?? nombreDelHeredado)
        : null,
    };
  });
}
