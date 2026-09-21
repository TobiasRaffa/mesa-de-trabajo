// La etiqueta que dice en qué anda una pieza.
//
// Una pastilla de color con el texto en monoespaciada y versalitas: se lee
// de lejos y se distingue de un vistazo en una lista larga. Los colores de estado son
// señales y no decoración -- si se usan para otra cosa, dejan de leerse.

import type { Estado as EstadoPieza } from "@/dominio/pieza";

type Tono = "espera" | "listo" | "trabajando" | "quieto";

const ESTILOS: Record<Tono, string> = {
  espera: "bg-espera-tenue text-espera",
  listo: "bg-lima text-tinta",
  trabajando: "bg-tinta text-lienzo",
  quieto: "bg-hueco text-apagado",
};

const PARA_EL_CLIENTE: Record<EstadoPieza, { texto: string; tono: Tono } | null> = {
  // Antes de la primera entrega el cliente no ve la pieza. Pero si llega acá
  // después de mandar cambios, sí la ve: y lo que necesita saber es que ya no
  // está en su cancha.
  en_curso: { texto: "Con el equipo", tono: "quieto" },
  entregada: { texto: "Para revisar", tono: "espera" },
  en_revision: { texto: "Para revisar", tono: "espera" },
  cambios_marcados: { texto: "Cambios pedidos", tono: "trabajando" },
  extra_pedida: { texto: "Revisión adicional pedida", tono: "trabajando" },
  final: { texto: "Aprobada", tono: "listo" },
  cancelada: { texto: "Cancelada", tono: "quieto" },
};

/**
 * Las mismas piezas, contadas desde este lado del mostrador.
 *
 * **La agencia leía las palabras del cliente y se entendían al revés.** «Para
 * revisar» del lado de la agencia parece trabajo propio pendiente, y es
 * exactamente lo contrario: la pieza está con el cliente y no hay nada que
 * hacer. Peor todavía en el tablero, donde la columna ya dice «A cargo del
 * cliente» y la pastilla de al lado decía «PARA REVISAR».
 *
 * Son las palabras que el tablero ya usa en `CANCHAS`, para que las dos
 * pantallas hablen igual.
 */
const PARA_LA_AGENCIA: Record<EstadoPieza, { texto: string; tono: Tono } | null> = {
  en_curso: { texto: "Falta hacerlo", tono: "trabajando" },
  entregada: { texto: "Esperando al cliente", tono: "espera" },
  en_revision: { texto: "Esperando al cliente", tono: "espera" },
  cambios_marcados: { texto: "Pidió cambios", tono: "trabajando" },
  extra_pedida: { texto: "Pide una vuelta más", tono: "trabajando" },
  final: { texto: "Aprobada", tono: "listo" },
  cancelada: { texto: "Cancelada", tono: "quieto" },
};

export function Estado({
  estado,
  mirada = "cliente",
}: {
  estado: EstadoPieza;
  /** Desde qué lado se lee. Las pantallas de gestión pasan `"agencia"`. */
  mirada?: "agencia" | "cliente";
}) {
  const info = (mirada === "agencia" ? PARA_LA_AGENCIA : PARA_EL_CLIENTE)[estado];
  if (!info) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-mono text-micro font-bold uppercase tracking-wider ${ESTILOS[info.tono]}`}
    >
      {info.texto}
    </span>
  );
}
