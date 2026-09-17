import { describe, expect, it } from "vitest";
import { ALARMA_DESDE, AVISA_DESDE, comoVaLaEspera, masVieja } from "@/dominio/espera";

describe("cuándo algo quieto empieza a alarmar", () => {
  it("un día no es nada", () => {
    expect(comoVaLaEspera(0)).toBe("al_dia");
    expect(comoVaLaEspera(1)).toBe("al_dia");
  });

  it("a los dos días avisa", () => {
    expect(comoVaLaEspera(AVISA_DESDE)).toBe("avisa");
  });

  it("a los tres alarma, y de ahí en más", () => {
    expect(comoVaLaEspera(ALARMA_DESDE)).toBe("alarma");
    expect(comoVaLaEspera(5)).toBe("alarma");
    expect(comoVaLaEspera(40)).toBe("alarma");
  });

  it("nada de nuestro lado no alarma", () => {
    // `null` es que no hay nada que contar, no que haga cero días.
    expect(comoVaLaEspera(null)).toBe("al_dia");
  });
});

describe("lo más viejo de un conjunto", () => {
  // **Es lo que hace que el problema se vea desde afuera.** Sin esto, una
  // pieza parada hace cinco días adentro de «Banners / Septiembre» solo se ve
  // abriendo el cliente, abriendo la carpeta y abriendo la subcarpeta: tres
  // pasos para enterarse de lo único que había que saber de un vistazo.
  it("manda el peor, no el promedio", () => {
    expect(masVieja([0, 5, 1])).toBe(5);
  });

  it("una sola pieza atrasada alcanza para que la carpeta lo esté", () => {
    expect(comoVaLaEspera(masVieja([0, 0, 0, 4]))).toBe("alarma");
  });

  it("si están todas al día, la carpeta está al día", () => {
    expect(comoVaLaEspera(masVieja([0, 1, 1]))).toBe("al_dia");
  });

  it("los que no están de nuestro lado no cuentan", () => {
    expect(masVieja([null, 2, null])).toBe(2);
  });

  it("sin nada de nuestro lado no hay número", () => {
    // Cero sería mentir: pondría «al día» sobre una carpeta que no tiene nada
    // esperando de este lado.
    expect(masVieja([null, null])).toBeNull();
    expect(masVieja([])).toBeNull();
  });
});
