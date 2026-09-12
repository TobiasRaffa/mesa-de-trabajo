// Cómo se le entrega un archivo original al cliente.
//
// Separado de la ruta porque es una decisión, no una llamada: cómo se arma el
// nombre con el que baja el archivo tiene más trampas de las que parece, y
// conviene poder probarlas.

/**
 * Arma la cabecera que le dice al navegador «esto se baja, y se llama así».
 *
 * Tiene dos formas del nombre a propósito:
 *
 *   · `filename=` con solo letras y números, para navegadores viejos.
 *   · `filename*=` codificado, que es la que respeta acentos y eñes.
 *
 * Sin la segunda, «Diseño otoño.jpg» baja como «Dise_o oto_o.jpg». Con solo la
 * segunda, algún navegador viejo no baja nada.
 *
 * Y hay una razón de seguridad: un nombre de archivo puede traer comillas o
 * saltos de línea. Metidos tal cual en una cabecera, permiten inyectar otras
 * cabeceras. Por eso el nombre se limpia antes, siempre.
 */
export function cabeceraDeDescarga(
  nombre: string,
  /**
   * `inline` lo abre en el navegador en vez de bajarlo.
   *
   * Es para los PDF de varias páginas: la miniatura solo muestra la primera,
   * y el visor del propio navegador las muestra todas sin que tengamos que
   * escribir uno. Solo se usa con tipos que el navegador sabe mostrar —un
   * `inline` sobre cualquier cosa deja que el navegador decida qué hacer con
   * ella, y eso no se le regala a un archivo que subió cualquiera—.
   */
  como: "attachment" | "inline" = "attachment"
): string {
  const limpio = nombre
    // Saltos de línea y retornos: la vía de inyección de cabeceras.
    .replace(/[\r\n]/g, " ")
    // Separadores de ruta: que nadie proponga dónde guardarlo.
    .replace(/[/\\]/g, "-")
    .trim();

  const seguro = limpio || "archivo";

  // Versión de repuesto: solo lo que cualquier navegador entiende sin dudar.
  const simple = seguro.replace(/[^\w.-]+/g, "_").slice(0, 120) || "archivo";

  return `${como}; filename="${simple}"; filename*=UTF-8''${encodeURIComponent(seguro)}`;
}
