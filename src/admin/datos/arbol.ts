// El contenido de un cliente, nivel por nivel.
//
// La pantalla de clientes es un árbol que se abre: cliente, sus carpetas, los
// archivos de cada una. Cada nivel se pide **cuando se abre** y no antes: leer
// de Drive todos los archivos de todos los clientes para dibujar una lista que
// arranca cerrada sería pagar por adelantado algo que casi nunca se mira.

import { ajustesDe, esCarpetaReservada } from "@/lib/ajustesDeCarpeta";
import { personaPorId } from "@/lib/equipo";
import { subcarpetasDe } from "@/lib/google";
import { archivosConLasMudadas, estadosDe } from "@/lib/piezas";
import { plazoDe, plazosDe, plazoQueCorre } from "@/lib/plazos";
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
  asignada?: string;
  asignadaA: string | null;
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
};

export async function carpetasDeCliente(clienteId: string): Promise<NodoCarpeta[]> {
  const [carpetas, diasDelCliente] = await Promise.all([
    subcarpetasDe(clienteId),
    plazoDe(clienteId),
  ]);

  const propios = await plazosDe(carpetas.map((c) => c.id));

  return Promise.all(
    carpetas.map(async (carpeta): Promise<NodoCarpeta> => {
      const reservada = esCarpetaReservada(carpeta.name);
      const ajustes = await ajustesDe(carpeta.id);
      const persona = await personaPorId(ajustes.asignada);

      const base = {
        id: carpeta.id,
        nombre: carpeta.name,
        enlaceDrive: carpeta.webViewLink,
        visible: ajustes.visible,
        vista: ajustes.vista,
        token: ajustes.token,
        asignada: ajustes.asignada,
        asignadaA: persona?.nombre ?? null,
        dias: propios[carpeta.id],
        diasQueCorren: plazoQueCorre(undefined, propios[carpeta.id], diasDelCliente),
        reservada,
      };

      // De una carpeta reservada no se cuenta nada: no se revisa.
      if (reservada) return { ...base, piezas: 0, sinRevisar: 0 };

      const agrupadas = agruparVersiones(await archivosConLasMudadas(carpeta.id));
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
  /** Los días que hereda esta carpeta. Los archivos parten de acá. */
  diasDeLaCarpeta: number
): Promise<NodoArchivo[]> {
  const agrupadas = agruparVersiones(await archivosConLasMudadas(carpetaId));
  const ultimas = agrupadas.map((p) => p.versiones[p.versiones.length - 1].archivo.id);

  const [estados, dias, propios] = await Promise.all([
    estadosDe(carpetaId, ultimas),
    publicacionesDe(ultimas),
    plazosDe(ultimas),
  ]);

  return agrupadas.map((pieza): NodoArchivo => {
    const ultima = pieza.versiones[pieza.versiones.length - 1].archivo;
    const estado = estados[ultima.id];
    const corren = plazoQueCorre(propios[ultima.id], diasDeLaCarpeta, undefined);

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
    };
  });
}
