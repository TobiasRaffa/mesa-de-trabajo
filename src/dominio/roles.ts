// Qué parte de la gestión ve cada uno.
//
// **La aplicación de gestión dejó de ser una sola cosa.** Hasta acá, quien
// entraba veía todo: el tablero, los archivos de todos los clientes, las
// conversaciones, las facturas y las claves con las que entran los clientes.
// Para tres personas que comparten oficina eso alcanzaba; en cuanto se suma
// alguien que viene a hacer una parte —facturar, o diseñar y nada más—, «todo»
// es demasiado.
//
// Está acá y no en `lib/` por la razón de siempre: la barra lateral corre en el
// navegador y necesita saber qué secciones mostrar. Este archivo no importa
// nada, así que puede leerlo cualquiera de los dos lados.
//
// **Dos ideas, y la segunda es la que hace que esto se pueda usar:**
//
//   1. El **rol** es un molde vivo, no una copia. Cambiar qué ve «Diseño»
//      cambia lo que ven todas las diseñadoras, hoy. Si al dar de alta se
//      copiaran las secciones a la ficha de la persona, cada cambio habría que
//      repetirlo persona por persona, y la que se olvide queda con el molde
//      viejo para siempre.
//   2. Además del rol, a una persona se le pueden dar secciones **sueltas**.
//      Sin esto, cada excepción —«esta diseñadora también mira las facturas»—
//      obliga a inventar un rol nuevo, y los roles terminan siendo uno por
//      persona, que es no tener roles.
//
// Lo que ve alguien es, entonces, **las de su rol más las sueltas**. Nunca
// menos: no hay forma de quitarle a alguien una sección que su rol le da. Para
// eso se le cambia el rol, que es la decisión que de verdad se está tomando.

/**
 * Las partes en que está dividida la gestión.
 *
 * El orden **importa**: es el de la barra lateral y, sobre todo, el que decide
 * a dónde cae alguien al entrar —la primera de esta lista que pueda ver—.
 */
export const SECCIONES = [
  "tablero",
  "clientes",
  "conversaciones",
  "notificaciones",
  "facturas",
  "admin",
  "diagnostico",
] as const;

export type Seccion = (typeof SECCIONES)[number];

/** Cómo se llama cada una donde se la lee. */
export const NOMBRE_DE_SECCION: Record<Seccion, string> = {
  tablero: "Tablero",
  clientes: "Clientes",
  conversaciones: "Conversaciones",
  notificaciones: "Notificaciones",
  facturas: "Facturas",
  admin: "Admin",
  diagnostico: "Diagnóstico",
};

/**
 * En una línea, qué se hace en cada una.
 *
 * Es para la pantalla donde se reparte el acceso: «Clientes» no dice que ahí
 * adentro están los archivos de todo el mundo, y quien está tildando casillas
 * tiene que saber qué está entregando.
 */
export const QUE_HAY_EN: Record<Seccion, string> = {
  tablero: "Lo que está en juego hoy, de todos los clientes.",
  clientes: "Las carpetas y los archivos de cada cliente, y lo que se les entrega.",
  conversaciones: "Los chats con los clientes.",
  notificaciones: "Los avisos de lo que fue pasando.",
  facturas: "Lo que se cobra.",
  admin: "El equipo, los roles y las claves con las que entran los clientes.",
  diagnostico: "El estado de la conexión con Drive.",
};

export const ROLES = ["admin", "diseno", "facturacion", "personalizado"] as const;

export type Rol = (typeof ROLES)[number];

export const NOMBRE_DE_ROL: Record<Rol, string> = {
  admin: "Administración",
  diseno: "Diseño",
  facturacion: "Facturación",
  personalizado: "Personalizado",
};

/**
 * El rol que no es un molde: **cada sección se elige para esa persona**.
 *
 * Los otros tres son moldes compartidos —cambiar «Diseño» cambia a todas las
 * diseñadoras—. Este no da nada por sí mismo: lo que ve la persona son sus
 * secciones sueltas, tildadas una por una en su ficha y guardadas ahí. Así una
 * persona con un recorte raro no obliga a inventar un molde nuevo, y lo que se
 * le da a una no se le aparece a otra.
 */
export const ROL_PERSONALIZADO: Rol = "personalizado";

/**
 * Qué le da cada rol.
 *
 * **`admin` tiene todo, y eso incluye repartir esto mismo.** Es el único que
 * entra a «Admin», que es donde se da de alta gente y se cambian los roles: si
 * cualquiera pudiera entrar ahí, los roles no separarían nada, porque el primer
 * paso de cualquiera sería darse el rol que quiera.
 */
const DEL_ROL: Record<Rol, readonly Seccion[]> = {
  admin: SECCIONES,
  // El trabajo de todos los días. No ve las facturas ni reparte accesos.
  diseno: ["tablero", "clientes", "conversaciones", "notificaciones"],
  // Lo que se cobra, y nada más. Para lo demás están las sueltas: es
  // justamente el caso para el que existen.
  facturacion: ["facturas"],
  // Nada de entrada: todo lo que ve sale de sus sueltas.
  personalizado: [],
};

/**
 * El rol de quien fue cargado antes de que los roles existieran.
 *
 * **Administración, y es a propósito.** Las personas que ya estaban cargadas se
 * cargaron cuando entrar quería decir ver todo; bajarles el acceso en silencio,
 * mientras nadie mira, se parece demasiado a un error —«no me deja entrar a
 * Admin y ayer entraba»— y, peor, podría dejar la aplicación sin nadie que
 * pueda repartir roles. Se ve y se cambia en Admin, que es donde corresponde.
 */
export const ROL_DE_ANTES: Rol = "admin";

export const esRol = (v: unknown): v is Rol => ROLES.includes(v as Rol);

export const esSeccion = (v: unknown): v is Seccion => SECCIONES.includes(v as Seccion);

/**
 * Qué ve alguien: las de su rol más las sueltas.
 *
 * Sale siempre en el orden de `SECCIONES` y sin repetidas, venga como venga lo
 * que está guardado. Quien la llama la usa para dibujar un menú y para decidir
 * a dónde mandar a alguien, y las dos cosas se descosen si el orden depende de
 * en qué orden se tildaron las casillas hace tres meses.
 */
export function seccionesDe(rol: Rol, sueltas: readonly Seccion[] = []): Seccion[] {
  const suyas = new Set<Seccion>([...DEL_ROL[rol], ...sueltas]);
  return SECCIONES.filter((s) => suyas.has(s));
}

/** Si una sección ya viene con el rol: tildarla aparte no agregaría nada. */
export const laDaElRol = (rol: Rol, seccion: Seccion): boolean =>
  DEL_ROL[rol].includes(seccion);

// ---------------------------------------------------------------------------
// Qué clientes, además de qué secciones

/**
 * A qué clientes llega alguien.
 *
 * **Los roles separan secciones; esto separa clientes.** Son dos cosas
 * distintas y hacen falta las dos: quien entra a «Clientes» ve las carpetas y
 * los archivos de todos, y en una agencia con varias cuentas eso es demasiado
 * —no por desconfianza, sino porque abrir el árbol y encontrar ocho clientes
 * cuando llevás uno es ruido todos los días—.
 *
 * `"todos"` no es lo mismo que la lista de todos los clientes de hoy: quiere
 * decir **los que haya**, incluidos los que se den de alta mañana. Una lista
 * dejaría afuera a los nuevos sin que nadie se entere.
 */
export type Alcance = "todos" | string[];

export const alcanzaA = (alcance: Alcance, clienteId: string): boolean =>
  alcance === "todos" || alcance.includes(clienteId);

/** De una lista de clientes, los que le tocan. */
export const recortaA = <T extends { id: string }>(alcance: Alcance, cuales: T[]): T[] =>
  alcance === "todos" ? cuales : cuales.filter((c) => alcance.includes(c.id));

/** Si el alcance guardado tiene forma de alcance. */
export const esAlcance = (v: unknown): v is Alcance =>
  v === "todos" || (Array.isArray(v) && v.every((x) => typeof x === "string"));

/**
 * Por dónde empieza cada sección.
 *
 * `clientes` es `/gestion` a secas porque la lista de clientes **es** la
 * pantalla de inicio de la gestión, y las fichas cuelgan de `/gestion/cliente`.
 */
export const RUTA_DE: Record<Seccion, string> = {
  tablero: "/gestion/tablero",
  clientes: "/gestion",
  conversaciones: "/gestion/chats",
  notificaciones: "/gestion/notificaciones",
  facturas: "/gestion/facturas",
  admin: "/gestion/admin",
  diagnostico: "/diagnostico",
};

/**
 * Qué cuelga de qué sección.
 *
 * **`/gestion` a secas no está en esta lista, y esa ausencia es la que hace
 * que esto cierre.** Es prefijo de todas las demás direcciones: puesta acá,
 * cualquier pantalla que nadie clasificó caería adentro de «Clientes» y se
 * abriría para medio equipo sin que nadie lo decidiera. Se resuelve aparte y
 * por igualdad exacta.
 *
 * Está separada de `RUTA_DE` —que dice por dónde *empieza* cada sección— y hay
 * una prueba que verifica que las dos digan lo mismo, porque el día que se
 * despeguen la puerta manda a alguien a una pantalla que la puerta misma no le
 * deja abrir, y eso es un ida y vuelta infinito.
 */
const POR_RUTA: ReadonlyArray<readonly [string, Seccion]> = [
  ["/gestion/tablero", "tablero"],
  // La ficha de un cliente: estando adentro, la sección sigue siendo «Clientes».
  ["/gestion/cliente", "clientes"],
  ["/gestion/chats", "conversaciones"],
  ["/gestion/notificaciones", "notificaciones"],
  ["/gestion/facturas", "facturas"],
  ["/gestion/admin", "admin"],
  ["/diagnostico", "diagnostico"],
];

/**
 * De qué sección es una dirección.
 *
 * **Contesta `null` cuando no la reconoce, y eso no es un descuido: es la
 * respuesta segura.** Quien pregunta —la puerta— trata el `null` como «acá no
 * entra nadie». Así, una pantalla nueva que nadie se acordó de clasificar
 * queda cerrada para todos en vez de abierta para todos, que es la forma en la
 * que estas cosas fallan. Y hay un guardián que verifica que toda pantalla de
 * gestión esté clasificada, así que el error se ve en las pruebas y no cuando
 * alguien no puede trabajar.
 */
export function seccionDeLaRuta(ruta: string): Seccion | null {
  const limpia = ruta.length > 1 && ruta.endsWith("/") ? ruta.slice(0, -1) : ruta;

  if (limpia === "/gestion") return "clientes";

  for (const [prefijo, seccion] of POR_RUTA) {
    if (limpia === prefijo || limpia.startsWith(`${prefijo}/`)) return seccion;
  }
  return null;
}

/**
 * A dónde cae alguien al entrar: la primera sección que puede ver.
 *
 * No siempre es `/gestion`. Quien solo factura no tiene nada que hacer en la
 * lista de clientes, y mandarlo ahí sería recibirlo con una pared.
 */
export function dondeEmpieza(secciones: readonly Seccion[]): string | null {
  const primera = SECCIONES.find((s) => secciones.includes(s));
  return primera ? RUTA_DE[primera] : null;
}
