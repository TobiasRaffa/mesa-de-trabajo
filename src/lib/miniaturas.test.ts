import { describe, expect, it } from "vitest";
import { TAMANO_POR_DEFECTO, tamanoPermitido, urlConTamano } from "@/lib/miniaturas";

describe("tamanoPermitido", () => {
  it("acepta los tamaños de la lista", () => {
    expect(tamanoPermitido(220)).toBe(220);
    expect(tamanoPermitido("400")).toBe(400);
    expect(tamanoPermitido(1200)).toBe(1200);
  });

  it("rechaza cualquier otro y usa el de por defecto", () => {
    // El caso que importa: nadie puede pedir una imagen enorme para
    // hacer trabajar al servidor.
    expect(tamanoPermitido(99999)).toBe(TAMANO_POR_DEFECTO);
    expect(tamanoPermitido(-1)).toBe(TAMANO_POR_DEFECTO);
    expect(tamanoPermitido(401)).toBe(TAMANO_POR_DEFECTO);
  });

  it("sobrevive a basura", () => {
    expect(tamanoPermitido(null)).toBe(TAMANO_POR_DEFECTO);
    expect(tamanoPermitido(undefined)).toBe(TAMANO_POR_DEFECTO);
    expect(tamanoPermitido("")).toBe(TAMANO_POR_DEFECTO);
    expect(tamanoPermitido("grande")).toBe(TAMANO_POR_DEFECTO);
    expect(tamanoPermitido("400; DROP TABLE")).toBe(TAMANO_POR_DEFECTO);
  });
});

describe("urlConTamano", () => {
  const base = "https://lh3.googleusercontent.com/drive-storage/AbCd123";

  it("reemplaza el tamaño que trae Google", () => {
    expect(urlConTamano(`${base}=s220`, 400)).toBe(`${base}=s400`);
  });

  it("reemplaza también cuando viene recortada", () => {
    expect(urlConTamano(`${base}=s220-c`, 800)).toBe(`${base}=s800`);
  });

  it("no encadena dos sufijos", () => {
    // Encadenar daría una dirección inválida y la imagen no cargaría.
    const resultado = urlConTamano(`${base}=s220`, 400);
    expect(resultado.match(/=s\d+/g)).toHaveLength(1);
  });

  it("agrega el tamaño si la dirección no traía ninguno", () => {
    expect(urlConTamano(base, 400)).toBe(`${base}=s400`);
  });
});
