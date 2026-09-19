// Quién ve qué.
//
// Lo que se prueba acá no es «el menú muestra las secciones correctas» sino
// **que nadie llegue a donde no le toca**, que es lo mismo mirado desde el
// lado que importa. Dos de estas pruebas existen por errores que este tipo de
// código comete siempre: dejar abierto lo que no se reconoce, y mandar a
// alguien a una pantalla que después no lo deja entrar.

import { describe, expect, it } from "vitest";
import {
  alcanzaA,
  dondeEmpieza,
  esAlcance,
  recortaA,
  laDaElRol,
  ROLES,
  RUTA_DE,
  SECCIONES,
  seccionDeLaRuta,
  seccionesDe,
  type Seccion,
} from "@/dominio/roles";

describe("lo que ve alguien", () => {
  it("administración ve todo", () => {
    expect(seccionesDe("admin")).toEqual([...SECCIONES]);
  });

  it("diseño no ve las facturas ni reparte accesos", () => {
    const suyas = seccionesDe("diseno");
    expect(suyas).not.toContain("facturas");
    expect(suyas).not.toContain("admin");
    expect(suyas).toContain("clientes");
  });

  it("una suelta se suma a las del rol", () => {
    // El caso para el que existen: «esta diseñadora también mira las
    // facturas». Sin esto, cada excepción obliga a inventar un rol nuevo y se
    // termina con un rol por persona, que es no tener roles.
    expect(seccionesDe("diseno", ["facturas"])).toContain("facturas");
    expect(seccionesDe("diseno", ["facturas"])).toContain("tablero");
  });

  it("una suelta no puede quitar lo que da el rol", () => {
    // Las sueltas suman y nunca restan. Para quitarle algo a alguien se le
    // cambia el rol, que es la decisión que de verdad se está tomando.
    expect(seccionesDe("diseno", [])).toContain("clientes");
  });

  it("sale siempre en el mismo orden, sin repetidas", () => {
    // Con esta lista se dibuja el menú y se decide a dónde cae alguien al
    // entrar: si el orden dependiera de en qué orden se tildaron las casillas,
    // dos personas con el mismo acceso verían cosas distintas.
    const desordenada = seccionesDe("diseno", ["facturas", "tablero", "facturas"]);
    expect(desordenada).toEqual(["tablero", "clientes", "conversaciones", "notificaciones", "facturas"]);
  });

  it("todos los moldes dan al menos una sección", () => {
    // Un rol que no da nada es una persona que entra y no tiene a dónde ir.
    // El personalizado es la excepción a propósito: lo suyo son las sueltas.
    for (const rol of ROLES.filter((r) => r !== "personalizado")) {
      expect(seccionesDe(rol).length, `El rol «${rol}» no da ninguna sección.`).toBeGreaterThan(0);
    }
  });

  it("el personalizado no da nada por sí mismo: ve exactamente sus sueltas", () => {
    expect(seccionesDe("personalizado")).toEqual([]);
    expect(seccionesDe("personalizado", ["facturas", "tablero"])).toEqual(["tablero", "facturas"]);
    // Ninguna sección «la da el rol», así que todas se pueden tildar y destildar.
    expect(SECCIONES.some((s) => laDaElRol("personalizado", s))).toBe(false);
  });

  it("solo administración entra a Admin", () => {
    // **Es lo que hace que los roles separen algo.** En Admin se cambian los
    // roles: si entrara cualquiera, el primer paso de cualquiera sería darse
    // el rol que quiera y los demás roles no significarían nada.
    const entran = ROLES.filter((rol) => laDaElRol(rol, "admin"));
    expect(entran).toEqual(["admin"]);
  });
});

describe("de qué sección es cada dirección", () => {
  it("la lista de clientes es la raíz de la gestión", () => {
    expect(seccionDeLaRuta("/gestion")).toBe("clientes");
  });

  it("adentro de un cliente se sigue estando en Clientes", () => {
    expect(seccionDeLaRuta("/gestion/cliente/abc")).toBe("clientes");
    expect(seccionDeLaRuta("/gestion/cliente/abc/carpeta/xyz")).toBe("clientes");
  });

  it("cada sección reconoce lo suyo", () => {
    expect(seccionDeLaRuta("/gestion/tablero")).toBe("tablero");
    expect(seccionDeLaRuta("/gestion/chats")).toBe("conversaciones");
    expect(seccionDeLaRuta("/gestion/facturas")).toBe("facturas");
    expect(seccionDeLaRuta("/gestion/admin")).toBe("admin");
    expect(seccionDeLaRuta("/diagnostico")).toBe("diagnostico");
  });

  it("una dirección que no se reconoce no es de nadie", () => {
    // **La prueba que sostiene todo lo demás.** `/gestion` es prefijo de todas
    // las direcciones de la gestión: si se la tratara como prefijo, cualquier
    // pantalla nueva caería adentro de «Clientes» y se abriría para medio
    // equipo sin que nadie lo decidiera. `null` es «acá no entra nadie», y la
    // puerta lo trata así.
    expect(seccionDeLaRuta("/gestion/loquesea")).toBeNull();
    expect(seccionDeLaRuta("/gestion/facturacion-nueva")).toBeNull();
    // Y un nombre que *empieza* como otra sección tampoco se cuela.
    expect(seccionDeLaRuta("/gestion/clientes-todos")).toBeNull();
    expect(seccionDeLaRuta("/diagnosticos")).toBeNull();
  });

  it("la barra final no cambia la respuesta", () => {
    expect(seccionDeLaRuta("/gestion/")).toBe("clientes");
    expect(seccionDeLaRuta("/gestion/tablero/")).toBe("tablero");
  });
});

describe("a dónde cae alguien al entrar", () => {
  it("a la primera sección que puede ver", () => {
    expect(dondeEmpieza(seccionesDe("admin"))).toBe("/gestion/tablero");
  });

  it("quien solo factura no cae en la lista de clientes", () => {
    // Mandarlo a `/gestion` sería recibirlo con una pared apenas escribe su
    // contraseña.
    expect(dondeEmpieza(seccionesDe("facturacion"))).toBe("/gestion/facturas");
  });

  it("sin ninguna sección no hay a dónde ir", () => {
    expect(dondeEmpieza([])).toBeNull();
  });

  it("a donde manda, se puede entrar", () => {
    // **Sin esto la puerta da vueltas sobre sí misma.** Manda a alguien a la
    // pantalla de su primera sección, y esa pantalla vuelve a pasar por la
    // puerta: si la dirección a la que manda no perteneciera a la sección que
    // dice, la puerta la rebotaría y volvería a mandarlo al mismo lugar, para
    // siempre. Son dos listas distintas y esto verifica que digan lo mismo.
    for (const seccion of SECCIONES) {
      expect(
        seccionDeLaRuta(RUTA_DE[seccion]),
        `«${seccion}» empieza en ${RUTA_DE[seccion]}, pero esa dirección no es de esa sección.`
      ).toBe(seccion);
    }
  });

  it("cada sección tiene su propia dirección", () => {
    // Dos secciones que empiezan en el mismo lado son una sección con dos
    // nombres: repartir el acceso a una estaría repartiendo el de la otra.
    const rutas = SECCIONES.map((s: Seccion) => RUTA_DE[s]);
    expect(new Set(rutas).size).toBe(SECCIONES.length);
  });
});

describe("a qué clientes llega alguien", () => {
  const CLIENTES = [{ id: "cafe" }, { id: "panaderia" }, { id: "estudio" }];

  it("«todos» son los que haya, también los de mañana", () => {
    // **No es lo mismo que la lista de todos los clientes de hoy.** Guardada
    // como lista, el cliente que se dé de alta la semana que viene quedaría
    // afuera para todo el mundo, sin que nadie se entere de por qué.
    expect(alcanzaA("todos", "un-cliente-que-todavia-no-existe")).toBe(true);
    expect(recortaA("todos", CLIENTES)).toEqual(CLIENTES);
  });

  it("una lista deja entrar a los suyos y a nadie más", () => {
    expect(alcanzaA(["cafe"], "cafe")).toBe(true);
    expect(alcanzaA(["cafe"], "panaderia")).toBe(false);
    expect(recortaA(["cafe", "estudio"], CLIENTES)).toEqual([
      { id: "cafe" },
      { id: "estudio" },
    ]);
  });

  it("una lista vacía no alcanza a nadie", () => {
    // Es la respuesta segura, y la que devuelve la sesión cuando no hay nadie
    // adentro: una pantalla sin sesión tiene que ver una lista vacía, no la de
    // todos.
    expect(alcanzaA([], "cafe")).toBe(false);
    expect(recortaA([], CLIENTES)).toEqual([]);
  });

  it("lo guardado se valida antes de creerle", () => {
    expect(esAlcance("todos")).toBe(true);
    expect(esAlcance(["cafe"])).toBe(true);
    expect(esAlcance([])).toBe(true);
    expect(esAlcance("cafe")).toBe(false);
    expect(esAlcance(undefined)).toBe(false);
    expect(esAlcance([1, 2])).toBe(false);
  });
});
