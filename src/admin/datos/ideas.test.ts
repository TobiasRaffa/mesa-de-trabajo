// Lo puro de las funciones nuevas: firma del cliente, «hace cuánto», buscar,
// contar una cuenta y escribir el historial como CSV.

import { describe, expect, it } from "vitest";
import { comoFirmaElCliente } from "@/dominio/historia";
import { coincide, normalizarParaBuscar } from "@/dominio/texto";
import { haceCuanto } from "@/lib/fechas";
import { contar } from "@/admin/datos/estadisticas";
import { comoCsv } from "@/admin/datos/historial";
import type { EstadoDePieza } from "@/lib/piezas";

describe("cómo firma el cliente", () => {
  it("con nombre, al lado de la base", () => {
    expect(comoFirmaElCliente("Cliente", "  Juana   Pérez ")).toBe("Cliente · Juana Pérez");
  });

  it("vacío, o «cliente» a secas, es la base sola", () => {
    expect(comoFirmaElCliente("Cliente", "")).toBe("Cliente");
    expect(comoFirmaElCliente("Cliente", undefined)).toBe("Cliente");
    expect(comoFirmaElCliente("Cliente", "cliente")).toBe("Cliente");
  });

  it("no deja pasar un nombre kilométrico", () => {
    expect(comoFirmaElCliente("Cliente", "x".repeat(500)).length).toBeLessThanOrEqual(70);
  });

  it("no se le cree a lo que no es texto", () => {
    expect(comoFirmaElCliente("Cliente", { nombre: "hola" })).toBe("Cliente · [object Object]");
  });
});

describe("hace cuánto", () => {
  const ahora = new Date("2026-09-18T15:00:00-03:00");
  const antes = (ms: number) => new Date(ahora.getTime() - ms).toISOString();

  it("recién, minutos, horas", () => {
    expect(haceCuanto(antes(10_000), ahora)).toBe("recién");
    expect(haceCuanto(antes(5 * 60_000), ahora)).toBe("hace 5 min");
    expect(haceCuanto(antes(3 * 3_600_000), ahora)).toBe("hace 3 h");
  });

  it("ayer y días", () => {
    expect(haceCuanto(antes(26 * 3_600_000), ahora)).toBe("ayer");
    expect(haceCuanto(antes(4 * 86_400_000), ahora)).toBe("hace 4 días");
  });

  it("más de un mes, la fecha", () => {
    // «el 9 ago», con el mes en letras: es el mismo formato que usan el árbol,
    // el tablero y el portal. Antes acá decía «el 9/8» y en las listas «9 ago».
    expect(haceCuanto(antes(40 * 86_400_000), ahora)).toMatch(/^el \d+ \w+$/);
  });

  it("con basura, nada", () => {
    expect(haceCuanto("no es una fecha", ahora)).toBe("");
  });
});

describe("buscar", () => {
  it("sin acentos ni mayúsculas", () => {
    expect(normalizarParaBuscar("  Café   OTOÑO ")).toBe("cafe otono");
    expect(coincide("Café Otoño - Prueba", "otono")).toBe(true);
    expect(coincide("Banners", "logo")).toBe(false);
  });

  it("vacío coincide con todo", () => {
    expect(coincide("lo que sea", "")).toBe(true);
    expect(coincide("lo que sea", "   ")).toBe(true);
  });
});

const pieza = (
  estado: EstadoDePieza["estado"],
  historia: Array<[EstadoDePieza["historia"][number]["que"], string]>,
  rondasExtra = 0
): EstadoDePieza => ({
  carpetaId: "k",
  estado,
  ronda: 0,
  rondasExtra,
  cambios: [],
  enviada: false,
  mudada: false,
  historia: historia.map(([que, cuando], i) => ({ id: String(i), que, quien: "x", cuando })),
});

describe("contar una cuenta", () => {
  it("cuenta piezas, aprobadas, vueltas y extras", () => {
    const numeros = contar([
      { vueltas: 1, estado: pieza("final", []) },
      { vueltas: 3, estado: pieza("en_curso", [], 1) },
      { vueltas: 4, estado: pieza("cancelada", []) },
    ]);
    expect(numeros.piezas).toBe(3);
    expect(numeros.aprobadas).toBe(1);
    expect(numeros.enJuego).toBe(1);
    expect(numeros.vueltasPromedio).toBe(2.7);
    expect(numeros.conMasDeDosVueltas).toBe(2);
    expect(numeros.revisionesExtra).toBe(1);
    expect(numeros.diasParaDecidir).toBeNull();
  });

  it("mide cuánto tarda el cliente en decidir, entrega por entrega", () => {
    const numeros = contar([
      {
        vueltas: 2,
        estado: pieza("final", [
          ["entregada", "2026-09-01T12:00:00Z"],
          ["cambios_pedidos", "2026-09-03T12:00:00Z"],
          ["entregada", "2026-09-05T12:00:00Z"],
          ["aprobada", "2026-09-06T12:00:00Z"],
        ]),
      },
      { vueltas: 1, estado: pieza("entregada", [["entregada", "2026-09-10T12:00:00Z"]]) },
    ]);
    expect(numeros.diasParaDecidir).toBe(1.5);
  });

  it("con nada, todo en cero", () => {
    expect(contar([])).toEqual({
      piezas: 0,
      aprobadas: 0,
      enJuego: 0,
      vueltasPromedio: 0,
      conMasDeDosVueltas: 0,
      revisionesExtra: 0,
      diasParaDecidir: null,
    });
  });
});

describe("el historial como CSV", () => {
  it("con punto y coma, marca de orden y comillas donde hacen falta", () => {
    const csv = comoCsv([
      {
        carpeta: "Banners",
        pieza: 'Logo "grande"; final',
        vueltas: 2,
        estado: "final",
        cuando: "2026-09-01T12:00:00Z",
        que: "Aprobó",
        quien: "Cliente · Juana",
        detalle: "línea uno\nlínea dos",
      },
    ]);
    const lineas = csv.split("\r\n");
    expect(lineas[0]).toBe("﻿Carpeta;Pieza;Vueltas;Estado;Cuándo;Qué pasó;Quién;Detalle");
    expect(lineas[1]).toBe(
      'Banners;"Logo ""grande""; final";2;final;2026-09-01T12:00:00Z;Aprobó;Cliente · Juana;"línea uno\nlínea dos"'
    );
  });
});
