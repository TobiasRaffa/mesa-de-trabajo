// Fechas y plazos.
//
// Todo se guarda en horario universal y se muestra en hora de Buenos Aires.
// Guardar en hora local sería cómodo hoy y un problema el día que alguien
// trabaje desde otro país, o que Argentina vuelva a mover los relojes.
//
// Los plazos son en días corridos, no hábiles: es más simple de explicar del
// lado del cliente, y no hay que mantener un calendario de feriados.

// La cuenta de días vive en el dominio: la necesita también `pieza.ts`, que no
// puede importar de acá. Se reexporta lo que ya se usaba con este nombre para
// que nadie tenga que cambiar de puerta.
import {
  DIA_EN_MS,
  diaEnBuenosAires,
  diasDeDiferencia,
  enPalabrasConAnio,
  enPalabrasElDiaDe,
} from "@/dominio/tiempo";

export {
  diaEnBuenosAires,
  diasDeDiferencia,
  medianocheDeHoy,
  ZONA,
} from "@/dominio/tiempo";

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

/**
 * Hace cuánto pasó algo, como lo diría una persona: «hace 5 min», «hace 3 h»,
 * «ayer», «hace 4 días». Más de un mes, la fecha.
 */
export function haceCuanto(iso: string, ahora = new Date()): string {
  const momento = new Date(iso);
  if (Number.isNaN(momento.getTime())) return "";

  // **Truncando, no redondeando.** Con `Math.round`, veintitrés horas y media
  // daban «24 h», la rama de horas no las agarraba y algo escrito hoy a las
  // doce y media de la noche, leído hoy a las once de la noche, decía «ayer».
  const minutos = Math.max(0, Math.floor((ahora.getTime() - momento.getTime()) / 60_000));
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = diasDeDiferencia(momento, ahora);
  if (dias <= 1) return "ayer";
  if (dias < 31) return `hace ${dias} días`;
  // **De otro año, con el año.** Sin él, algo de hace once meses y medio se
  // leía como una fecha de este año —y a veces de la semana que viene—, justo
  // en el dato que dice si un cliente dejó de mirar el portal. El año se toma
  // en Buenos Aires, como el resto de las cuentas de días.
  const mismoAnio =
    diaEnBuenosAires(momento).slice(0, 4) === diaEnBuenosAires(ahora).slice(0, 4);
  return `el ${mismoAnio ? enPalabrasElDiaDe(momento) : enPalabrasConAnio(momento)}`;
}
