// El calendario de la agencia: en qué día cae un instante y cuántos días hay
// entre dos.
//
// **Está en el dominio porque es una regla del negocio, no una utilidad.** Todo
// lo que esta aplicación cuenta en días —el plazo que tiene el cliente para
// revisar, los días que algo lleva quieto de nuestro lado, hace cuánto se
// escribió un mensaje— se cuenta en **días de calendario de Buenos Aires**, no
// en bloques de veinticuatro horas. No son lo mismo y la diferencia se ve todos
// los días: algo que volvió el viernes a las seis de la tarde y se mira el
// domingo al mediodía lleva «un día» por reloj y **dos** por calendario. El
// número que una persona usa para decidir si algo está quieto hace mucho es el
// segundo.
//
// Esta cuenta vivía solo en `lib/fechas.ts`, que el dominio no puede importar,
// así que `pieza.ts` la había reescrito a mano dividiendo por veinticuatro
// horas: el semáforo del tablero se prendía hasta un día tarde. Puesta acá la
// leen los dos lados, y hay una sola definición de qué es «un día».

/** Argentina no cambia de hora, pero eso se dice acá una sola vez. */
export const ZONA = "America/Argentina/Buenos_Aires";

export const DIA_EN_MS = 24 * 60 * 60 * 1000;

const PARTES_DEL_DIA = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El día —`AAAA-MM-DD`— que es en Buenos Aires en ese momento. */
export function diaEnBuenosAires(momento: Date): string {
  const partes = PARTES_DEL_DIA.formatToParts(momento);
  const de = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${de("year")}-${de("month")}-${de("day")}`;
}

/** El comienzo del día, en Buenos Aires, del momento que se le pase. */
export function mediaNocheLocal(momento: Date): Date {
  const partes = PARTES_DEL_DIA.formatToParts(momento);
  const buscar = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  return new Date(Date.UTC(buscar("year"), buscar("month") - 1, buscar("day")));
}

/**
 * El comienzo de hoy en Buenos Aires, como instante.
 *
 * **El servidor no está en Buenos Aires.** En la máquina de desarrollo sí, y
 * ahí `new Date(año, mes, día)` daba la medianoche correcta. En internet el
 * servidor vive en tiempo universal: la misma cuenta daba las nueve de la
 * noche del día anterior, y una entrega que vencía «hoy» aparecía vencida tres
 * horas antes de tiempo. Todo lo que compare con «hoy» sale de acá.
 */
export function medianocheDeHoy(ahora = new Date()): Date {
  const partes = PARTES_DEL_DIA.formatToParts(ahora);
  const buscar = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  // La medianoche de Buenos Aires son las tres de la madrugada universales.
  return new Date(Date.UTC(buscar("year"), buscar("month") - 1, buscar("day"), 3));
}

/**
 * Días entre dos momentos, contando días de calendario y no de veinticuatro
 * horas.
 *
 * Importa: si algo vence mañana a las 9 y son las 23 de hoy, para una persona
 * queda «un día», no «diez horas». Contar en horas daría cero y diría «vence
 * hoy», que es engañoso.
 */
export function diasDeDiferencia(desde: Date, hasta: Date): number {
  const a = mediaNocheLocal(desde);
  const b = mediaNocheLocal(hasta);
  return Math.round((b.getTime() - a.getTime()) / DIA_EN_MS);
}

// ---------------------------------------------------------------------------
// Cómo se escribe una fecha
//
// **Los cinco formatos que usa la aplicación viven acá y en ningún otro lado.**
// Estaban copiados en nueve archivos —el árbol, el tablero, los chats, las
// facturas, el calendario, la conversación, el portal— y el precio no fue la
// repetición: fue que **ninguna de las copias fijaba la zona horaria**. Un
// `Intl.DateTimeFormat` sin zona usa la del servidor, y el servidor en internet
// corre en tiempo universal: cada hora que la aplicación mostraba estaba **tres
// horas adelantada**. Un mensaje de las ocho y media de la noche decía 23:30.
//
// Es el mismo cuidado que ya tenía la aritmética de arriba, que nunca se aplicó
// del lado de mostrar. Acá se aplica una vez.

const CON_ZONA = { timeZone: ZONA } as const;

const SOLO_DIA = new Intl.DateTimeFormat("es-AR", {
  ...CON_ZONA,
  day: "numeric",
  month: "short",
});

const CON_HORA = new Intl.DateTimeFormat("es-AR", {
  ...CON_ZONA,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const SOLO_HORA = new Intl.DateTimeFormat("es-AR", {
  ...CON_ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const CON_ANIO = new Intl.DateTimeFormat("es-AR", {
  ...CON_ZONA,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const EL_MES = new Intl.DateTimeFormat("es-AR", { ...CON_ZONA, month: "long", year: "numeric" });

const DIA_LARGO = new Intl.DateTimeFormat("es-AR", {
  ...CON_ZONA,
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Un instante, o el texto vacío si no es una fecha. */
const alFormatear = (con: Intl.DateTimeFormat, cuando: Date | string): string => {
  const f = cuando instanceof Date ? cuando : new Date(cuando);
  return Number.isNaN(f.getTime()) ? "" : con.format(f);
};

/** «17 sept». Para un instante: el día que fue en Buenos Aires. */
export const enPalabrasElDiaDe = (cuando: Date | string): string =>
  alFormatear(SOLO_DIA, cuando);

/** «14:30». Cuando el día ya lo dice un separador arriba. */
export const enPalabrasSoloLaHora = (cuando: Date | string): string =>
  alFormatear(SOLO_HORA, cuando);

/** «17 sept, 14:30». La hora es la de Buenos Aires, mire desde donde mire. */
export const enPalabrasLaFecha = (cuando: Date | string): string =>
  alFormatear(CON_HORA, cuando);

/** «17 sept 2026». Para lo que se archiva y se busca por año. */
export const enPalabrasConAnio = (cuando: Date | string): string =>
  alFormatear(CON_ANIO, cuando);

/** «septiembre 2026». El encabezado de un calendario. */
export const enPalabrasElMes = (cuando: Date | string): string =>
  alFormatear(EL_MES, cuando);

/** «martes 17 de septiembre». El separador entre días de una conversación. */
export const enPalabrasElDiaLargo = (cuando: Date | string): string =>
  alFormatear(DIA_LARGO, cuando);

/**
 * Un día suelto, de los que se guardan «2026-09-17», escrito «17 sept».
 *
 * **Se arma al mediodía universal y no a la medianoche.** Con `new Date(a, m-1,
 * d)` el instante es la medianoche del servidor, que en internet es la
 * medianoche universal: formateado en hora de Buenos Aires eso son las nueve de
 * la noche del **día anterior**, y un vencimiento se corría un día para atrás.
 * Al mediodía no hay zona horaria del mundo que cambie de día.
 */
export function enPalabrasElDia(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  if (!a || !m || !d) return dia;
  return SOLO_DIA.format(new Date(Date.UTC(a, m - 1, d, 12)));
}
