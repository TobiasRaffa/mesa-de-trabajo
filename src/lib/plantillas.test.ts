import { describe, expect, it } from "vitest";
import { linkDeWhatsApp, mensajeDeEntrega } from "@/lib/plantillas";

describe("mensaje de entrega", () => {
  const datos = { cliente: "Café Otoño", carpeta: "Banners", link: "https://x/t/abc" };

  it("dice el trabajo, el plazo y el link", () => {
    const texto = mensajeDeEntrega({ ...datos, dias: 3 });
    expect(texto).toContain("Banners");
    expect(texto).toContain("3 días");
    expect(texto).toContain("https://x/t/abc");
  });

  it("dice «1 día» y no «1 días»", () => {
    expect(mensajeDeEntrega({ ...datos, dias: 1 })).toContain("1 día para revisarlo");
  });

  it("sin plazo no inventa uno", () => {
    // Una carpeta sin días puestos no tiene por qué prometer una fecha.
    expect(mensajeDeEntrega(datos)).not.toContain("revisarlo");
  });
});

describe("link de WhatsApp", () => {
  it("limpia el número como lo escribe la gente", () => {
    expect(linkDeWhatsApp("+54 9 11 5555-5555", "hola")).toContain("wa.me/5491155555555");
  });

  it("lleva el mensaje escrito", () => {
    expect(linkDeWhatsApp("5491155555555", "hola qué tal")).toContain(
      encodeURIComponent("hola qué tal")
    );
  });

  it("sin número que valga no devuelve link", () => {
    // Un link roto a WhatsApp es peor que no ofrecerlo: se descubre del otro
    // lado, cuando alguien ya creyó haber avisado.
    expect(linkDeWhatsApp("", "hola")).toBeNull();
    expect(linkDeWhatsApp("11-22", "hola")).toBeNull();
  });
});
