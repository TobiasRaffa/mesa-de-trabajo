import { describe, expect, it } from "vitest";
import { cabeceraDeDescarga } from "@/lib/descargas";

describe("cabeceraDeDescarga", () => {
  it("manda a bajar el archivo, no a mostrarlo", () => {
    expect(cabeceraDeDescarga("boceto.jpg")).toMatch(/^attachment;/);
  });

  it("conserva acentos y eñes en la versión codificada", () => {
    const cabecera = cabeceraDeDescarga("Diseño otoño.jpg");
    expect(cabecera).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(cabecera.split("UTF-8''")[1])).toBe("Diseño otoño.jpg");
  });

  it("deja una versión simple para navegadores viejos", () => {
    const cabecera = cabeceraDeDescarga("Diseño otoño.jpg");
    const simple = cabecera.match(/filename="([^"]*)"/)![1];
    expect(simple).toBe("Dise_o_oto_o.jpg");
    // Nada fuera de lo que cualquier navegador entiende.
    expect(simple).toMatch(/^[\w.\-]+$/);
  });

  it("no deja inyectar otra cabecera con un salto de línea", () => {
    // Es el ataque real contra esta función: un nombre de archivo con un salto
    // de línea puede agregar cabeceras que nadie escribió.
    const cabecera = cabeceraDeDescarga("boceto.jpg\r\nSet-Cookie: sesion=robada");
    expect(cabecera).not.toMatch(/[\r\n]/);
    expect(cabecera).not.toContain("Set-Cookie: sesion=robada");
  });

  it("no deja escapar de las comillas", () => {
    const cabecera = cabeceraDeDescarga('mal".jpg');
    const simple = cabecera.match(/filename="([^"]*)"/)![1];
    expect(simple).not.toContain('"');
  });

  it("neutraliza los separadores de ruta", () => {
    // Que el nombre no pueda proponer dónde guardarse.
    const cabecera = cabeceraDeDescarga("../../etc/passwd");
    expect(decodeURIComponent(cabecera.split("UTF-8''")[1])).not.toContain("/");
  });

  it("sobrevive a un nombre vacío", () => {
    expect(cabeceraDeDescarga("")).toContain('filename="archivo"');
    expect(cabeceraDeDescarga("   ")).toContain('filename="archivo"');
  });

  it("sobrevive a un nombre que es solo símbolos", () => {
    const cabecera = cabeceraDeDescarga("!!!");
    expect(cabecera).toMatch(/filename="[^"]+"/);
  });

  it("acorta un nombre larguísimo en la versión simple", () => {
    const cabecera = cabeceraDeDescarga("a".repeat(500) + ".jpg");
    const simple = cabecera.match(/filename="([^"]*)"/)![1];
    expect(simple.length).toBeLessThanOrEqual(120);
  });
});
