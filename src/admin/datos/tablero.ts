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

import { ajustesDe, esCarpetaReservada } from "@/lib/ajustes";
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
import { agruparVersiones, conSusArchivos } from "@/lib/versiones";
import { hayAlgoParaEntregar, sigueEnJuego } from "@/dominio/pieza";

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
 *
 * **«Sin entregar» se separó de «lo tenemos nosotros».** Las dos son nuestras,
 * pero no piden lo mismo: una pide diseñar y la otra pide apretar un botón.
 * Mezcladas, lo que está listo y sin mandar se perdía entre lo que todavía hay
 * que hacer, que es la peor forma de perderlo: el cliente espera algo que ya
 * está hecho. Manda «sin entregar» cuando hay de las dos, porque es lo que se
 * resuelve en un clic.
 */
export type Cancha = "sin_entregar" | "agencia" | "cliente" | "listo";

export type CarpetaEnElTablero = {
  clienteId: string;
  cliente: string;
  carpetaId: string;
  carpeta: string;
  asignadaA: string | null;
  /**
   * Quién lo lleva, por identificador.
   *
   * Hace falta además del nombre porque la ventana del tablero vuelve a pedir
   * la carpeta, y lo que se hereda hacia cada pieza es el identificador. Sin
   * esto la ventana pedía con la herencia en blanco y cada pieza decía «sin
   * asignar» al lado de una carpeta que tiene dueño.
   */
  responsableQueCorre: string | null;
  /** Cuándo vence la revisión de esta carpeta. */
  vence: Date | null;
  /** Está vencida y todavía falta que el cliente decida. */
  vencida: boolean;
  /**
   * Le quedan dos días o menos, y todavía falta que el cliente decida.
   *
   * **Dos días y no un porcentaje del plazo.** Con plazos de 3 a 30 días, un
   * porcentaje da avisos de un día en uno y de una semana en el otro; «te
   * quedan dos días» quiere decir lo mismo siempre y se entiende sin pensar.
   *
   * Solo cuenta si hay algo esperando al cliente: un plazo que corre sobre una
   * carpeta donde no queda nada por decidir no es un problema de nadie.
   */
  porVencer: boolean;
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
  /** Si el cliente ve esta carpeta en su portal. */
  visible: boolean;
  /**
   * Cuántas carpetas tiene adentro.
   *
   * Hace falta para distinguir una carpeta **vacía** de una que guarda su
   * trabajo un nivel más abajo. El tablero solo mira los archivos sueltos de
   * cada carpeta de trabajo, así que las dos dan cero piezas y se parecen; la
   * primera no tiene nada que hacer y la segunda sí.
   */
  subcarpetas: number;
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
            const [archivos, diasDeLaCarpeta, deQuienEsLaCarpeta, ajustes, adentro] =
              await Promise.all([
                piezasDeLaCarpeta(carpeta.id),
                plazoDe(carpeta.id),
                responsableDe(carpeta.id),
                ajustesDe(carpeta.id),
                subcarpetasDe(carpeta.id).catch(() => []),
              ]);

            const agrupadas = agruparVersiones(archivos);
            const conArchivos = conSusArchivos(carpeta.id, agrupadas);
            const identidades = conArchivos.map((p) => p.id);
            const [estados, propios] = await Promise.all([
              estadosDe(carpeta.id, conArchivos),
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
            // **No alcanza con estar de nuestro lado.** Una pieza que el
            // cliente devolvió con cambios vuelve a `en_curso`, y ofrecerla
            // para entregar ahí le manda el mismo archivo que acaba de
            // devolver. Falta la vuelta nueva.
            const sinEntregar = conArchivos.filter(({ id, archivos }) =>
              hayAlgoParaEntregar(estados[id].estado, estados[id].ronda, archivos.length)
            ).length;

            // Lo que ya no está en juego. Sigue existiendo —nada se borra— pero
            // no es trabajo pendiente de nadie.
            const terminadas = piezas.filter((p) => !sigueEnJuego(p.estado)).length;

            // Una carpeta **vacía** no está aprobada: no hay nada que aprobar.
            // Caía en «Aprobado» porque no esperaba nada de nadie, y con ese
            // título puesto se leía como un trabajo terminado. Lo que le falta
            // es que alguien suba algo, así que es nuestra.
            const vacia = piezas.length === 0;

            const cancha: Cancha =
              sinEntregar > 0
                ? "sin_entregar"
                : enAgencia > 0 || vacia
                  ? "agencia"
                  : sinRevisar > 0
                    ? "cliente"
                    : "listo";


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
              responsableQueCorre: quien ?? null,
              vence,
              // Vencida solo cuenta si todavía falta que el cliente decida:
              // una carpeta terminada con fecha vieja no es un problema.
              vencida: Boolean(vence && vence < hoyALaMedianoche() && sinRevisar > 0),
              porVencer: Boolean(
                vence &&
                  vence >= hoyALaMedianoche() &&
                  vence <= enDias(2) &&
                  sinRevisar > 0
              ),
              piezas: piezas.length,
              enJuego: piezas.length - terminadas,
              sinRevisar,
              terminadas,
              sinLeer: sinLeer[cliente.id] ?? 0,
              visible: ajustes.visible,
              subcarpetas: adentro.length,
            };
          })
      );
    })
  );

  return {
    avisos: avisos.slice(0, 30),
    sinVer: avisos.filter((a) => !a.visto).length,
    // **Una carpeta vacía no va al tablero.** Estaba y no decía nada: ni
    // trabajo pendiente ni trabajo hecho, un renglón que hay que leer para
    // descubrir que no hay nada. Sigue estando en la ficha del cliente, que es
    // donde se la configura o se le sube algo.
    //
    // Vacía de verdad: sin piezas **y** sin carpetas adentro. Una que guarda
    // su trabajo un nivel más abajo también da cero piezas, y esconderla sería
    // esconder trabajo.
    carpetas: porCliente.flat().filter((c) => c.piezas > 0 || c.subcarpetas > 0),
    correoConfigurado: correoConfigurado(),
  };
}

/**
 * Hoy a las 00:00.
 *
 * Se compara contra la medianoche y no contra el instante: una entrega que
 * vence «hoy» no está vencida a las nueve de la mañana.
 */
/** La medianoche de dentro de tantos días. */
function enDias(cuantos: number): Date {
  const d = hoyALaMedianoche();
  d.setDate(d.getDate() + cuantos);
  return d;
}

function hoyALaMedianoche(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}
