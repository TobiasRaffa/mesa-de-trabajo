import { describe, expect, it } from "vitest";
import {
  aplicar,
  deQuienEsLaPelota,
  esperaAlCliente,
  estaBloqueada,
  hayAlgoParaEntregar,
  piezaNueva,
  quedanRondas,
  sigueEnJuego,
  yaSeEntrego,
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

describe("descartar un pedido de cambios", () => {
  it("deja la pieza sin decidir, no aprobada", () => {
    // Descartar lo que escribí no es lo mismo que decir que está bien.
    const conCambios = recorrer(enRevision(), { tipo: "pedir_cambios" });
    const p = recorrer(conCambios, { tipo: "descartar_cambios" });
    expect(p.estado).toBe("en_revision");
    expect(p.estado).not.toBe("final");
  });

  it("no consume una ronda", () => {
    const conCambios = recorrer(enRevision(), { tipo: "pedir_cambios" });
    expect(recorrer(conCambios, { tipo: "descartar_cambios" }).ronda).toBe(0);
  });

  it("después de descartar se puede volver a decidir cualquier cosa", () => {
    const vuelta = recorrer(
      enRevision(),
      { tipo: "pedir_cambios" },
      { tipo: "descartar_cambios" }
    );
    expect(aplicar(vuelta, APROBAR).ok).toBe(true);
    expect(aplicar(vuelta, { tipo: "pedir_cambios" }).ok).toBe(true);
  });

  it("no se puede descartar donde no hay nada pedido", () => {
    expect(aplicar(enRevision(), { tipo: "descartar_cambios" }).ok).toBe(false);
    expect(aplicar(entregada(), { tipo: "descartar_cambios" }).ok).toBe(false);
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
      "descartar_cambios",
      "pedir_revision_extra",
      "habilitar_extra",
      "cerrar_revision",
      "reabrir",
      "cancelar",
    ];
    expect(eventos).not.toContain("vencer");
    expect(eventos).toHaveLength(10);
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
      { tipo: "descartar_cambios" },
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
      { tipo: "descartar_cambios" },
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

describe("sigue en juego", () => {
  // Lo que cuenta el tablero como trabajo pendiente. Una aprobada no cuenta:
  // ya está en «Entregas finales» y no espera a nadie.
  const casos: [Estado, boolean][] = [
    ["en_curso", true],
    ["entregada", true],
    ["en_revision", true],
    ["cambios_marcados", true],
    ["extra_pedida", true],
    ["final", false],
    ["cancelada", false],
  ];

  it.each(casos)("«%s» %s", (estado, esperado) => {
    expect(sigueEnJuego(estado)).toBe(esperado);
  });

  it("cubre todos los estados que existen", () => {
    // Un estado nuevo que nadie clasifique se contaría como pendiente sin que
    // nadie lo haya decidido, y el tablero pediría trabajo que no existe.
    expect(casos).toHaveLength(7);
  });
});

describe("hay algo para entregar", () => {
  // La pieza vuelve a nosotros cuando el cliente manda sus cambios, y ahí la
  // aplicación ofrecía entregarla de nuevo en el acto: le mandaba al cliente el
  // mismo archivo que acababa de devolver, sin una línea cambiada.
  //
  // La pregunta se contesta comparando **la versión que hay contra la que se
  // le entregó**. Se comparaba contra la ronda, y eso vale solo mientras las
  // versiones vayan una por ronda: con una de más, volvía el mismo error.

  it("el original recién subido, sin entregar nada todavía", () => {
    expect(hayAlgoParaEntregar("en_curso", 1, undefined)).toBe(true);
  });

  it("devuelta con cambios y sin vuelta nueva, no", () => {
    expect(hayAlgoParaEntregar("en_curso", 1, 1)).toBe(false);
  });

  it("con la V2 arriba, sí", () => {
    expect(hayAlgoParaEntregar("en_curso", 2, 1)).toBe(true);
  });

  it("y una vez entregada la V2, otra vez no", () => {
    expect(hayAlgoParaEntregar("en_curso", 2, 2)).toBe(false);
  });

  it("sobrarle versiones al historial no la hace entregable", () => {
    // **Es el caso que rompía.** Una pieza que volvió a empezar conserva sus
    // archivos: cuatro vueltas en Drive y una ronda. Contra la ronda daba «hay
    // algo para entregar» al segundo siguiente de que el cliente devolviera la
    // última, y lo que se le mandaba era ese mismo archivo.
    expect(hayAlgoParaEntregar("en_curso", 5, 5)).toBe(false);
  });

  it("los saltos de numeración no la confunden", () => {
    // «V2» y después «V5», sin V3 ni V4: son dos vueltas, no cinco, y lo único
    // que importa es que la de arriba sea más alta que la entregada.
    expect(hayAlgoParaEntregar("en_curso", 5, 2)).toBe(true);
  });

  it("lo que ya está del lado del cliente no se entrega de nuevo", () => {
    // Aunque sobren versiones: ya la tiene.
    expect(hayAlgoParaEntregar("entregada", 3, undefined)).toBe(false);
    expect(hayAlgoParaEntregar("en_revision", 5, 1)).toBe(false);
    expect(hayAlgoParaEntregar("cambios_marcados", 5, 1)).toBe(false);
    expect(hayAlgoParaEntregar("final", 2, undefined)).toBe(false);
  });

  it("una carpeta sin archivos no tiene nada que entregar", () => {
    expect(hayAlgoParaEntregar("en_curso", 0, undefined)).toBe(false);
  });
});

describe("cerrar la revisión no toca lo que no cambió", () => {
  // El dominio contesta que sí para una aprobada o una que espera revisión
  // adicional, y devuelve **la misma pieza**. Quien llama tiene que poder
  // notarlo: si lo toma como «se envió», marca enviada una pieza que no mandó
  // nada, y la que esperaba la revisión adicional queda sin salida —la agencia
  // se la habilita y el cliente no tiene con qué usarla—.
  it("una pieza esperando revisión adicional vuelve igual", () => {
    const antes: Pieza = {
      estado: "extra_pedida",
      ronda: 2,
      rondasIncluidas: 2,
      rondasExtra: 0,
    };
    const r = aplicar(antes, { tipo: "cerrar_revision" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pieza.estado).toBe(antes.estado);
      expect(r.pieza.ronda).toBe(antes.ronda);
    }
  });

  it("una aprobada vuelve igual", () => {
    const antes: Pieza = { estado: "final", ronda: 1, rondasIncluidas: 2, rondasExtra: 0 };
    const r = aplicar(antes, { tipo: "cerrar_revision" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pieza.estado).toBe("final");
  });

  it("una con cambios marcados sí cambia: vuelve al equipo y gasta una vuelta", () => {
    const antes: Pieza = {
      estado: "cambios_marcados",
      ronda: 0,
      rondasIncluidas: 2,
      rondasExtra: 0,
    };
    const r = aplicar(antes, { tipo: "cerrar_revision" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pieza.estado).toBe("en_curso");
      expect(r.pieza.ronda).toBe(1);
    }
  });
});

describe("ya se entregó", () => {
  it("aprobada y sin la vuelta entregada en la carpeta: se la llevaron a finales", () => {
    // Se entregó la V6; en la carpeta quedó hasta la V4.
    expect(yaSeEntrego("final", 6, [1, 2, 3, 4])).toBe(true);
  });

  it("aprobada con la vuelta entregada todavía ahí: sigue en Aprobado", () => {
    expect(yaSeEntrego("final", 6, [4, 6])).toBe(false);
    expect(yaSeEntrego("final", 6, [4, 6, 7])).toBe(false);
  });

  it("se fue la entregada aunque después hayan subido una más alta", () => {
    // **Comparaba con la vuelta más alta que quedaba**, y no con si la
    // entregada seguía: aprobada la V2, se sube una V3 de exportación y la V2
    // se lleva a «Entregas finales». Quedan V1 y V3, la V2 no está, y la pieza
    // se quedaba para siempre en «Aprobado» contando como pendiente.
    expect(yaSeEntrego("final", 2, [1, 3])).toBe(true);
  });

  it("sin saber qué vuelta se entregó, no se adivina", () => {
    expect(yaSeEntrego("final", undefined, [1])).toBe(false);
  });

  it("solo una aprobada puede estar entregada", () => {
    const otros: Estado[] = ["en_curso", "entregada", "en_revision", "cambios_marcados", "extra_pedida", "cancelada"];
    for (const estado of otros) expect(yaSeEntrego(estado, 6, [1, 2, 3, 4])).toBe(false);
  });
});

describe("un evento que no existe no rompe nada", () => {
  it("un tipo desconocido devuelve un «no», no undefined", () => {
    // **Defensa contra el tipo que miente.** El `switch` cubre todos los
    // `Evento` de verdad, pero acá llega lo que arma un pedido a mano: un
    // `tipo` heredado de `Object.prototype` —«constructor», «toString»— o
    // cualquier string suelto. Sin el `default`, `aplicar` devolvía `undefined`
    // y quien la llama reventaba al leer `.ok`. Ahora contesta que no.
    for (const tipo of ["constructor", "toString", "__proto__", "valueOf", "xyz", ""]) {
      const r = aplicar(piezaNueva(), { tipo } as unknown as Evento);
      expect(r, `tipo «${tipo}»`).toBeDefined();
      expect(r.ok).toBe(false);
    }
  });
});

describe("esperaAlCliente", () => {
  it("los cambios que el cliente escribió y no mandó siguen siendo suyos", () => {
    // El caso que caía en «Aprobado» en el tablero.
    expect(esperaAlCliente({ estado: "cambios_marcados", enviada: false })).toBe(true);
    expect(esperaAlCliente({ estado: "cambios_marcados", enviada: true })).toBe(false);
  });

  it("entregada y en revisión esperan al cliente; lo nuestro y lo cerrado, no", () => {
    expect(esperaAlCliente({ estado: "entregada", enviada: false })).toBe(true);
    expect(esperaAlCliente({ estado: "en_revision", enviada: false })).toBe(true);
    for (const estado of ["en_curso", "extra_pedida", "final", "cancelada"] as const) {
      expect(esperaAlCliente({ estado, enviada: false })).toBe(false);
    }
  });
});
