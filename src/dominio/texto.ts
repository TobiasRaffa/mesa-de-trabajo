// Cuánto puede escribir una persona de una sola vez.
//
// **Está acá y no en `conversaciones.ts` por la misma razón que `dias.ts` está
// separado de `plazos.ts`**: el campo donde se escribe vive en el navegador, y
// aquel módulo lee y escribe archivos. Importarlo desde una pantalla arrastra
// `node:fs` al paquete del cliente y rompe la compilación entera, con un
// mensaje que no nombra al culpable.

/**
 * El largo máximo de un texto escrito a mano: un mensaje, un pedido de cambio.
 *
 * **Y el campo tiene que respetarlo, no solo el servidor.** El servidor lo
 * recortaba en silencio: quien pegaba un brief de veinte mil caracteres
 * guardaba cuatro mil y no se enteraba de que había perdido el resto. Un tope
 * que el campo no muestra es una pérdida de datos con buenos modales.
 *
 * Cuatro mil caracteres son unas dos carillas. Nadie escribe eso en un pedido
 * de cambio; el número está para que un pegado accidental —o alguien
 * probando— no haga crecer un archivo sin techo.
 */
export const LARGO_MAXIMO = 4000;

/**
 * Deja un texto comparable para buscar: sin acentos, sin mayúsculas, sin
 * espacios de más. «Café Otoño» y «cafe otono» son lo mismo para quien busca.
 */
export function normalizarParaBuscar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Si el texto contiene lo buscado. Con la búsqueda vacía, todo coincide. */
export function coincide(texto: string, busqueda: string): boolean {
  const buscado = normalizarParaBuscar(busqueda);
  return buscado === "" || normalizarParaBuscar(texto).includes(buscado);
}
