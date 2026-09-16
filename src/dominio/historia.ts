// Qué cosas le pueden pasar a una pieza, y cómo se cuenta cada una.
//
// **Está separado de `lib/piezas.ts` por la misma razón que `dias.ts` lo está
// de `plazos.ts`**: esto lo necesita una pantalla, y aquello lee y escribe
// archivos. Importarlo desde el navegador arrastraba `node:fs` al paquete del
// cliente y **rompía la compilación entera**, con un mensaje que no nombra al
// culpable ni al que lo importó.
//
// La regla que deja: lo que una pantalla necesita saber va en un módulo que no
// toque el servidor. Acá no se importa nada, y así tiene que quedar.

/** Cada cosa que puede pasarle a una pieza y queda anotada. */
export type Hito =
  | "entregada"
  | "reabierta_por_agencia"
  | "extra_pedida"
  | "extra_habilitada"
  | "devuelta_a_su_carpeta"
  | "no_se_pudo_devolver"
  | "aprobada"
  | "cambios_pedidos"
  | "cambios_descartados"
  | "revision_enviada"
  | "reabierta"
  | "movida_a_finales"
  | "no_se_pudo_mover"
  | "archivo_reemplazado";

/**
 * Cómo se lee cada hito.
 *
 * En pasado y en tercera persona, porque se lee en una lista de cosas que ya
 * pasaron. Sin nombres acá: quién lo hizo va al lado, y sale de la sesión.
 */
export const EN_PALABRAS: Record<Hito, string> = {
  entregada: "Se entregó",
  aprobada: "Aprobó",
  cambios_pedidos: "Pidió cambios",
  cambios_descartados: "Descartó los cambios",
  revision_enviada: "Envió la revisión",
  reabierta: "Reabrió la pieza",
  reabierta_por_agencia: "Reabrió la pieza para que el cliente la vuelva a mirar",
  extra_pedida: "Pidió una revisión adicional",
  extra_habilitada: "Habilitó una revisión adicional",
  movida_a_finales: "Se movió a «Entregas finales»",
  no_se_pudo_mover: "No se pudo mover a «Entregas finales»",
  devuelta_a_su_carpeta: "Volvió a su carpeta de trabajo",
  no_se_pudo_devolver: "No se pudo sacar de «Entregas finales»",
  archivo_reemplazado:
    "Se borró el archivo y se subió otro con el mismo nombre: la pieza vuelve a empezar",
};
