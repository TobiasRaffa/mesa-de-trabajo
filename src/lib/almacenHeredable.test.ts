import { describe, expect, it } from "vitest";
import { heredado } from "@/lib/almacenHeredable";
import { responsableQueCorre } from "@/lib/responsables";

describe("heredado", () => {
  it("toma el primero que esté puesto", () => {
    expect(heredado(undefined, "carpeta", "cliente")).toBe("carpeta");
  });

  it("baja hasta el último si arriba no hay nada", () => {
    expect(heredado(undefined, undefined, "cliente")).toBe("cliente");
  });

  it("el de más abajo le gana a todos", () => {
    expect(heredado("archivo", "carpeta", "cliente")).toBe("archivo");
  });

  it("sin nada puesto, no hay valor", () => {
    expect(heredado(undefined, undefined, undefined)).toBeUndefined();
  });

  it("un `null` puesto a mano MANDA y no cae al de arriba", () => {
    // Es la diferencia entre «no se eligió» y «se eligió que no haya nadie».
    // Con `??` esto devolvería «cliente», y una carpeta que alguien dejó sin
    // asignar volvería sola al responsable del cliente.
    expect(heredado(null, "carpeta", "cliente")).toBeNull();
    expect(heredado(undefined, null, "cliente")).toBeNull();
  });

  it("un cero puesto a mano tampoco cae", () => {
    expect(heredado<number>(0, 5, 9)).toBe(0);
  });
});

describe("responsableQueCorre", () => {
  it("hereda del cliente cuando abajo no hay nada", () => {
    expect(responsableQueCorre(undefined, undefined, "nari")).toBe("nari");
  });

  it("la carpeta le gana al cliente", () => {
    expect(responsableQueCorre(undefined, "delfi", "nari")).toBe("delfi");
  });

  it("el archivo le gana a todos", () => {
    expect(responsableQueCorre("juli", "delfi", "nari")).toBe("juli");
  });

  it("«sin asignar» en la carpeta no vuelve al del cliente", () => {
    expect(responsableQueCorre(undefined, null, "nari")).toBeNull();
  });

  it("sin nadie en ningún lado, es nadie", () => {
    expect(responsableQueCorre(undefined, undefined, undefined)).toBeNull();
  });
});
