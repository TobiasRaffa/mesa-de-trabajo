// La etiqueta que dice en qué anda una pieza.
//
// Los colores de estado son señales y no decoración: si se usan para otra
// cosa, dejan de leerse de un vistazo. Por eso viven acá y no sueltos.

import type { Estado as EstadoPieza } from "@/dominio/pieza";

type Tono = "espera" | "listo" | "mirando" | "quieto";

const ESTILOS: Record<Tono, string> = {
  espera: "bg-espera-tenue text-espera",
  listo: "bg-listo-tenue text-listo",
  mirando: "bg-mirando-tenue text-mirando",
  quieto: "bg-hueco text-apagado",
};

/** Cómo se llama y de qué color va cada estado, del lado del cliente. */
const PARA_EL_CLIENTE: Record<EstadoPieza, { texto: string; tono: Tono } | null> = {
  // Antes de la primera entrega el cliente no ve la pieza. Pero si llega acá
  // después de mandar cambios, sí la ve: y lo que necesita saber es que ya no
  // está en su cancha.
  en_curso: { texto: "Con el equipo", tono: "quieto" },
  entregada: { texto: "Para revisar", tono: "espera" },
  en_revision: { texto: "Para revisar", tono: "espera" },
  cambios_marcados: { texto: "Cambios pedidos", tono: "mirando" },
  extra_pedida: { texto: "Revisión adicional pedida", tono: "mirando" },
  final: { texto: "Aprobada", tono: "listo" },
  cancelada: { texto: "Cancelada", tono: "quieto" },
};

export function Estado({ estado }: { estado: EstadoPieza }) {
  const info = PARA_EL_CLIENTE[estado];
  if (!info) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-micro font-semibold tracking-wide ${ESTILOS[info.tono]}`}
    >
      {info.texto}
    </span>
  );
}
