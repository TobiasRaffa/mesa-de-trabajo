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

import { esCarpetaReservada } from "@/lib/ajustes";
import { losAvisos, type Aviso } from "@/lib/avisos";
import { clientesHabilitados } from "@/lib/clientes";
import { sinLeerPorCliente } from "@/lib/conversaciones";
import { correoConfigurado } from "@/lib/correo";
import { personaPorId } from "@/lib/equipo";
import { responsableDe, responsableQueCorre } from "@/lib/responsables";
import { subcarpetasDe } from "@/lib/google";
import { piezasDeLaCarpeta, estadosDe } from "@/lib/piezas";
import { calcularVencimiento } from "@/lib/fechas";
import { plazoDe, plazosDe, plazoQueCorre } from "@/lib/plazos";
import { agruparVersiones, identidadDePieza } from "@/lib/versiones";
import { sigueEnJuego } from "@/dominio/pieza";

/**
 * De quién es el próximo movimiento.
 *
 * Es la pregunta que la agencia se hace mirando el tablero: **¿esto lo tengo
 * que mover yo, o estoy esperando al cliente?** El estado de cada pieza ya lo
 * dice, pero repartido en cinco nombres; esto los junta en la única distinción
 * que cambia lo que alguien hace a continuación.
 *
 * Cuando hay de las dos, manda la agencia: si algo espera trabajo nuestro, la
 * carpeta está en nuestra cancha aunque además falte que el cliente mire otra
 * pieza.
 */
export type Cancha = "agencia" | "cliente" | "listo";

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
  /** Cuántas hay en total, terminadas incluidas. */
  piezas: number;
  /**
   * Las que todavía están en juego.
   *
   * **Lo aprobado o no es de cada pieza, no del trabajo.** Un trabajo con dos
   * piezas —una aprobada y otra esperando— no tiene «2 piezas» pendientes:
   * tiene una. Contarlas juntas hacía que una pieza terminada siguiera pesando
   * en un trabajo que figura como «lo tiene el cliente», y eso es justo lo que
   * el tablero no tiene que hacer: hablar de trabajo que ya no existe.
   */
  enJuego: number;
  sinRevisar: number;
  /** Ya no están en juego: aprobadas —en «Entregas finales»— o canceladas. */
  terminadas: number;
  /** Mensajes del cliente que nadie leyó. */
  sinLeer: number;
  /** Piezas que esperan trabajo de la agencia. */
  enAgencia: number;
  /** De esas, las que solo esperan que alguien apriete «Entregar». */
  sinEntregar: number;
  /** De quién es el próximo movimiento. */
  cancha: Cancha;
  /** Los días de revisión que corren acá, ya heredados. */
  diasQueCorren: number;
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
              piezasDeLaCarpeta(carpeta.id),
              plazoDe(carpeta.id),
              responsableDe(carpeta.id),
            ]);

            const agrupadas = agruparVersiones(archivos);
            const identidades = agrupadas.map((p) =>
              identidadDePieza(carpeta.id, p.versiones[0].archivo.name)
            );
            const [estados, propios] = await Promise.all([
              estadosDe(carpeta.id, identidades),
              plazosDe(identidades),
            ]);

            const piezas = Object.values(estados);

            // Lo que espera al cliente: se la entregamos y todavía no decidió.
            const sinRevisar = piezas.filter(
              (p) => p.estado === "entregada" || p.estado === "en_revision"
            ).length;

            // Lo que espera a la agencia: el cliente ya habló y falta hacerlo.
            // «extra_pedida» también es nuestra: el cliente pidió una revisión
            // adicional y está esperando que alguien la habilite.
            const enAgencia = piezas.filter(
              (p) =>
                p.estado === "en_curso" ||
                p.estado === "extra_pedida" ||
                (p.estado === "cambios_marcados" && p.enviada)
            ).length;

            // Lo que está en Drive y todavía no se entregó. Es un subconjunto
            // de lo anterior —también es nuestro— pero se cuenta aparte porque
            // lo que hay que hacer con esto es apretar un botón, no diseñar.
            const sinEntregar = piezas.filter((p) => p.estado === "en_curso").length;

            // Lo que ya no está en juego. Sigue existiendo —nada se borra— pero
            // no es trabajo pendiente de nadie.
            const terminadas = piezas.filter((p) => !sigueEnJuego(p.estado)).length;

            const cancha: Cancha =
              enAgencia > 0 ? "agencia" : sinRevisar > 0 ? "cliente" : "listo";


            // **El reloj arranca cuando se entrega, no cuando se sube.**
            // Salía de la fecha de modificación del archivo, con dos
            // consecuencias: subías el jueves y avisabas el lunes, y al
            // cliente ya se le habían ido cuatro de sus tres días; y volver a
            // guardar el archivo en Drive corría el vencimiento solo.
            //
            // Una pieza sin entregar no vence: todavía no empezó a correr.
            const fechas = identidades
              .map((suya) => {
                const entregada = estados[suya]?.entregadaEl;
                if (!entregada) return null;
                const dias = plazoQueCorre(
                  propios[suya],
                  diasDeLaCarpeta,
                  diasDelCliente
                );
                return calcularVencimiento(new Date(entregada), dias);
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
              cancha,
              diasQueCorren: plazoQueCorre(undefined, diasDeLaCarpeta, diasDelCliente),
              enAgencia,
              sinEntregar,
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
              enJuego: piezas.length - terminadas,
              sinRevisar,
              terminadas,
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
