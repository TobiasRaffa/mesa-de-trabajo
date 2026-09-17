// Lo que se le pide a una contraseña del equipo.
//
// **Está acá y no en `lib/claves.ts` por la misma razón que `dias.ts` está
// separado de `plazos.ts`**: el campo donde se escribe corre en el navegador, y
// aquel módulo deriva huellas con `node:crypto` y lee el almacén. Importarlo
// desde una pantalla arrastra el servidor entero al paquete del cliente y rompe
// la compilación, con un mensaje que no nombra al culpable.

/**
 * El largo mínimo de una contraseña.
 *
 * Ocho caracteres, y nada más. Pedir mayúsculas, números y símbolos hace que la
 * gente escriba «Estudio1!» y lo pegue en un papel pegado al monitor; lo que de
 * verdad la hace fuerte es que sea larga, y eso no se puede exigir sin que
 * alguien la anote.
 */
export const LARGO_MINIMO_DE_CLAVE = 8;
