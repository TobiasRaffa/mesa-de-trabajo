// Fechas y plazos.
//
// Todo se guarda en horario universal y se muestra en hora de Buenos Aires.
// Guardar en hora local sería cómodo hoy y un problema el día que alguien
// trabaje desde otro país, o que Argentina vuelva a mover los relojes.
//
// Los plazos son en días corridos, no hábiles: es más simple de explicar del
// lado del cliente, y no hay que mantener un calendario de feriados.

const ZONA = "America/Argentina/Buenos_Aires";

const DIA_EN_MS = 24 * 60 * 60 * 1000;

/** Cuándo vence una entrega enviada en `enviada` con `dias` corridos de plazo. */
export function calcularVencimiento(enviada: Date, dias: number): Date {
  return new Date(enviada.getTime() + dias * DIA_EN_MS);
}

/**
 * Cuándo sale el primer aviso: a la mitad del plazo, no al final.
 *
 * Con cuatro días cae al segundo; con diez, al quinto. Siempre la mitad, así
 * el margen para reaccionar es proporcional a lo que se pactó.
 */
export function calcularAviso(enviada: Date, dias: number): Date {
  return new Date(enviada.getTime() + (dias / 2) * DIA_EN_MS);
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

/**
 * El comienzo de hoy en Buenos Aires, como instante.
 *
 * **El servidor no está en Buenos Aires.** En la máquina de desarrollo sí, y
 * ahí `new Date(año, mes, día)` daba la medianoche correcta. En internet el
 * servidor vive en tiempo universal: la misma cuenta daba las nueve de la
 * noche del día anterior, y una entrega que vencía «hoy» aparecía vencida
 * tres horas antes de tiempo. Todo lo que compare con «hoy» sale de acá.
 */
export function medianocheDeHoy(ahora = new Date()): Date {
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const buscar = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  // Argentina no cambia de hora: la medianoche de Buenos Aires son las tres
  // de la madrugada universales, siempre.
  return new Date(Date.UTC(buscar("year"), buscar("month") - 1, buscar("day"), 3));
}

/** El día —`AAAA-MM-DD`— que es en Buenos Aires en ese momento. */
export function diaEnBuenosAires(momento: Date): string {
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(momento);
  const de = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${de("year")}-${de("month")}-${de("day")}`;
}

/** El comienzo del día, en Buenos Aires, del momento que se le pase. */
function mediaNocheLocal(momento: Date): Date {
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(momento);

  const buscar = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  return new Date(Date.UTC(buscar("year"), buscar("month") - 1, buscar("day")));
}

export type EstadoPlazo =
  | { situacion: "sin_enviar" }
  | { situacion: "vence_hoy" }
  | { situacion: "por_vencer"; dias: number }
  | { situacion: "vencido"; dias: number };

/** En qué situación está el plazo de una entrega. */
export function situacionDelPlazo(vence: Date | null, ahora = new Date()): EstadoPlazo {
  if (!vence) return { situacion: "sin_enviar" };

  const dias = diasDeDiferencia(ahora, vence);
  if (dias === 0) return { situacion: "vence_hoy" };
  if (dias > 0) return { situacion: "por_vencer", dias };
  return { situacion: "vencido", dias: -dias };
}

/**
 * El plazo en palabras, para mostrarlo al pie y en chico.
 *
 * Se escribe corto a propósito: es un dato de referencia, no una advertencia.
 */
export function plazoEnPalabras(vence: Date | null, ahora = new Date()): string {
  const estado = situacionDelPlazo(vence, ahora);

  switch (estado.situacion) {
    case "sin_enviar":
      return "sin entregar";
    case "vence_hoy":
      return "vence hoy";
    case "por_vencer":
      return estado.dias === 1 ? "vence mañana" : `vence en ${estado.dias} días`;
    case "vencido":
      return estado.dias === 1 ? "venció ayer" : `venció hace ${estado.dias} días`;
  }
}

/** Una fecha como la escribiría una persona: «14 de marzo». */
export function fechaLarga(momento: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    day: "numeric",
    month: "long",
  }).format(momento);
}

/** Una fecha corta para tablas y listas: «14/3». */
export function fechaCorta(momento: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    day: "numeric",
    month: "numeric",
  }).format(momento);
}

/**
 * Hace cuánto pasó algo, como lo diría una persona: «hace 5 min», «hace 3 h»,
 * «ayer», «hace 4 días». Más de un mes, la fecha.
 */
export function haceCuanto(iso: string, ahora = new Date()): string {
  const momento = new Date(iso);
  if (Number.isNaN(momento.getTime())) return "";

  const minutos = Math.max(0, Math.round((ahora.getTime() - momento.getTime()) / 60_000));
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = diasDeDiferencia(momento, ahora);
  if (dias <= 1) return "ayer";
  if (dias < 31) return `hace ${dias} días`;
  return `el ${fechaCorta(momento)}`;
}
