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
};

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
