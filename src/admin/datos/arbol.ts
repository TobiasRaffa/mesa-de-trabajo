// El contenido de un cliente, nivel por nivel.
//
// La pantalla de clientes es un árbol que se abre: cliente, sus carpetas, los
// archivos de cada una. Cada nivel se pide **cuando se abre** y no antes: leer
// de Drive todos los archivos de todos los clientes para dibujar una lista que
// arranca cerrada sería pagar por adelantado algo que casi nunca se mira.

import { ajustesDe, esCarpetaReservada } from "@/lib/ajustesDeCarpeta";
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
import { agruparVersiones } from "@/lib/versiones";
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
  /** `Entregas finales` no es un trabajo: no se configura. */
  reservada: boolean;
};

export type NodoArchivo = {
  id: string;
  nombre: string;
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

export async function carpetasDeCliente(clienteId: string): Promise<NodoCarpeta[]> {
  const [carpetas, diasDelCliente, deQuienEsElCliente] = await Promise.all([
    subcarpetasDe(clienteId),
    plazoDe(clienteId),
    responsableDe(clienteId),
  ]);

  const ids = carpetas.map((c) => c.id);
  const [propios, responsables] = await Promise.all([plazosDe(ids), responsablesDe(ids)]);

  return Promise.all(
    carpetas.map(async (carpeta): Promise<NodoCarpeta> => {
      const reservada = esCarpetaReservada(carpeta.name);
      const ajustes = await ajustesDe(carpeta.id);
      const quien = responsableQueCorre(
        undefined,
        carpeta.id in responsables ? responsables[carpeta.id] : undefined,
        deQuienEsElCliente
      );
      const persona = await personaPorId(quien ?? undefined);

      const base = {
        id: carpeta.id,
        nombre: carpeta.name,
        enlaceDrive: carpeta.webViewLink,
        visible: ajustes.visible,
        vista: ajustes.vista,
        token: ajustes.token,
        responsable: carpeta.id in responsables ? responsables[carpeta.id] : undefined,
        responsableQueCorre: quien,
        responsableA: persona?.nombre ?? null,
        dias: propios[carpeta.id],
        diasQueCorren: plazoQueCorre(undefined, propios[carpeta.id], diasDelCliente),
        reservada,
      };

      // De una carpeta reservada no se cuenta nada: no se revisa.
      if (reservada) return { ...base, piezas: 0, sinRevisar: 0 };

      const agrupadas = agruparVersiones(await piezasDeLaCarpeta(carpeta.id));
      const ultimas = agrupadas.map((p) => p.versiones[p.versiones.length - 1].archivo.id);
      const estados = await estadosDe(carpeta.id, ultimas);

      return {
        ...base,
        piezas: agrupadas.length,
        sinRevisar: Object.values(estados).filter(
          (p) => p.estado === "entregada" || p.estado === "en_revision"
        ).length,
      };
    })
  );
}

export async function archivosDeCarpeta(
  carpetaId: string,
  /** Lo que hereda esta carpeta. Los archivos parten de acá. */
  heredado: { dias: number; responsable: string | null }
): Promise<NodoArchivo[]> {
  const agrupadas = agruparVersiones(await piezasDeLaCarpeta(carpetaId));
  const ultimas = agrupadas.map((p) => p.versiones[p.versiones.length - 1].archivo.id);

  const [estados, dias, propios, responsables] = await Promise.all([
    estadosDe(carpetaId, ultimas),
    publicacionesDe(ultimas),
    plazosDe(ultimas),
    responsablesDe(ultimas),
  ]);

  const nombres = new Map<string, string | null>();
  for (const id of new Set(Object.values(responsables))) {
    if (id) nombres.set(id, (await personaPorId(id))?.nombre ?? null);
  }
  const nombreDelHeredado = heredado.responsable
    ? ((await personaPorId(heredado.responsable))?.nombre ?? null)
    : null;

  return agrupadas.map((pieza): NodoArchivo => {
    const ultima = pieza.versiones[pieza.versiones.length - 1].archivo;
    const estado = estados[ultima.id];
    const corren = plazoQueCorre(propios[ultima.id], heredado.dias, undefined);
    const propio = ultima.id in responsables ? responsables[ultima.id] : undefined;
    const quien = responsableQueCorre(propio, heredado.responsable, undefined);

    return {
      id: ultima.id,
      nombre: pieza.titulo,
      enlaceDrive: ultima.webViewLink,
      modificado: ultima.modifiedTime,
      estado: estado.estado,
      vueltas: pieza.versiones.length,
      mudada: estado.mudada,
      publicaEl: dias[ultima.id],
      dias: propios[ultima.id],
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
