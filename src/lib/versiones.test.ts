import { describe, expect, it } from "vitest";
import { agruparVersiones, leerNombre, identidadDePieza } from "@/lib/versiones";

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

  // **La marca adelante es como la escribe el estudio**, y por eso esta prueba
  // dice hoy lo contrario de lo que decía: antes afirmaba que «v2 del banner»
  // NO era una versión. Lo era, y el cliente veía dos piezas donde hay una.
  it.each([
    ["V2 banner dia del padre.pdf", "banner dia del padre.pdf", 2],
    ["v2 del banner.jpg", "del banner.jpg", 2],
    ["V3-Carta de otoño.png", "Carta de otoño.png", 3],
    ["v2_grilla.jpg", "grilla.jpg", 2],
  ])("«%s» es una vuelta de la misma pieza", (nombre, base, version) => {
    const leido = leerNombre(nombre);
    expect(leido.base).toBe(base);
    expect(leido.version).toBe(version);
  });

  it("junta la misma pieza esté la marca adelante o atrás", () => {
    // Las dos formas tienen que caer en la misma pieza, o media agencia
    // nombraría de un modo y media del otro y se partiría el trabajo.
    expect(leerNombre("V2 9304.jpeg").base).toBe(leerNombre("9304 V2.jpeg").base);
  });

  it("no se come un año que empieza con uve", () => {
    // Sin el separador obligatorio, «V2025 balance» sería la versión 2025 de
    // «025 balance»: un nombre que no existe y una pieza partida en dos.
    expect(leerNombre("V2025 balance.xlsx")).toEqual({
      base: "V2025 balance.xlsx",
      version: 1,
      titulo: "V2025 balance",
    });
  });

  it("una marca adelante y otra atrás no se adivina: manda la de adelante", () => {
    // No hay respuesta correcta para «V2 banner V3», y elegir en silencio
    // sería inventarla. Lo que queda en el nombre se ve y se corrige.
    const leido = leerNombre("V2 banner V3.jpg");
    expect(leido.version).toBe(2);
    expect(leido.base).toBe("banner V3.jpg");
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

// ---------------------------------------------------------------------------

describe("la identidad de una pieza", () => {
  /**
   * **Esta es la prueba que importa de todo el archivo.**
   *
   * Durante un tiempo la pieza se guardó con el identificador de Drive de su
   * última vuelta. Al subir la V2, ese identificador cambiaba, y lo anotado
   * —los cambios que pidió el cliente, la historia, la fecha de publicación—
   * quedaba guardado bajo un nombre que ya nadie preguntaba. No se perdía:
   * dejaba de encontrarse. Y pasaba justo cuando el diseñador estaba
   * trabajando esos cambios.
   */
  it("no cambia al subir una vuelta nueva", () => {
    const carpeta = "carpeta-1";
    const primera = identidadDePieza(carpeta, "9304.jpeg");

    expect(identidadDePieza(carpeta, "9304 V2.jpeg")).toBe(primera);
    expect(identidadDePieza(carpeta, "9304 V3.jpeg")).toBe(primera);
    // Escrito como lo escribe la gente: con guion, guion bajo, o en mayúscula.
    expect(identidadDePieza(carpeta, "9304-v4.jpeg")).toBe(primera);
    expect(identidadDePieza(carpeta, "9304_V5.jpeg")).toBe(primera);
  });

  it("dos carpetas con un archivo del mismo nombre son dos piezas", () => {
    // Si no, ponerle fecha a «portada.jpg» de septiembre se la pondría también
    // a la «portada.jpg» de octubre.
    expect(identidadDePieza("septiembre", "portada.jpg")).not.toBe(
      identidadDePieza("octubre", "portada.jpg")
    );
  });

  it("dos formatos del mismo trabajo son dos piezas", () => {
    // Es común entregar lo mismo para mirar y para imprimir. Juntarlos sería
    // mentir sobre qué se está aprobando.
    expect(identidadDePieza("c", "9304.jpg")).not.toBe(identidadDePieza("c", "9304.png"));
  });

  it("dos trabajos distintos no se juntan nunca", () => {
    expect(identidadDePieza("c", "9304.jpeg")).not.toBe(
      identidadDePieza("c", "9305.jpeg")
    );
  });
});

describe("la marca adelante no desordena nada", () => {
  // Drive devuelve los archivos por nombre, y con la marca adelante «V2 banner»
  // viene ANTES que «banner». Si el orden de llegada mandara, la V2 quedaría
  // como primera vuelta: el cliente compararía al revés y lo anotado sobre la
  // pieza colgaría del archivo equivocado.
  const comoLosDaDrive = [{ name: "V2 banner.pdf" }, { name: "banner.pdf" }];

  it("«v2_stickers.pdf» es la segunda vuelta de «stickers.pdf»", () => {
    // Con guion bajo, que es como lo escriben.
    const piezas = agruparVersiones([{ name: "stickers.pdf" }, { name: "v2_stickers.pdf" }]);
    expect(piezas).toHaveLength(1);
    expect(piezas[0].titulo).toBe("stickers");
    expect(piezas[0].versiones.map((v) => v.numero)).toEqual([1, 2]);
    // La última es la que se muestra; las dos quedan, para comparar.
    expect(piezas[0].versiones[1].archivo.name).toBe("v2_stickers.pdf");
  });

  it("agrupa las dos en una sola pieza", () => {
    expect(agruparVersiones(comoLosDaDrive)).toHaveLength(1);
  });

  it("las ordena por número y no por como llegaron", () => {
    const [pieza] = agruparVersiones(comoLosDaDrive);
    expect(pieza.versiones.map((v) => v.numero)).toEqual([1, 2]);
    expect(pieza.versiones[0].archivo.name).toBe("banner.pdf");
  });

  it("la identidad no cambia por dónde esté la marca", () => {
    // Es lo que hace que los cambios pedidos sobre la V1 sigan siendo de la
    // misma pieza cuando aparece la V2.
    expect(identidadDePieza("c1", "V2 banner.pdf")).toBe(
      identidadDePieza("c1", "banner.pdf")
    );
  });
});
