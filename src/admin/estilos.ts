// Las clases de los paneles de configuración.
//
// Están en un solo lugar porque el tamaño importa: la configuración es un
// panel que se abre **adentro** de una lista, no una pantalla. Con controles
// del tamaño de los de una pantalla, abrir uno empujaba media lista fuera de
// la vista y había que desplazar para volver a ver de qué cliente era.
//
// Así que todo acá es un escalón más chico que en el resto de la aplicación:
// texto menudo, alturas de 32 píxeles en vez de 44. Sigue siendo cómodo de
// tocar con el mouse, que es con lo que se configura.

/** El rótulo de cada sección del panel. */
export const TITULO =
  "text-micro font-extrabold uppercase tracking-widest text-apagado";

/** Un desplegable o un campo de texto. */
export const CAMPO =
  "h-8 border border-linea bg-lienzo px-2 text-menudo font-bold " +
  "focus:border-acento focus:outline-none disabled:opacity-40";

/** El botón que confirma un cambio. */
export const GUARDAR =
  "h-8 shrink-0 bg-tinta px-3 text-micro font-extrabold uppercase tracking-wider " +
  "text-lienzo transition-colors hover:bg-tinta/90 disabled:opacity-40";

/** Un botón secundario del panel. */
export const BOTON =
  "h-8 shrink-0 border-2 border-tinta px-3 text-menudo font-bold tracking-tight " +
  "text-tinta transition-colors hover:bg-hueco disabled:opacity-40";

/** «heredado», «falta», y demás rótulos al costado de un control. */
export const ETIQUETA =
  "text-micro font-extrabold uppercase tracking-wider text-apagado";
