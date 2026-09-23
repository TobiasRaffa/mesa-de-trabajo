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

  // **La gente escribe el número como lo tiene agendado**, no como lo quiere
  // wa.me. Sin el 54 adelante, WhatsApp lo leía como de otro país —«11 5555…»
  // es un +1, de Estados Unidos— y el aviso con el link al portal podía
  // terminar en el teléfono de un desconocido.
  it.each([
    ["+54 9 11 5555-5555"],
    ["+54 11 5555-5555"],
    ["5491155555555"],
    ["0054 9 11 5555-5555"],
    ["11 5555-5555"],
    ["(011) 5555-5555"],
    ["011 15 5555-5555"],
    ["11 15 5555-5555"],
    ["+54 9 11 15 5555-5555"],
  ])("«%s» va al mismo celular de Buenos Aires", (telefono) => {
    expect(linkDeWhatsApp(telefono, "hola")).toMatch(/^https:\/\/wa\.me\/5491155555555\?/);
  });

  it("con otra característica saca el 15 de donde está", () => {
    expect(linkDeWhatsApp("0351 15 555-5555", "hola")).toContain("wa.me/5493515555555?");
    expect(linkDeWhatsApp("(2944) 15 55-5555", "hola")).toContain("wa.me/5492944555555?");
  });

  it("un número de otro país escrito con + se respeta", () => {
    expect(linkDeWhatsApp("+1 415 555 0100", "hola")).toContain("wa.me/14155550100?");
  });

  it.each([
    // Sin característica no hay forma de saber de dónde es: adivinar la de
    // Buenos Aires es mandarle el mensaje a otro.
    ["15 5555-5555"],
    ["15-5555-5555"],
    ["5555-5555"],
    // Dos números pegados no son ninguno de los dos.
    ["+54 9 11 5555-5555 / 4444-4444"],
  ])("«%s» no arma un link", (telefono) => {
    expect(linkDeWhatsApp(telefono, "hola")).toBeNull();
  });
});
