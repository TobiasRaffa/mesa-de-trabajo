// Dónde se guardan las cosas. Un solo lugar, con dos implementaciones.
//
// Hasta acá, cada cosa que la aplicación guarda —los clientes, los ajustes de
// cada carpeta, las piezas, los plazos, las conversaciones— tenía **su propio
// código para leer y escribir un archivo**. Nueve módulos repitiendo lo mismo:
// leer, parsear, validar la forma, escribir a un temporal, renombrar encima.
//
// Eso es la causa de fondo de que cada cosa nueva rompiera algo: agregar una
// función era escribir por décima vez la misma plomería, y la décima vez es
// donde se olvida un detalle. Y hacía que mudarse a Supabase fuera reescribir
// nueve módulos en vez de uno.
//
// Ahora hay **un contrato** y las dos formas de cumplirlo:
//
//     enArchivos    hoy, mientras corre en una computadora
//     enSupabase    cuando esté en internet
//
// Lo que cambia al mudarse es una línea en `index.ts`. Nada más.
//
// **Lo que NO hace esto**: validar. Cada módulo sabe qué forma tiene lo suyo y
// se la pasa acá. El almacén no tiene por qué saber qué es un cliente, y si lo
// supiera habría que tocarlo cada vez que cambia algo del negocio.

/** Muchos documentos, cada uno con su identificador. */
export type Coleccion<T> = {
  /** Todo lo guardado. El orden es el de escritura. */
  todo(): Promise<Record<string, T>>;
  uno(id: string): Promise<T | undefined>;
  guardar(id: string, valor: T): Promise<void>;
  /**
   * Varios de una vez. `undefined` borra.
   *
   * Existe porque hay cambios que **no tienen sentido a medias**: guardar el
   * calendario de doce piezas, o poner un plazo arriba y dejar heredando a
   * todo lo de abajo. De a uno, un corte en el medio deja la mitad hecha.
   */
  guardarVarios(cambios: Record<string, T | undefined>): Promise<void>;
  borrar(id: string): Promise<void>;
  /**
   * Leer y escribir en un solo paso, sin que nadie se meta en el medio.
   *
   * **Es la única forma correcta de cambiar algo a partir de lo que ya
   * había.** Leer, pensar y guardar en tres pasos parece lo mismo y no lo es:
   * si entre el primero y el tercero alguien más guarda, lo suyo se pisa sin
   * error, sin aviso y sin rastro. Pasó con el chat —el cliente y la agencia
   * escribiendo en la misma fracción de segundo, y un mensaje que no llegó
   * nunca— y es la peor clase de falla que puede tener esto, porque lo que se
   * pierde es algo que alguien escribió.
   *
   * `como` recibe lo que hay —`undefined` si no hay nada— y devuelve lo que
   * tiene que quedar; devolver `undefined` lo borra. Devuelve lo que quedó
   * guardado.
   *
   * **`como` tiene que poder correr más de una vez.** En Supabase, si alguien
   * ganó la carrera, se vuelve a leer y se vuelve a llamar con lo nuevo. Así
   * que no puede mandar un correo, ni escribir en otro lado, ni contar nada
   * hacia afuera: eso va después, con lo que esto devuelve.
   */
  cambiar(
    id: string,
    como: (actual: T | undefined) => T | undefined
  ): Promise<T | undefined>;
};

/** Un solo documento suelto: el secreto de las galletas, las marcas de leído. */
export type Documento<T> = {
  leer(): Promise<T>;
  escribir(valor: T): Promise<void>;
  /** Lo mismo que el de la colección, y por lo mismo. */
  cambiar(como: (actual: T) => T): Promise<T>;
};

/**
 * Lo que tiene que saber hacer un almacén.
 *
 * Se pasa el validador y no un esquema: quien guarda ya sabe qué forma tiene
 * lo suyo, y lo que sale de un archivo —o de una base que alguien tocó a
 * mano— es tan poco confiable como lo que llega por la red.
 */
export type Almacen = {
  coleccion<T>(nombre: string, valido: (valor: unknown) => valor is T): Coleccion<T>;
  documento<T>(
    nombre: string,
    valido: (valor: unknown) => valor is T,
    porOmision: T
  ): Documento<T>;
};
