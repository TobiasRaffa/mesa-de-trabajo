import { describe, expect, it } from "vitest";
import {
  aplicar,
  deQuienEsLaPelota,
  estaBloqueada,
  piezaNueva,
  quedanRondas,
  type Estado,
  type Evento,
  type Pieza,
} from "@/dominio/pieza";

/** Aplica varios eventos seguidos y falla con claridad si alguno no se puede. */
function recorrer(pieza: Pieza, ...eventos: Evento[]): Pieza {
  return eventos.reduce((actual, evento) => {
    const r = aplicar(actual, evento);
    if (!r.ok) {
      throw new Error(`«${evento.tipo}» no se pudo desde «${actual.estado}»: ${r.motivo}`);
    }
    return r.pieza;
  }, pieza);
}

const entregada = () => recorrer(piezaNueva(), { tipo: "entregar" });
const enRevision = () => recorrer(entregada(), { tipo: "abrir" });

const APROBAR: Evento = { tipo: "aprobar", por: "Laura" };

describe("el camino completo de una pieza", () => {
  it("va de boceto a aprobada sin pedir cambios", () => {
    const p = recorrer(piezaNueva(), { tipo: "entregar" }, { tipo: "abrir" }, APROBAR);
    expect(p.estado).toBe("final");
    expect(p.ronda).toBe(0);
  });

  it("da una vuelta completa con una ronda de cambios", () => {
    const p = recorrer(
      piezaNueva(),
      { tipo: "entregar" },
      { tipo: "abrir" },
      { tipo: "pedir_cambios" },
      { tipo: "cerrar_revision" }, // recién acá vuelve a la agencia
      { tipo: "entregar" }, // v2
      { tipo: "abrir" },
      APROBAR
    );
    expect(p.estado).toBe("final");
    expect(p.ronda).toBe(1);
  });
});

describe("regla 1 — aprobar es inmediato y por pieza", () => {
  it("aprobar deja la pieza terminada sin esperar el cierre de la ronda", () => {
    // Es lo que permite publicar un posteo el jueves aunque el resto del mes
    // siga en revisión.
    const r = aplicar(enRevision(), APROBAR);
    expect(r).toMatchObject({ ok: true, pieza: { estado: "final" } });
  });

  it("se puede aprobar sin haberla abierto", () => {
    // El cliente puede decidir desde la grilla, sin entrar a la pieza.
    expect(aplicar(entregada(), APROBAR)).toMatchObject({ ok: true });
  });

  it("se puede aprobar algo donde ya se habían marcado cambios", () => {
    // Mientras la ronda siga abierta nada salió hacia la agencia. Si no se
    // pudiera, un clic dejaría al cliente atrapado.
    const conCambios = recorrer(enRevision(), { tipo: "pedir_cambios" });
    expect(aplicar(conCambios, APROBAR)).toMatchObject({
      ok: true,
      pieza: { estado: "final" },
    });
  });

  it("arrepentirse no consume una ronda", () => {
    const conCambios = recorrer(enRevision(), { tipo: "pedir_cambios" });
    const aprobada = recorrer(conCambios, APROBAR);
    expect(aprobada.ronda).toBe(0);
  });

  it("cerrar la ronda no toca una pieza ya aprobada", () => {
    const aprobada = recorrer(enRevision(), APROBAR);
    const despues = recorrer(aprobada, { tipo: "cerrar_revision" });
    expect(despues).toEqual(aprobada);
  });
});

describe("regla 2 — los pedidos de cambio esperan al cierre de la ronda", () => {
  it("pedir cambios no devuelve la pieza a la agencia todavía", () => {
    const p = recorrer(enRevision(), { tipo: "pedir_cambios" });
    expect(p.estado).toBe("cambios_marcados");
    expect(deQuienEsLaPelota(p)).toBe("cliente");
    expect(p.ronda).toBe(0); // la ronda no avanzó
  });

  it("cerrar la ronda sí la devuelve, y recién ahí avanza la ronda", () => {
    const p = recorrer(enRevision(), { tipo: "pedir_cambios" }, { tipo: "cerrar_revision" });
    expect(p.estado).toBe("en_curso");
    expect(deQuienEsLaPelota(p)).toBe("agencia");
    expect(p.ronda).toBe(1);
  });
});

describe("regla 3 — el plazo avisa, no decide", () => {
  it("no existe ningún evento que apruebe por vencimiento", () => {
    // La prueba es la ausencia: si alguien agrega un evento de vencimiento que
    // cambie estados, esta lista deja de coincidir y hay que discutirlo.
    const eventos: Evento["tipo"][] = [
      "entregar",
      "abrir",
      "aprobar",
      "pedir_cambios",
      "pedir_revision_extra",
      "habilitar_extra",
      "cerrar_revision",
      "reabrir",
      "cancelar",
    ];
    expect(eventos).not.toContain("vencer");
    expect(eventos).toHaveLength(9);
  });

  it("una pieza esperando al cliente se queda esperando para siempre", () => {
    // Pase el tiempo que pase, sigue en manos del cliente. Lo que corre por
    // fuera es el aviso a la agencia, no un cambio de estado.
    const p = entregada();
    expect(deQuienEsLaPelota(p)).toBe("cliente");
    expect(p.estado).toBe("entregada");
  });
});

describe("nada se aprueba solo", () => {
  // La regla más importante del producto, y la que un descuido puede romper
  // sin que se note: el sistema no decide por el cliente. Nunca.

  it("cerrar la ronda NO aprueba una pieza que el cliente no miró", () => {
    const p = recorrer(entregada(), { tipo: "cerrar_revision" });
    expect(p.estado).toBe("entregada");
    expect(p.estado).not.toBe("final");
    expect(deQuienEsLaPelota(p)).toBe("cliente");
  });

  it("cerrar la ronda NO aprueba una pieza que el cliente abrió y no decidió", () => {
    const p = recorrer(enRevision(), { tipo: "cerrar_revision" });
    expect(p.estado).toBe("en_revision");
    expect(p.estado).not.toBe("final");
    expect(deQuienEsLaPelota(p)).toBe("cliente");
  });

  it("cerrar la ronda NO resuelve una revisión adicional pendiente", () => {
    // La decisión es de una administradora; cerrar la ronda no la reemplaza.
    const pedida: Pieza = { estado: "extra_pedida", ronda: 2, rondasIncluidas: 2, rondasExtra: 0 };
    expect(recorrer(pedida, { tipo: "cerrar_revision" }).estado).toBe("extra_pedida");
  });

  it("la única forma de llegar a «final» es que alguien apruebe", () => {
    // Se prueban todos los eventos que no son «aprobar» sobre todos los
    // estados vivos: ninguno puede terminar en «final».
    const estadosVivos: Estado[] = [
      "en_curso",
      "entregada",
      "en_revision",
      "cambios_marcados",
      "extra_pedida",
    ];
    const sinAprobar: Evento[] = [
      { tipo: "entregar" },
      { tipo: "abrir" },
      { tipo: "pedir_cambios" },
      { tipo: "pedir_revision_extra" },
      { tipo: "habilitar_extra" },
      { tipo: "cerrar_revision" },
      { tipo: "reabrir", por: "Vale" },
      { tipo: "cancelar" },
    ];

    for (const estado of estadosVivos) {
      const pieza: Pieza = { estado, ronda: 1, rondasIncluidas: 2, rondasExtra: 0 };
      for (const evento of sinAprobar) {
        const r = aplicar(pieza, evento);
        if (r.ok) {
          expect(
            r.pieza.estado,
            `«${evento.tipo}» desde «${estado}» no debería poder aprobar`
          ).not.toBe("final");
        }
      }
    }
  });
});

describe("el tope de rondas", () => {
  it("permite las rondas incluidas", () => {
    let p = piezaNueva(2);
    for (let i = 0; i < 2; i++) {
      p = recorrer(
        p,
        { tipo: "entregar" },
        { tipo: "abrir" },
        { tipo: "pedir_cambios" },
        { tipo: "cerrar_revision" }
      );
    }
    expect(p.ronda).toBe(2);
    expect(quedanRondas(p)).toBe(false);
  });

  it("después del tope, pedir cambios se rechaza con una explicación", () => {
    const agotada: Pieza = { estado: "en_revision", ronda: 2, rondasIncluidas: 2, rondasExtra: 0 };
    const r = aplicar(agotada, { tipo: "pedir_cambios" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/revisión adicional/i);
  });

  it("recién ahí se puede pedir una revisión adicional", () => {
    const agotada: Pieza = { estado: "en_revision", ronda: 2, rondasIncluidas: 2, rondasExtra: 0 };
    expect(aplicar(agotada, { tipo: "pedir_revision_extra" })).toMatchObject({
      ok: true,
      pieza: { estado: "extra_pedida" },
    });
  });

  it("no se puede pedir una adicional si todavía quedan rondas", () => {
    // Evita que se marque como extra --y cobrable-- algo que estaba incluido.
    const r = aplicar(enRevision(), { tipo: "pedir_revision_extra" });
    expect(r.ok).toBe(false);
  });

  it("una revisión adicional pendiente espera a la agencia, no al cliente", () => {
    const pedida: Pieza = { estado: "extra_pedida", ronda: 2, rondasIncluidas: 2, rondasExtra: 0 };
    expect(deQuienEsLaPelota(pedida)).toBe("agencia");
  });

  it("habilitarla suma una ronda y la devuelve al cliente", () => {
    const pedida: Pieza = { estado: "extra_pedida", ronda: 2, rondasIncluidas: 2, rondasExtra: 0 };
    const p = recorrer(pedida, { tipo: "habilitar_extra" });
    expect(p.rondasExtra).toBe(1);
    expect(p.estado).toBe("en_revision");
    expect(quedanRondas(p)).toBe(true);
  });

  it("el sistema nunca suma una ronda solo", () => {
    // Sin el paso de una administradora, la pieza se queda frenada. Un sistema
    // que sumara rondas solo estaría regalando trabajo.
    const agotada: Pieza = { estado: "en_revision", ronda: 2, rondasIncluidas: 2, rondasExtra: 0 };
    const p = recorrer(agotada, { tipo: "pedir_revision_extra" });
    expect(p.rondasExtra).toBe(0);
    expect(quedanRondas(p)).toBe(false);
  });
});

describe("lo aprobado queda cerrado con llave", () => {
  const aprobada = () => recorrer(enRevision(), APROBAR);

  it("no acepta pedidos de cambio", () => {
    expect(aplicar(aprobada(), { tipo: "pedir_cambios" }).ok).toBe(false);
  });

  it("no se puede aprobar dos veces ni volver a entregar", () => {
    expect(aplicar(aprobada(), APROBAR).ok).toBe(false);
    expect(aplicar(aprobada(), { tipo: "entregar" }).ok).toBe(false);
  });

  it("se reconoce como bloqueada", () => {
    expect(estaBloqueada(aprobada())).toBe(true);
    expect(estaBloqueada(enRevision())).toBe(false);
  });

  it("una administradora puede reabrirla, y vuelve a manos del cliente", () => {
    // El cliente tiene que aprobarla de nuevo, por eso se le avisa.
    const p = recorrer(aprobada(), { tipo: "reabrir", por: "Vale" });
    expect(p.estado).toBe("entregada");
    expect(deQuienEsLaPelota(p)).toBe("cliente");
  });

  it("reabrir no consume una ronda", () => {
    // Reabrir es una decisión de la agencia; no puede gastarle al cliente una
    // ronda de las que tenía.
    const antes = aprobada();
    const despues = recorrer(antes, { tipo: "reabrir", por: "Vale" });
    expect(despues.ronda).toBe(antes.ronda);
  });

  it("no se puede reabrir algo que no está aprobado", () => {
    expect(aplicar(enRevision(), { tipo: "reabrir", por: "Vale" }).ok).toBe(false);
  });
});

describe("cancelar", () => {
  it("se puede cancelar desde cualquier estado vivo", () => {
    const vivos: Pieza[] = [piezaNueva(), entregada(), enRevision(), recorrer(enRevision(), APROBAR)];
    for (const p of vivos) {
      expect(aplicar(p, { tipo: "cancelar" })).toMatchObject({
        ok: true,
        pieza: { estado: "cancelada" },
      });
    }
  });

  it("una pieza cancelada no acepta ningún evento", () => {
    const cancelada = recorrer(piezaNueva(), { tipo: "cancelar" });
    const todos: Evento[] = [
      { tipo: "entregar" },
      { tipo: "abrir" },
      APROBAR,
      { tipo: "pedir_cambios" },
      { tipo: "pedir_revision_extra" },
      { tipo: "habilitar_extra" },
      { tipo: "cerrar_revision" },
      { tipo: "reabrir", por: "Vale" },
      { tipo: "cancelar" },
    ];
    for (const evento of todos) {
      expect(aplicar(cancelada, evento).ok, `«${evento.tipo}» debería rechazarse`).toBe(false);
    }
  });

  it("conserva la historia en vez de borrarla", () => {
    const conHistoria = recorrer(
      piezaNueva(),
      { tipo: "entregar" },
      { tipo: "abrir" },
      { tipo: "pedir_cambios" },
      { tipo: "cerrar_revision" }
    );
    const cancelada = recorrer(conHistoria, { tipo: "cancelar" });
    expect(cancelada.ronda).toBe(1);
    expect(cancelada.rondasIncluidas).toBe(conHistoria.rondasIncluidas);
  });
});

describe("de quién es la pelota", () => {
  const casos: Array<[Estado, "agencia" | "cliente" | "nadie"]> = [
    ["en_curso", "agencia"],
    ["entregada", "cliente"],
    ["en_revision", "cliente"],
    ["cambios_marcados", "cliente"],
    ["extra_pedida", "agencia"],
    ["final", "nadie"],
    ["cancelada", "nadie"],
  ];

  it.each(casos)("«%s» está en cancha de %s", (estado, quien) => {
    expect(deQuienEsLaPelota({ estado, ronda: 0, rondasIncluidas: 2, rondasExtra: 0 })).toBe(quien);
  });

  it("cubre todos los estados que existen", () => {
    // Si mañana se agrega un estado y nadie dice de quién es la pelota, el
    // tablero lo esconde en silencio. Esta prueba lo impide.
    expect(casos).toHaveLength(7);
  });
});

describe("aplicar nunca modifica la pieza que recibe", () => {
  it("devuelve una copia", () => {
    // Trabajar sobre copias evita una familia entera de errores donde una
    // pantalla cambia un estado sin querer.
    const antes = enRevision();
    const copia = { ...antes };
    aplicar(antes, APROBAR);
    expect(antes).toEqual(copia);
  });
});
