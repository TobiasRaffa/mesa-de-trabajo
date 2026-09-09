import { describe, expect, it } from "vitest";
import {
  TAMANO_POR_DEFECTO,
  tamanoPermitido,
  urlConTamano,
  urlDeMiniatura,
} from "@/lib/miniaturas";

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

describe("urlDeMiniatura", () => {
  it("arma la dirección con el tamaño pedido", () => {
    expect(urlDeMiniatura("abc123", 400, "2026-09-08T14:22:33.000Z")).toBe(
      "/api/miniatura/abc123?px=400&v=2026-09-08T14%3A22%3A33.000Z"
    );
  });

  it("NO pone el parámetro de versión cuando no hay fecha", () => {
    // Este es el error que tenía: mandaba «&v=» a secas. La ruta pregunta si
    // el parámetro está, no si vale algo, así que le ponía caché de un día a
    // algo que no se puede invalidar -- y si el archivo cambiaba, el cliente
    // seguía viendo el viejo durante 24 horas.
    expect(urlDeMiniatura("abc123", 400)).toBe("/api/miniatura/abc123?px=400");
    expect(urlDeMiniatura("abc123", 400, undefined)).not.toContain("v=");
    expect(urlDeMiniatura("abc123", 400, "")).not.toContain("v=");
  });

  it("escapa lo que pueda romper la dirección", () => {
    const url = urlDeMiniatura("a b/c?d=e&f", 400, "x y&z");
    expect(url.split("?")[0]).toBe("/api/miniatura/a%20b%2Fc%3Fd%3De%26f");
    expect(url).toContain("v=x%20y%26z");
  });

  it("cambiar la fecha cambia la dirección", () => {
    // Es lo único que hace que el navegador vuelva a pedir la imagen.
    const antes = urlDeMiniatura("abc", 400, "2026-09-08T00:00:00.000Z");
    const despues = urlDeMiniatura("abc", 400, "2026-09-09T00:00:00.000Z");
    expect(antes).not.toBe(despues);
  });
});
