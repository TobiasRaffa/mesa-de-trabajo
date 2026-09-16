import { describe, expect, it } from "vitest";
import { comoPedido, esDelEquipo, idDelComentario, vieneDeDrive } from "@/dominio/comentarios";

describe("de quién es un comentario de Drive", () => {
  // De esta pregunta depende que una nota que el diseñador se deja a sí mismo
  // en el PDF no termine en la lista de cambios que pidió el cliente —y
  // contando como una vuelta del presupuesto—.
  const EQUIPO = ["Narella Rafaelli", "Nari", "nari@estudio.com"];

  it("lo que escribe alguien del equipo es del equipo", () => {
    expect(esDelEquipo({ quien: "Narella Rafaelli" }, EQUIPO)).toBe(true);
  });

  it("lo reconoce por el correo, si Google lo da", () => {
    expect(esDelEquipo({ quien: "N. R.", correo: "nari@estudio.com" }, EQUIPO)).toBe(true);
  });

  it("no se traba con mayúsculas ni espacios de más", () => {
    // Nadie escribe dos veces igual, y una mayúscula de diferencia no puede
    // ser lo que decide si esto entra a la lista del cliente.
    expect(esDelEquipo({ quien: "  nARI " }, EQUIPO)).toBe(true);
  });

  it("lo que escribe el cliente no es del equipo", () => {
    expect(esDelEquipo({ quien: "Marina · Cafe Otoño" }, EQUIPO)).toBe(false);
  });

  it("sin equipo cargado, nada es del equipo", () => {
    expect(esDelEquipo({ quien: "Nari" }, [])).toBe(false);
  });

  it("un renglón vacío en el equipo no convierte a todos en equipo", () => {
    // Una persona cargada sin correo deja una cadena vacía en la lista. Si eso
    // se comparara, cualquier comentario sin autor sería del equipo.
    expect(esDelEquipo({ quien: "Marina" }, ["", "   "])).toBe(false);
  });

  it("un comentario sin autor tampoco", () => {
    expect(esDelEquipo({ quien: "" }, EQUIPO)).toBe(false);
  });
});

describe("cómo se lee un comentario convertido en pedido", () => {
  it("la hoja va adelante", () => {
    // Un pedido de un PDF de veinte hojas sin decir en cuál está manda a
    // buscarlo a mano por todo el archivo.
    expect(comoPedido({ texto: "cambiar el verde", hoja: 7 })).toBe(
      "Hoja 7: cambiar el verde"
    );
  });

  it("sin hoja queda el texto solo, sin inventar ninguna", () => {
    expect(comoPedido({ texto: "cambiar el verde" })).toBe("cambiar el verde");
  });

  it("se le sacan los espacios de los bordes", () => {
    expect(comoPedido({ texto: "  algo\n", hoja: 2 })).toBe("Hoja 2: algo");
  });
});

describe("de dónde vino un pedido", () => {
  it("el nombre dice que salió de Drive", () => {
    expect(vieneDeDrive(idDelComentario("AAAA1234"))).toBe(true);
  });

  it("uno escrito en el portal, no", () => {
    expect(vieneDeDrive("8f14e45f-ceea-467a-9aee-1c1d0b1f2d3e")).toBe(false);
  });
});
