import { afterEach, describe, expect, it } from "vitest";
import { abrir, cerrar, cuantasHay, esLaDeArriba, type Ficha } from "@/ui/pilaDeVentanas";

const abiertas: Ficha[] = [];

function abrirUna(nombre: string) {
  const f = abrir(nombre);
  abiertas.push(f);
  return f;
}

afterEach(() => {
  // La pila es de módulo: si una prueba deja algo abierto, la siguiente miente.
  while (abiertas.length) cerrar(abiertas.pop()!);
  expect(cuantasHay()).toBe(0);
});

describe("la pila de ventanas", () => {
  it("sin nada abierto, nadie manda", () => {
    expect(esLaDeArriba(Symbol("fantasma"))).toBe(false);
  });

  it("la única que hay es la de arriba", () => {
    const pieza = abrirUna("pieza");
    expect(esLaDeArriba(pieza)).toBe(true);
  });

  it("abrir una segunda le saca el mando a la primera", () => {
    const pieza = abrirUna("pieza");
    const ampliada = abrirUna("ampliada");

    expect(esLaDeArriba(ampliada)).toBe(true);
    expect(esLaDeArriba(pieza)).toBe(false);
  });

  it("cerrar la de arriba le devuelve el mando a la de abajo", () => {
    // Es el caso que motivó todo esto: Escape sobre la imagen ampliada tiene
    // que cerrar la imagen y dejar la pieza abierta, no cerrar las dos.
    const pieza = abrirUna("pieza");
    const ampliada = abrirUna("ampliada");

    cerrar(ampliada);
    abiertas.splice(abiertas.indexOf(ampliada), 1);

    expect(esLaDeArriba(pieza)).toBe(true);
  });

  it("cerrar una del medio no cambia quién manda", () => {
    const a = abrirUna("a");
    const b = abrirUna("b");
    const c = abrirUna("c");

    cerrar(b);
    abiertas.splice(abiertas.indexOf(b), 1);

    expect(esLaDeArriba(c)).toBe(true);
    expect(esLaDeArriba(a)).toBe(false);
    expect(cuantasHay()).toBe(2);
  });

  it("cerrar dos veces la misma no arrastra a otra", () => {
    // React puede limpiar un efecto más de una vez. Si el segundo cierre
    // sacara la de arriba, se llevaría puesta una ventana que sigue abierta.
    const pieza = abrirUna("pieza");
    const ampliada = abrirUna("ampliada");

    cerrar(ampliada);
    cerrar(ampliada);
    abiertas.splice(abiertas.indexOf(ampliada), 1);

    expect(cuantasHay()).toBe(1);
    expect(esLaDeArriba(pieza)).toBe(true);
  });

  it("una ficha que nunca se abrió no manda", () => {
    abrirUna("pieza");
    expect(esLaDeArriba(Symbol("ajena"))).toBe(false);
  });
});
