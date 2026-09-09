import { describe, expect, it } from "vitest";
import { agruparVersiones, leerNombre } from "@/lib/versiones";

describe("leerNombre", () => {
  it("un archivo sin sufijo es la primera versión", () => {
    expect(leerNombre("9304.jpeg")).toEqual({
      base: "9304.jpeg",
      version: 1,
      titulo: "9304",
    });
  });

  it("reconoce el sufijo con espacio, que es como lo escribieron de verdad", () => {
    expect(leerNombre("9304 V2.jpeg")).toEqual({
      base: "9304.jpeg",
      version: 2,
      titulo: "9304",
    });
  });

  it.each([
    ["Carta de otoño v3.png", "Carta de otoño.png", 3],
    ["Carta de otoño V3.png", "Carta de otoño.png", 3],
    ["Carta de otoño_v3.png", "Carta de otoño.png", 3],
    ["Carta de otoño-v3.png", "Carta de otoño.png", 3],
    ["Carta de otoño  V3.png", "Carta de otoño.png", 3],
  ])("acepta «%s» como versión de la misma pieza", (nombre, base, version) => {
    const leido = leerNombre(nombre);
    expect(leido.base).toBe(base);
    expect(leido.version).toBe(version);
  });

  it("entiende una versión de dos cifras", () => {
    expect(leerNombre("grilla V12.jpg").version).toBe(12);
  });

  it("no confunde un número que es parte del nombre", () => {
    // «Verano 2026» termina en número pero no tiene uve: no es una versión.
    expect(leerNombre("Verano 2026.jpg")).toEqual({
      base: "Verano 2026.jpg",
      version: 1,
      titulo: "Verano 2026",
    });
  });

  it("no toma un sufijo que está en el medio", () => {
    expect(leerNombre("v2 del banner.jpg").version).toBe(1);
  });

  it("un archivo llamado solo «V2» no es la versión de nada", () => {
    // Sin nombre delante, el sufijo es el nombre. Agruparlo lo dejaría
    // colgando de una pieza que no existe.
    expect(leerNombre("V2.jpeg")).toEqual({
      base: "V2.jpeg",
      version: 1,
      titulo: "V2",
    });
  });

  it("se banca un archivo sin extensión", () => {
    expect(leerNombre("boceto V2")).toEqual({
      base: "boceto",
      version: 2,
      titulo: "boceto",
    });
  });

  it("no confunde un punto inicial con una extensión", () => {
    expect(leerNombre(".oculto").base).toBe(".oculto");
  });
});

describe("agruparVersiones", () => {
  const archivos = (...nombres: string[]) => nombres.map((name) => ({ name }));

  it("junta las dos versiones de la carpeta real en una sola pieza", () => {
    // Drive las devuelve por nombre, así que «V2» llega primero.
    const piezas = agruparVersiones(archivos("9304 V2.jpeg", "9304.jpeg"));

    expect(piezas).toHaveLength(1);
    expect(piezas[0].titulo).toBe("9304");
    expect(piezas[0].versiones.map((v) => v.numero)).toEqual([1, 2]);
  });

  it("deja las versiones de la más vieja a la más nueva", () => {
    const piezas = agruparVersiones(archivos("a V3.jpg", "a.jpg", "a V2.jpg"));
    expect(piezas[0].versiones.map((v) => v.numero)).toEqual([1, 2, 3]);
    expect(piezas[0].versiones.at(-1)!.archivo.name).toBe("a V3.jpg");
  });

  it("NO junta el mismo nombre con distinta extensión", () => {
    // Entregar el mismo trabajo en dos formatos es común. Juntarlos sería
    // mentir sobre qué se está aprobando.
    const piezas = agruparVersiones(archivos("9304.jpg", "9304.png"));
    expect(piezas).toHaveLength(2);
  });

  it("no junta piezas distintas", () => {
    const piezas = agruparVersiones(archivos("lunes.jpg", "martes.jpg", "receta.jpg"));
    expect(piezas).toHaveLength(3);
  });

  it("respeta el orden en que llegaron las piezas", () => {
    // Subir una vuelta nueva no puede reordenar la lista que el cliente ya
    // venía mirando.
    const piezas = agruparVersiones(
      archivos("01_lunes.jpg", "02_martes.jpg", "01_lunes V2.jpg")
    );
    expect(piezas.map((p) => p.titulo)).toEqual(["01_lunes", "02_martes"]);
  });

  it("una carpeta vacía no da piezas", () => {
    expect(agruparVersiones([])).toEqual([]);
  });

  it("dos archivos que reclaman la versión 1 quedan los dos, en orden", () => {
    // «9304.jpeg» y «9304 V1.jpeg» son ambos la primera. No se pierde ninguno.
    const piezas = agruparVersiones(archivos("9304.jpeg", "9304 V1.jpeg"));
    expect(piezas).toHaveLength(1);
    expect(piezas[0].versiones).toHaveLength(2);
  });
});
