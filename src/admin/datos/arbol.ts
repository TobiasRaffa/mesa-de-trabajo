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

import {
  ajustesDeVarias,
  esCarpetaDeFacturas,
  esCarpetaReservada,
  escondidosEntre,
} from "@/lib/ajustes";
import { nombresDelEquipo } from "@/lib/equipo";
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
import { agruparVersiones, conSusArchivos, rarezasDeNombres, type RarezasDeNombres } from "@/lib/versiones";
import {
  esperaAlCliente,
  hayAlgoParaEntregar,
  sigueEnJuego,
  type Estado,
} from "@/dominio/pieza";

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
  /** Cuántas hay en total, terminadas incluidas. */
  piezas: number;
  /**
   * Las que todavía están en juego.
   *
   * **El estado es de cada pieza, no de la carpeta.** Una carpeta con una
   * pieza aprobada y otra esperando no tiene dos cosas pendientes: tiene una.
   */
  enJuego: number;
  sinRevisar: number;
  /** Aprobadas —ya en «Entregas finales»— o canceladas. */
  terminadas: number;
  /** Están en Drive y el cliente todavía no las ve. */
  sinEntregar: number;
  /** Cuántas carpetas tiene adentro. Una carpeta puede no tener archivos. */
  subcarpetas: number;
  /** `Entregas finales` y `Facturas`: no son trabajos, no se revisan. */
  reservada: boolean;
  /**
   * De las dos reservadas, esta es «Facturas».
   *
   * Hace falta distinguirlas porque se tratan distinto: «Entregas finales» es
   * del cliente y se puede mostrar o esconder como cualquier otra cosa;
   * «Facturas» es de la agencia y no se le muestra nunca, así que no tiene
   * sentido ofrecer un interruptor que no hace nada.
   *
   * Viene del servidor y no se calcula acá porque quién es «Facturas» lo
   * decide `lib/ajustes`, y es lo único que sabe comparar el nombre igual que
   * lo hacen los permisos.
   */
  deFacturas: boolean;
};

export type NodoArchivo = {
  id: string;
  /** El nombre de la pieza: sin la marca de versión ni la extensión. */
  nombre: string;
  /**
   * Cómo se llama de verdad el archivo de la última vuelta, en Drive.
   *
   * **Es el que hay que buscar en Drive**, y no siempre se parece al de
   * arriba: la pieza se llama «stickers» y el archivo puede ser
   * «V2_stickers.pdf». Quien mira la pantalla y después abre Drive necesita el
   * segundo; quien mira dos vueltas de lo mismo necesita el primero. Están los
   * dos porque son dos preguntas.
   */
  nombreCompleto: string;
  /**
   * Cada vuelta de la pieza, con el nombre que tiene en Drive.
   *
   * **Es la única forma de ver qué agrupó la aplicación.** Una pieza se arma
   * juntando archivos por su nombre sin la marca de versión, y hasta ahora lo
   * único que se veía era el resultado: «v2». Cuáles dos, no. Y ahí es donde
   * pasa el error que no se puede diagnosticar: subir «V3_stickers.jpeg»
   * cuando las anteriores eran «.pdf» arma una pieza nueva —la extensión
   * cuenta— y la pantalla sigue mostrando la vieja sin decir por qué.
   *
   * Ordenadas por número de vuelta, igual que se agrupan.
   */
  versiones: Array<{ id: string; nombre: string; numero: number }>;
  /**
   * La última que se subió no es la vuelta más alta.
   *
   * **Es el error que no se nota.** Alguien sube «V3_stickers.jpeg» sobre una
   * pieza que ya tenía una V4: el archivo queda guardado, pero la vuelta que
   * se muestra y se entrega sigue siendo la V4, así que desde afuera parece
   * que no pasó nada. Sin decirlo, el que subió se entera tres días después
   * -o no se entera-.
   *
   * La aplicación **no lo corrige sola**: el número del nombre es lo que
   * manda, y cambiarlo por «el último que llegó» haría que dos personas
   * subiendo el mismo día se pisen sin darse cuenta. Lo dice, y lo arregla
   * una persona renombrando.
   */
  vueltaAtrasada?: { subida: string; actual: string };
  /**
   * Hay otro trabajo en esta carpeta que se llama igual, en otro formato.
   *
   * Casi siempre es un renombre que partió un trabajo en dos, y la
   * consecuencia se ve del lado del cliente: puede quedar mirando un archivo
   * distinto del que estaba revisando, sin que nadie se entere.
   */
  comparteNombre?: boolean;
  /** Dos archivos de esta pieza dicen ser la misma vuelta. */
  vueltaRepetida?: RarezasDeNombres["repetida"];
  /** Los números de vuelta saltan de una forma que conviene mirar. */
  saltoDeVuelta?: RarezasDeNombres["salto"];
  /**
   * El archivo que se le entregó al cliente ya no es parte de esta pieza, y el
   * cliente todavía está revisando.
   *
   * Se renombró, se movió o se borró en Drive. El portal no puede mostrarle
   * lo que se le entregó y le muestra la vuelta anterior que quede, así que
   * lo que tiene delante ya no es lo que se le mandó.
   */
  entregadoPerdido?: boolean;
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
  /** Cuántos archivos tiene: el original más cada vuelta nueva. */
  vueltas: number;
  /**
   * En qué vuelta va, según el número escrito en el nombre del archivo más alto.
   *
   * **No es lo mismo que `vueltas` y confundirlos se veía en pantalla.** Una
   * pieza con «V1», «V2», «V4» y «V6» tiene cuatro archivos y va por la vuelta
   * **seis**: el renglón mostraba `vueltas` con una «v» adelante, así que al
   * lado de un archivo llamado «V6_stickers.jpeg» decía «v4». Los números que
   * el equipo escribe en Drive no siempre son seguidos —se saltean, se
   * renombran— y el que importa es el que está escrito en el archivo.
   */
  version: number;
  /** El número de vuelta que se le entregó al cliente, si se le entregó alguno. */
  versionEntregada?: number;
  /**
   * En qué vuelta va la pieza. 0 es la primera, antes de cualquier cambio.
   *
   * Hace falta afuera para una sola pregunta, y es importante: **¿hay algo
   * nuevo para entregar?** Una pieza que el cliente devolvió con cambios está
   * de nuestro lado pero no tiene nada nuevo adentro hasta que aparezca la
   * versión siguiente.
   */
  ronda: number;
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
  /** Cuándo se le entregó al cliente, si se le entregó. ISO. */
  entregadaEl?: string;
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
  // **Las cuatro preguntas, una vez cada una.** Los ajustes y el nombre de
  // quien lleva cada carpeta se pedían **adentro** del `map`, o sea un
  // documento por carpeta: en Supabase, dos viajes de red por renglón para
  // dibujar una lista. Los plazos y los responsables ya se pedían así.
  const [propios, responsables, ajustesDeTodas, nombres] = await Promise.all([
    plazosDe(ids),
    responsablesDe(ids),
    ajustesDeVarias(ids),
    nombresDelEquipo(),
  ]);

  return Promise.all(
    carpetas.map(async (carpeta): Promise<NodoCarpeta> => {
      const reservada = esCarpetaReservada(carpeta.name);
      const ajustes = ajustesDeTodas[carpeta.id];
      const propio = carpeta.id in responsables ? responsables[carpeta.id] : undefined;
      const quien = responsableQueCorre(propio, heredado.responsable, undefined);
      const nombreDeQuien = quien ? (nombres.get(quien) ?? null) : null;

      const base = {
        id: carpeta.id,
        nombre: carpeta.name,
        enlaceDrive: carpeta.webViewLink,
        visible: ajustes.visible,
        vista: ajustes.vista,
        token: ajustes.token,
        responsable: propio,
        responsableQueCorre: quien,
        responsableA: nombreDeQuien,
        dias: propios[carpeta.id],
        diasQueCorren: plazoQueCorre(propios[carpeta.id], heredado.dias, undefined),
        reservada,
        deFacturas: esCarpetaDeFacturas(carpeta.name),
      };

      // Cuántas carpetas tiene adentro se pregunta siempre: una carpeta sin
      // archivos pero con subcarpetas no está vacía, y decir «0 piezas» a
      // secas invitaría a pensar que sí.
      const adentro = await subcarpetasDe(carpeta.id).catch(() => []);

      // De una carpeta reservada no se cuenta nada: no se revisa.
      if (reservada) {
        return {
          ...base,
          piezas: 0,
          enJuego: 0,
          sinRevisar: 0,
          terminadas: 0,
          sinEntregar: 0,
          subcarpetas: adentro.length,
        };
      }

      const agrupadas = agruparVersiones(await piezasDeLaCarpeta(carpeta.id));
      const suyasConArchivos = conSusArchivos(carpeta.id, agrupadas);
      const estados = await estadosDe(carpeta.id, suyasConArchivos);

      const suyas = Object.values(estados);
      const terminadas = suyas.filter((p) => !sigueEnJuego(p.estado)).length;

      return {
        ...base,
        piezas: agrupadas.length,
        enJuego: agrupadas.length - terminadas,
        // Con el cliente, incluidos los cambios que escribió y no mandó: ver
        // `esperaAlCliente`.
        sinRevisar: suyas.filter(esperaAlCliente).length,
        terminadas,
        sinEntregar: suyasConArchivos.filter(({ id, version }) =>
          hayAlgoParaEntregar(estados[id].estado, version, estados[id].versionEntregada)
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
  const conArchivos = conSusArchivos(carpetaId, agrupadas);
  const identidades = conArchivos.map((p) => p.id);

  // `estadosDe` primero: si una pieza cambió de nombre, ahí se muda su ficha
  // junto con la fecha, el plazo y el responsable propios. Leídos en paralelo,
  // esta pantalla los mostraría perdidos hasta la próxima vez.
  const estados = await estadosDe(carpetaId, conArchivos);
  const [dias, propios, responsables, escondidos] = await Promise.all([
    publicacionesDe(identidades),
    plazosDe(identidades),
    responsablesDe(identidades),
    escondidosEntre(agrupadas.flatMap((p) => p.versiones.map((v) => v.archivo.id))),
  ]);

  // El equipo entero de una sola lectura, en vez de un documento por persona
  // distinta que aparezca en la lista.
  const delEquipo = await nombresDelEquipo();
  const nombres = new Map<string, string | null>(
    [...new Set(Object.values(responsables))]
      .filter((id): id is string => Boolean(id))
      .map((id) => [id, delEquipo.get(id) ?? null])
  );
  const nombreDelHeredado = heredado.responsable
    ? (delEquipo.get(heredado.responsable) ?? null)
    : null;

  return agrupadas.map((pieza, i): NodoArchivo => {
    const ultima = pieza.versiones[pieza.versiones.length - 1].archivo;
    const suya = identidades[i];
    const estado = estados[suya];
    const corren = plazoQueCorre(propios[suya], heredado.dias, undefined);
    const propio = suya in responsables ? responsables[suya] : undefined;
    const quien = responsableQueCorre(propio, heredado.responsable, undefined);

    const suyos = pieza.versiones.map((v) => v.archivo.id);
    const rarezas = rarezasDeNombres(pieza.versiones);

    // Cuál se tocó al final en Drive. Si no es la vuelta más alta, alguien
    // subió con un número que ya estaba superado.
    const conFecha = pieza.versiones.filter((v) => v.archivo.modifiedTime);
    const ultimaTocada = conFecha.reduce<(typeof conFecha)[number] | null>(
      (mas, v) =>
        !mas || (v.archivo.modifiedTime ?? "") > (mas.archivo.modifiedTime ?? "") ? v : mas,
      null
    );

    return {
      id: suya,
      nombre: pieza.titulo,
      nombreCompleto: ultima.name,
      versiones: pieza.versiones.map((v) => ({
        id: v.archivo.id,
        nombre: v.archivo.name,
        numero: v.numero,
      })),
      vueltaAtrasada:
        ultimaTocada && ultimaTocada.archivo.id !== ultima.id
          ? { subida: ultimaTocada.archivo.name, actual: ultima.name }
          : undefined,
      comparteNombre: pieza.comparteNombre || undefined,
      vueltaRepetida: rarezas.repetida,
      saltoDeVuelta: rarezas.salto,
      entregadoPerdido:
        Boolean(estado.archivoEntregado) &&
        esperaAlCliente(estado) &&
        !suyos.includes(estado.archivoEntregado!)
          ? true
          : undefined,
      // Si alguna vuelta está escondida, la pieza se muestra como escondida:
      // mitad visible y mitad no es un estado que nadie quiso.
      visible: !suyos.some((a) => escondidos.has(a)),
      archivos: suyos,
      enlaceDrive: ultima.webViewLink,
      modificado: ultima.modifiedTime,
      estado: estado.estado,
      /** Qué vuelta se le entregó, para saber si hay algo nuevo que mandarle. */
      versionEntregada: estado.versionEntregada,
      entregadaEl: estado.entregadaEl,
      vueltas: pieza.versiones.length,
      version: conArchivos[i].version,
      ronda: estado.ronda,
      mudada: estado.mudada,
      publicaEl: dias[suya],
      dias: propios[suya],
      diasQueCorren: corren,
      // Sin entregar no hay vencimiento: el reloj todavía no arrancó.
      vence: estado.entregadaEl
        ? diaDe(calcularVencimiento(new Date(estado.entregadaEl), corren))
        : undefined,
      responsable: propio,
      responsableQueCorre: quien,
      responsableA: quien
        ? (nombres.get(quien) ?? nombreDelHeredado)
        : null,
    };
  });
}
