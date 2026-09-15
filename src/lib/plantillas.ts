// Mensajes escritos de antemano, para copiar y mandar.
//
// La aplicación **no le escribe al cliente**: esa regla no se toca. Lo que hace
// es dejar el mensaje escrito para que una persona lo lea, lo cambie si quiere,
// lo copie y lo mande por donde ya le escribe siempre.
//
// La diferencia importa. Un mensaje automático es la aplicación hablando; esto
// es un papelito con lo que suele decirse, para no escribirlo de cero cada vez
// a las siete de la tarde. Quien manda decide qué dice y cuándo.
//
// Están redactados para WhatsApp: cortos, en castellano rioplatense, sin
// «estimado cliente» ni firma corporativa.

export type Plantilla = {
  id: string;
  titulo: string;
  cuando: string;
  texto: (datos: Datos) => string;
};

export type Datos = {
  cliente: string;
  carpeta: string;
  link: string;
  /** Cuántas piezas quedan sin revisar, si viene al caso. */
  pendientes?: number;
  /** Cuántos días tiene para revisar, si viene al caso. */
  dias?: number;
};

/**
 * El aviso de que un trabajo se entregó.
 *
 * Vive aparte de la lista porque no se elige de un menú: sale solo, al
 * terminar de entregar, que es el único momento en que hace falta. Buscarlo
 * entre seis plantillas justo después de apretar el botón es el paso que se
 * saltea, y entonces el cliente no se entera de que tiene algo esperándolo.
 */
export function mensajeDeEntrega({ carpeta, link, dias }: Datos): string {
  const plazo =
    dias === undefined
      ? ""
      : ` Tenés ${dias} ${dias === 1 ? "día" : "días"} para revisarlo.`;
  return (
    `Hola! Te entregamos ${carpeta}.${plazo}\n${link}\n\n` +
    `Entrás con la clave que te pasamos. Cualquier cosa me escribís.`
  );
}

/**
 * El número, como lo quiere un link de WhatsApp: solo dígitos.
 *
 * La gente escribe «+54 9 11 5555-5555», y wa.me quiere «5491155555555». Se
 * limpia acá y no al guardar: lo que la agencia escribió queda como lo
 * escribió, que es lo que va a reconocer cuando lo mire.
 *
 * Devuelve `null` si no queda un número que valga: un link roto a WhatsApp es
 * peor que no ofrecerlo, porque se descubre recién del otro lado.
 */
export function linkDeWhatsApp(telefono: string, texto: string): string | null {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length < 8) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

export const PLANTILLAS: Plantilla[] = [
  {
    id: "entrega",
    titulo: "Avisar que hay algo para revisar",
    cuando: "Cuando subiste archivos nuevos",
    texto: ({ carpeta, link }) =>
      `Hola! Ya subimos ${carpeta}. Podés verlo y dejarnos los cambios acá:\n${link}\n\n` +
      `Entrás con la clave que te pasamos. Cualquier cosa me escribís.`,
  },
  {
    id: "recordatorio",
    titulo: "Recordar que falta revisar",
    cuando: "Cuando pasaron unos días y no entró",
    texto: ({ carpeta, link, pendientes }) =>
      `Hola! ¿Pudiste ver ${carpeta}?` +
      (pendientes ? ` Quedan ${pendientes} sin revisar.` : "") +
      `\n${link}\n\nSi necesitás más tiempo avisame y lo corremos, no hay drama.`,
  },
  {
    id: "vencido",
    titulo: "Avisar que se pasó la fecha",
    cuando: "Cuando venció el plazo y todavía falta",
    texto: ({ carpeta, link }) =>
      `Hola! Se nos pasó la fecha que teníamos para ${carpeta} y todavía falta ` +
      `tu ok. ¿Lo vemos hoy o lo corremos para la semana que viene?\n${link}`,
  },
  {
    id: "recibido",
    titulo: "Confirmar que recibimos los cambios",
    cuando: "Cuando el cliente mandó la revisión",
    texto: ({ carpeta }) =>
      `Recibido, gracias! Ya estamos con los cambios de ${carpeta}. ` +
      `Te aviso apenas esté la vuelta nueva.`,
  },
  {
    id: "listo",
    titulo: "Avisar que quedó todo aprobado",
    cuando: "Cuando se aprobó todo",
    texto: ({ carpeta }) =>
      `Listo, ${carpeta} quedó aprobado entero. Los archivos finales te quedan ` +
      `en la carpeta «Entregas finales» de Drive.`,
  },
  {
    id: "clave",
    titulo: "Pasar el link y la clave",
    cuando: "Cuando le das acceso por primera vez",
    texto: ({ cliente, link }) =>
      `Hola! Te dejo el acceso al portal de ${cliente}, donde vas a ver todo lo ` +
      `que te vamos entregando y nos podés dejar los cambios:\n${link}\n\n` +
      `La clave te la mando aparte.`,
  },
];
