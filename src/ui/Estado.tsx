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

export function Estado({ estado }: { estado: EstadoPieza }) {
  const info = PARA_EL_CLIENTE[estado];
  if (!info) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-mono text-micro font-bold uppercase tracking-wider ${ESTILOS[info.tono]}`}
    >
      {info.texto}
    </span>
  );
}
