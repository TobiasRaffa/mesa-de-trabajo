import { describe, expect, it } from "vitest";
import { textoListo } from "@/admin/MensajesListos";
import { PLANTILLAS } from "@/lib/plantillas";

describe("los mensajes listos llevan un link que abre", () => {
  // La ficha del cliente pasa «/t/…», que es un camino dentro de la
  // aplicación. Pegado en un WhatsApp no es un link: el cliente nuevo recibía
  // su primer acceso roto y nadie se enteraba hasta que preguntaba.
  const datos = { cliente: "Café", carpeta: "Banners", link: "/t/abc123" };

  it.each(["entrega", "recordatorio", "vencido", "clave"])("«%s» lleva el link entero", (id) => {
    const plantilla = PLANTILLAS.find((p) => p.id === id)!;
    const texto = textoListo(plantilla, datos, "https://mesa.example");

    expect(texto).toContain("https://mesa.example/t/abc123");
  });

  it("un link que ya es entero queda como está", () => {
    const plantilla = PLANTILLAS.find((p) => p.id === "clave")!;
    const texto = textoListo(plantilla, { ...datos, link: "https://otra/t/x" }, "https://mesa.example");

    expect(texto).toContain("https://otra/t/x");
  });
});
