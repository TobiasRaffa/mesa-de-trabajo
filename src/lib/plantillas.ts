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
  const numero = numeroParaWhatsApp(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/**
 * Lleva el número a la forma internacional, suponiendo Argentina.
 *
 * **Sacar lo que no es dígito no alcanza.** «11 5555-5555» quedaba en
 * «1155555555», y wa.me lo lee como un +1: un número de Estados Unidos, que
 * puede ser de cualquiera. Lo mismo con el 0 de larga distancia, el 00
 * internacional y el 15 del celular, que es como la gente tiene agendados los
 * números.
 *
 * Un celular argentino en WhatsApp es 54, 9, la característica y el número:
 * diez dígitos entre las dos, y sin el 15. Lo que no llega a eso da `null`.
 * Sin característica —«15 5555-5555»— no hay cómo saber de dónde es, y
 * suponer Buenos Aires es mandarle el mensaje a otro.
 */
function numeroParaWhatsApp(telefono: string): string | null {
  const internacional = /^\s*(\+|00)/.test(telefono);
  let digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);

  let nacional: string;
  if (digitos.startsWith("54")) {
    // Ninguna característica argentina empieza con 5: un 54 adelante es
    // siempre el código de país, se haya escrito con + o no.
    nacional = digitos.slice(2);
    // El 9 del celular, si vino.
    if (nacional.startsWith("9") && (nacional.length === 11 || nacional.length === 13)) {
      nacional = nacional.slice(1);
    }
  } else if (internacional) {
    // Otro país, escrito a propósito con su código: se respeta como está.
    return /^[1-9]\d{7,14}$/.test(digitos) ? digitos : null;
  } else {
    nacional = digitos;
  }

  // El 0 de larga distancia, que en la forma internacional no va.
  if (nacional.startsWith("0")) nacional = nacional.slice(1);

  // Con el 15 son doce dígitos. Va justo después de la característica, que es
  // de dos (el 11), tres o cuatro. Como ninguna característica es el comienzo
  // de otra, el primer «15» que aparece en esos lugares es el del celular.
  if (nacional.length === 12) {
    const donde = nacional.startsWith("11") ? 2 : nacional.slice(3, 5) === "15" ? 3 : 4;
    if (nacional.slice(donde, donde + 2) !== "15") return null;
    nacional = nacional.slice(0, donde) + nacional.slice(donde + 2);
  }

  // Las características argentinas empiezan con 11, 2 o 3.
  return /^(11|[23]\d)\d{8}$/.test(nacional) ? `549${nacional}` : null;
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
