import { describe, expect, it } from "vitest";
import { filtrar, SIN_FILTROS } from "@/admin/FiltrosDelTablero";
import type { CarpetaEnElTablero, PiezaEnElTablero } from "@/admin/datos/tablero";

const pieza = (id: string, cambios: Partial<PiezaEnElTablero> = {}): PiezaEnElTablero => ({
  id,
  nombre: id,
  estado: "en_curso",
  archivo: id,
  diasConNosotros: null,
  vence: null,
  vencida: false,
  porVencer: false,
  ...cambios,
});

const carpeta = (cambios: Partial<CarpetaEnElTablero>): CarpetaEnElTablero => ({
  clienteId: "c1",
  cliente: "Café Otoño",
  carpetaId: "x",
  carpeta: "x",
  asignadaA: null,
  responsableQueCorre: null,
  vence: null,
  vencida: false,
  porVencer: false,
  piezas: 0,
  enJuego: 0,
  sinRevisar: 0,
  terminadas: 0,
  entregadas: 0,
  extraPedida: 0,
  muestras: [],
  sinLeer: 0,
  enAgencia: 0,
  sinEntregar: 0,
  cancha: "listo",
  diasQueCorren: 3,
  diasConNosotros: null,
  visible: true,
  vista: "lista",
  piezasEnJuego: [],
  hijas: [],
  ...cambios,
});

// «Banners» la lleva Ana. Adentro: «Sept», mía, con una pieza en curso hace
// dos días; y «Oct», de Ana, con cinco piezas sin entregar hace nueve días y
// otra vencida esperando al cliente. Banners tiene además una pieza propia.
const vencio = new Date("2026-01-01T00:00:00Z");
const sept = carpeta({
  carpetaId: "sept",
  carpeta: "Sept",
  asignadaA: "Yo",
  piezas: 1,
  enJuego: 1,
  enAgencia: 1,
  cancha: "agencia",
  diasConNosotros: 2,
  piezasEnJuego: [pieza("s1", { diasConNosotros: 2 })],
  muestras: [{ archivo: "s1", nombre: "s1" }],
});
const oct = carpeta({
  carpetaId: "oct",
  carpeta: "Oct",
  asignadaA: "Ana",
  piezas: 6,
  enJuego: 6,
  enAgencia: 5,
  sinEntregar: 5,
  sinRevisar: 1,
  cancha: "sin_entregar",
  diasConNosotros: 9,
  vence: vencio,
  vencida: true,
  piezasEnJuego: [
    ...[1, 2, 3, 4, 5].map((n) => pieza(`o${n}`, { diasConNosotros: 9 })),
    pieza("o6", { estado: "entregada", vence: vencio, vencida: true }),
  ],
});
const banners = carpeta({
  carpetaId: "banners",
  carpeta: "Banners",
  asignadaA: "Ana",
  // Una propia en curso más lo de las dos hijas.
  piezas: 8,
  enJuego: 8,
  enAgencia: 7,
  sinEntregar: 5,
  sinRevisar: 1,
  cancha: "sin_entregar",
  diasConNosotros: 9,
  vence: vencio,
  vencida: true,
  piezasEnJuego: [pieza("b1", { diasConNosotros: 4 })],
  muestras: [{ archivo: "b1", nombre: "b1" }],
  hijas: [sept, oct],
});

describe("el filtro «quién lo lleva» y los números de la carpeta madre", () => {
  // La madre se conserva para no cortar el camino hasta «Sept», pero seguía
  // diciendo «5 sin entregar» y ubicándose en esa columna: el trabajo de Ana,
  // sumado en la pantalla de quien pidió ver solo lo suyo.
  const [madre] = filtrar([banners], { ...SIN_FILTROS, quien: "Yo" });

  it("quedan solo las hijas que pasan", () => {
    expect(madre.hijas.map((h) => h.carpeta)).toEqual(["Sept"]);
  });

  it("los números hablan solo de lo que se ve", () => {
    expect(madre.sinEntregar).toBe(0);
    expect(madre.enAgencia).toBe(1);
    expect(madre.sinRevisar).toBe(0);
    expect(madre.piezas).toBe(1);
    expect(madre.enJuego).toBe(1);
  });

  it("va en la cancha de lo que se ve, y sin el vencimiento de otra", () => {
    expect(madre.cancha).toBe("agencia");
    expect(madre.vencida).toBe(false);
    expect(madre.vence).toBeNull();
    expect(madre.diasConNosotros).toBe(2);
  });

  it("no muestra las piezas propias, que son de otra persona", () => {
    expect(madre.piezasEnJuego).toEqual([]);
    expect(madre.muestras).toEqual([]);
  });
});

describe("una madre que pasa y pierde una hija", () => {
  it("suma lo propio y lo de las hijas que quedaron", () => {
    const [madre] = filtrar([banners], { ...SIN_FILTROS, quien: "Ana" });

    expect(madre.hijas.map((h) => h.carpeta)).toEqual(["Oct"]);
    // Lo propio: una en curso. Lo de Oct: cinco sin entregar, una esperando.
    expect(madre.enAgencia).toBe(6);
    expect(madre.sinEntregar).toBe(5);
    expect(madre.piezas).toBe(7);
    expect(madre.piezasEnJuego.map((p) => p.id)).toEqual(["b1"]);
    expect(madre.vencida).toBe(true);
  });
});

describe("sin filtros", () => {
  it("devuelve las carpetas tal cual", () => {
    expect(filtrar([banners], SIN_FILTROS)[0]).toBe(banners);
  });
});
