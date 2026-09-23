// Los avisos: qué pasó, a quién le importa, y si se le pudo decir.
//
// Es el bucle que este proyecto vino a cerrar. El cliente aprueba o devuelve
// algo, y hasta hoy nadie se enteraba salvo que entrara a mirar. Ahora queda
// anotado y, si hay correo configurado, sale por correo.
//
// **Se anota siempre, se manda si se puede.** Son dos cosas separadas a
// propósito: que el correo no esté configurado —o que el servidor de correo se
// caiga— no puede hacer que el aviso se pierda. Queda en la bandeja de gestión
// igual, y ahí se ve.
//
// Nada de esto le escribe al cliente. Los avisos van **hacia adentro**, al
// equipo. Lo que sale hacia el cliente lo escribe una persona.

import { randomUUID } from "node:crypto";
import { coleccion } from "@/lib/almacen";

export type ClaseDeAviso =
  /** La agencia entregó una tanda. Es el único que va hacia el cliente. */
  | "entregamos"
  | "aprobo"
  | "pidio_cambios"
  /** Se le acabaron las vueltas incluidas y pide una más. Espera una decisión. */
  | "pidio_extra"
  | "envio_revision"
  | "escribio"
  /** Pasó la mitad del plazo y el cliente todavía no decidió. Lo manda el calendario. */
  | "por_vencer"
  /** Se cumplió el plazo y todavía falta revisar. Lo manda el calendario. */
  | "vencio";

export type Aviso = {
  id: string;
  clase: ClaseDeAviso;
  cuando: string;
  cliente: string;
  clienteId: string;
  carpeta: string;
  carpetaId: string;
  /** Una línea, ya escrita para leer. */
  texto: string;
  /**
   * A quiénes les tocaba: quien lo lleva, más quienes reciben todo.
   *
   * Son varios porque el trabajo puede estar repartido: dos personas con
   * subcarpetas distintas del mismo cliente reciben cada una lo suyo, y quien
   * lleva la agencia recibe las dos cosas.
   */
  paraQuienes?: string[];
  /** Cómo se guardaba antes, cuando era uno solo. Se sigue leyendo. */
  paraQuien?: string;
  /** Si salió por correo, y si no, por qué. */
  correo: "sin_configurar" | "enviado" | "fallo" | "sin_destinatario";
  detalleDelCorreo?: string;
  /**
   * Quiénes ya lo miraron, por id de persona.
   *
   * **Era un solo booleano para todo el equipo, y eso es una campana
   * compartida.** Nari abría la bandeja a la mañana y a Tomás se le vaciaba la
   * suya: los avisos quedaban marcados como vistos para todos, así que él no
   * volvía a enterarse de nada que hubiera pasado antes de que ella mirara.
   * Un aviso puede ser para varios —quien lleva la carpeta y quien recibe
   * todo—, así que «visto» es una respuesta por persona, no por aviso.
   */
  vistoPor?: string[];
  /**
   * Cómo se guardaba antes, cuando era uno solo para todos.
   *
   * Se sigue leyendo como «lo vio todo el mundo»: el día del cambio, lo que ya
   * estaba marcado no puede volver a aparecer como nuevo para nadie, que sería
   * reventarle la bandeja a todos de una vez.
   */
  visto: boolean;
  /**
   * Cuántas veces pasó lo mismo seguido, cuando el aviso junta varias.
   *
   * Sin esto es una. Lo llevan los mensajes: cuatro seguidos del cliente son
   * un aviso que dice «cuatro», no cuatro renglones iguales.
   */
  veces?: number;
  /**
   * Qué piezas junta, cuando junta varias de la misma carpeta.
   *
   * **Revisar una carpeta es una sesión, no ocho novedades.** Aprobar ocho
   * piezas escribía ocho renglones y mandaba ocho correos, mientras que
   * mandar la revisión de esas mismas ocho —que es un solo toque del
   * cliente— mandaba uno. Se guardan los nombres y no solo la cuenta porque
   * lo que se hace después depende de cuáles son.
   */
  piezas?: string[];
};

/**
 * Un aviso, ya respondida la única pregunta que cambia de persona a persona.
 *
 * **`visto` no puede ser del aviso, tiene que ser de quien lo mira.** Era un
 * solo booleano compartido: quien abriera la bandeja primero se la vaciaba al
 * resto del equipo. Lo arma `misAvisos`, que es quien sabe quién está mirando.
 */
export type AvisoMio = Aviso & { loVi: boolean };

/** Si esta persona ya lo miró. */
export function loVio(aviso: Aviso, personaId: string | null): boolean {
  if (aviso.visto) return true;
  return personaId !== null && (aviso.vistoPor?.includes(personaId) ?? false);
}

/** Si no lo miró nadie todavía. */
export const noLoVioNadie = (aviso: Aviso): boolean =>
  !aviso.visto && (aviso.vistoPor?.length ?? 0) === 0;

/** Cuántos se guardan. Más viejo que esto es historia, y esa vive en la pieza. */
const TOPE = 500;

function esAviso(v: unknown): v is Aviso {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return typeof a.id === "string" && typeof a.cuando === "string";
}

const almacen = coleccion<Aviso>("avisos", esAviso);

export async function losAvisos(): Promise<Aviso[]> {
  // Lo más nuevo primero. Se ordena al leer y no al guardar: el almacén guarda
  // documentos sueltos, y el orden es una decisión de esta pantalla.
  return Object.values(await almacen.todo()).sort((a, b) =>
    b.cuando.localeCompare(a.cuando)
  );
}

export async function anotarAviso(
  aviso: Omit<Aviso, "id" | "cuando" | "visto" | "vistoPor">
): Promise<Aviso> {
  const nuevo: Aviso = {
    ...aviso,
    id: randomUUID(),
    cuando: new Date().toISOString(),
    visto: false,
    vistoPor: [],
  };

  const todos = await losAvisos();
  // La bandeja es para enterarse, no un archivo histórico: lo que pasa el tope
  // se va en la misma escritura que entra lo nuevo.
  const sobran = todos.slice(TOPE - 1).map((a) => a.id);
  const cambios: Record<string, Aviso | undefined> = { [nuevo.id]: nuevo };
  for (const id of sobran) cambios[id] = undefined;

  await almacen.guardarVarios(cambios);
  return nuevo;
}

/**
 * Cuánto tiempo seguido cuenta como «la misma vez». Cinco minutos: lo que
 * tarda alguien en escribir una idea en cuatro mensajes.
 */
export const VENTANA_DE_RACHA = 5 * 60 * 1000;

/**
 * ¿Este aviso es la continuación de aquel?
 *
 * **Cuatro mensajes seguidos del cliente son una sola novedad.** Uno por
 * mensaje llenaba la bandeja de renglones iguales —«Escribió en la
 * conversación» cuatro veces— y hacía que el número de sin leer dijera cuatro
 * cuando lo que había era una persona escribiendo.
 *
 * Se suma al anterior cuando es de la misma clase, del mismo cliente, llegó
 * dentro de la ventana **y no lo vio nadie todavía**. Visto por alguien, lo
 * nuevo es nuevo: si alguien miró la bandeja entre un mensaje y el otro, el
 * segundo tiene que volver a avisar.
 */
export function continuaA(
  anterior: Pick<Aviso, "clase" | "clienteId" | "cuando" | "visto" | "vistoPor"> & {
    carpetaId?: string;
  },
  nuevo: { clase: ClaseDeAviso; clienteId: string; carpetaId?: string },
  ahora: Date,
  ventana = VENTANA_DE_RACHA
): boolean {
  if (!noLoVioNadie(anterior as Aviso)) return false;
  if (anterior.clase !== nuevo.clase || anterior.clienteId !== nuevo.clienteId) return false;
  // **Y de la misma carpeta.** Sin esto, aprobar una pieza de «Banners» y otra
  // de «Stories» dentro de los cinco minutos se juntaban en un aviso que
  // nombraba una sola de las dos carpetas.
  if (nuevo.carpetaId !== undefined && anterior.carpetaId !== nuevo.carpetaId) return false;
  const desde = new Date(anterior.cuando).getTime();
  if (Number.isNaN(desde)) return false;
  const pasaron = ahora.getTime() - desde;
  return pasaron >= 0 && pasaron <= ventana;
}

/**
 * El aviso más nuevo al que se sumaría uno de esta clase y cliente, si hay.
 *
 * Solo tiene sentido para lo que se repite —mensajes—: una aprobación y otra
 * son dos cosas distintas aunque vengan seguidas, y quien llama decide.
 */
export async function avisoQueContinua(
  nuevo: { clase: ClaseDeAviso; clienteId: string; carpetaId?: string },
  ahora = new Date()
): Promise<Aviso | null> {
  // **El último de esa carpeta, no el último del cliente.** Buscando solo por
  // clase y cliente, una aprobación en «Stories» tapaba a la de «Banners»:
  // `continuaA` la descartaba por ser de otra carpeta y la siguiente de
  // «Banners» abría otro aviso, con otro correo.
  const ultimo = (await losAvisos()).find(
    (a) =>
      a.clase === nuevo.clase &&
      a.clienteId === nuevo.clienteId &&
      (nuevo.carpetaId === undefined || a.carpetaId === nuevo.carpetaId)
  );
  return ultimo && continuaA(ultimo, nuevo, ahora) ? ultimo : null;
}

/**
 * Reescribe un aviso que ya está, con los cambios que salen de lo guardado.
 *
 * `cambios` recibe el aviso **como está guardado ahora** y no la copia que
 * trajo quien llama: entre que lo leyó y llega acá, otro pudo haberle subido
 * la cuenta de veces —y escribir sobre la copia vieja la pisaba— o alguien
 * pudo haberlo visto. Si devuelve `null`, no se toca nada y esto devuelve
 * `null`: el aviso ya no admite que se le sume algo.
 */
export async function actualizarAviso(
  aviso: Aviso,
  cambios: (
    habia: Aviso
  ) => Partial<Pick<Aviso, "texto" | "cuando" | "veces" | "piezas">> | null
): Promise<Aviso | null> {
  // `como` puede correr más de una vez; lo que vale es la última, que es la
  // que queda escrita.
  let quedo: Aviso | null = null;
  await almacen.cambiar(aviso.id, (habia) => {
    const hechos = habia ? cambios(habia) : null;
    quedo = habia && hechos ? { ...habia, ...hechos } : null;
    return quedo ?? habia;
  });
  return quedo;
}

/**
 * Marca como vistos, **para una persona**, los avisos que se le digan.
 *
 * **Recibe cuáles y no los marca todos**: quien lleva dos clientes de ocho no
 * puede, tocando «marcar leído», bajarle el contador a los otros seis —que ni
 * siquiera ve—. Quien llega a todos le pasa todos, y queda igual que antes.
 *
 * Y marca **solo para quien mira**: el mismo aviso le sigue apareciendo sin
 * leer al resto del equipo, que es lo que quiere decir que a cada uno le
 * avisen.
 */
export async function marcarVistos(ids: string[], personaId: string): Promise<void> {
  if (ids.length === 0 || !personaId) return;

  // **Uno por uno y con `cambiar`, tocando solo la lista de quiénes lo
  // vieron.** Antes se leían todos, se les pegaba la marca a la copia leída y
  // se escribía el documento entero: si el cliente escribía justo entre la
  // lectura y la escritura, el aviso volvía a su versión vieja **y** quedaba
  // marcado como leído, así que nadie se enteraba de ese mensaje.
  await Promise.all(
    ids.map((id) =>
      almacen.cambiar(id, (habia) => {
        if (!habia) return habia;
        const ya = habia.vistoPor ?? [];
        return ya.includes(personaId) ? habia : { ...habia, vistoPor: [...ya, personaId] };
      })
    )
  );
}
