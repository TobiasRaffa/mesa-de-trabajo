// Lo que pasó desde la última vez que miraste.
//
// Es la pantalla que reemplaza el «¿alguien sabe cómo viene lo de Café Otoño?»
// de los lunes. Contesta tres preguntas, en este orden, porque es el orden en
// que importan:
//
//   1. **¿Qué hizo el cliente?** Aprobó, devolvió, escribió.
//   2. **¿Dónde se me pasó la fecha?**
//   3. **¿Qué está esperando en mi cancha?**
//
// Todo sale de datos que ya existen: no hay un estado nuevo que mantener.

import { esCarpetaReservada } from "@/lib/ajustesDeCarpeta";
import { losAvisos, type Aviso } from "@/lib/avisos";
import { clientesHabilitados } from "@/lib/clientes";
import { sinLeerPorCliente } from "@/lib/conversaciones";
import { correoConfigurado } from "@/lib/correo";
import { personaPorId } from "@/lib/equipo";
import { responsableDe, responsableQueCorre } from "@/lib/responsables";
import { subcarpetasDe } from "@/lib/google";
import { archivosConLasMudadas, estadosDe } from "@/lib/piezas";
import { calcularVencimiento } from "@/lib/fechas";
import { plazoDe, plazosDe, plazoQueCorre } from "@/lib/plazos";
import { agruparVersiones } from "@/lib/versiones";

export type CarpetaEnElTablero = {
  clienteId: string;
  cliente: string;
  carpetaId: string;
  carpeta: string;
  asignadaA: string | null;
  /** Cuándo vence la revisión de esta carpeta. */
  vence: Date | null;
  /** Está vencida y todavía falta que el cliente decida. */
  vencida: boolean;
  piezas: number;
  sinRevisar: number;
  aprobadas: number;
  conCambios: number;
  /** Mensajes del cliente que nadie leyó. */
  sinLeer: number;
};

export type Tablero = {
  avisos: Aviso[];
  sinVer: number;
  carpetas: CarpetaEnElTablero[];
  correoConfigurado: boolean;
};

export async function elTablero(): Promise<Tablero> {
  const [avisos, clientes] = await Promise.all([losAvisos(), clientesHabilitados()]);

  const sinLeer = await sinLeerPorCliente("agencia");

  const porCliente = await Promise.all(
    clientes.map(async (cliente) => {
      const [carpetas, diasDelCliente, deQuienEsElCliente] = await Promise.all([
        subcarpetasDe(cliente.id),
        plazoDe(cliente.id),
        responsableDe(cliente.id),
      ]);

      return Promise.all(
        carpetas
          .filter((c) => !esCarpetaReservada(c.name))
          .map(async (carpeta): Promise<CarpetaEnElTablero> => {
            const [archivos, diasDeLaCarpeta, deQuienEsLaCarpeta] = await Promise.all([
              archivosConLasMudadas(carpeta.id),
              plazoDe(carpeta.id),
              responsableDe(carpeta.id),
            ]);

            const agrupadas = agruparVersiones(archivos);
            const ultimas = agrupadas.map(
              (p) => p.versiones[p.versiones.length - 1].archivo.id
            );
            const [estados, propios] = await Promise.all([
              estadosDe(carpeta.id, ultimas),
              plazosDe(ultimas),
            ]);

            const piezas = Object.values(estados);
            const sinRevisar = piezas.filter(
              (p) => p.estado === "entregada" || p.estado === "en_revision"
            ).length;

            // Cada pieza vence el día que se subió más sus días. La carpeta
            // vence cuando vence la primera: es la fecha que hay que mirar.
            const fechas = agrupadas
              .map((pieza) => {
                const ultima = pieza.versiones[pieza.versiones.length - 1].archivo;
                if (!ultima.modifiedTime) return null;
                const dias = plazoQueCorre(
                  propios[ultima.id],
                  diasDeLaCarpeta,
                  diasDelCliente
                );
                return calcularVencimiento(new Date(ultima.modifiedTime), dias);
              })
              .filter((f): f is Date => f !== null);

            const vence =
              fechas.length > 0
                ? new Date(Math.min(...fechas.map((f) => f.getTime())))
                : null;

            const quien = responsableQueCorre(
              undefined,
              deQuienEsLaCarpeta,
              deQuienEsElCliente
            );
            const persona = await personaPorId(quien ?? undefined);

            return {
              clienteId: cliente.id,
              cliente: cliente.nombre,
              carpetaId: carpeta.id,
              carpeta: carpeta.name,
              asignadaA: persona?.nombre ?? null,
              vence,
              // Vencida solo cuenta si todavía falta que el cliente decida:
              // una carpeta terminada con fecha vieja no es un problema.
              vencida: Boolean(vence && vence < hoyALaMedianoche() && sinRevisar > 0),
              piezas: piezas.length,
              sinRevisar,
              aprobadas: piezas.filter((p) => p.estado === "final").length,
              conCambios: piezas.filter((p) => p.estado === "cambios_marcados").length,
              sinLeer: sinLeer[cliente.id] ?? 0,
            };
          })
      );
    })
  );

  return {
    avisos: avisos.slice(0, 30),
    sinVer: avisos.filter((a) => !a.visto).length,
    carpetas: porCliente.flat(),
    correoConfigurado: correoConfigurado(),
  };
}

/**
 * Hoy a las 00:00.
 *
 * Se compara contra la medianoche y no contra el instante: una entrega que
 * vence «hoy» no está vencida a las nueve de la mañana.
 */
function hoyALaMedianoche(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}
