import { notFound } from "next/navigation";

// La raíz no lleva a ningún lado, y eso es la decisión.
//
// Antes redirigía al diagnóstico de la agencia. Parecía cómodo y era un
// agujero: **un cliente que borra el final de la dirección** —o que toca el
// nombre del sitio en el historial— caía en una pantalla interna, con las
// miniaturas de los archivos y el estado de la conexión con Drive.
//
// Cada mundo tiene su propia puerta y hay que saberla:
//
//   - el cliente entra por su link, y además le pide el tag;
//   - la agencia entra por `/gestion`, desde el acceso directo del escritorio.
//
// Que la raíz no conteste nada no le cuesta nada a nadie y cierra el camino
// más obvio de un lado al otro.

export default function Inicio() {
  notFound();
}
