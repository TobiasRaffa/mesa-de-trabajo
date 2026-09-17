// De qué color se ve algo que hace días que está quieto de nuestro lado.
//
// La regla —a partir de cuántos días avisa y a partir de cuántos alarma— vive
// en el dominio. Acá vive nada más que cómo se pinta, que es lo único de esto
// que es una decisión de pantalla.

import { comoVaLaEspera } from "@/dominio/espera";

/** El número de días, donde el número es lo que se lee. */
export function tonoDeEspera(dias: number | null): string {
  switch (comoVaLaEspera(dias)) {
    case "alarma":
      return "text-alerta";
    case "avisa":
      return "text-espera";
    case "al_dia":
      return "text-apagado";
  }
}

/**
 * Un **nombre**, donde el color es un aviso y no el dato.
 *
 * La única diferencia con el de arriba: al día no se pinta de gris, se deja
 * como está. Un nombre apagado se lee como apagado —oculto, terminado— y lo
 * que está al día no es ninguna de las dos cosas.
 */
export function tonoDelNombre(dias: number | null): string {
  return comoVaLaEspera(dias) === "al_dia" ? "" : tonoDeEspera(dias);
}
