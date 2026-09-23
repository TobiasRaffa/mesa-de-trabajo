// Cómo se juntan los avisos seguidos, con `avisar` de verdad y el almacén en
// memoria: lo que se prueba es lo que queda guardado.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Si la escritura de avisos falla, como cuando Supabase contesta un 503.
const falla = vi.hoisted(() => ({ alGuardar: false }));

vi.mock("@/lib/almacen", async () => {
  const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
  return {
    ...memoriaDePruebas,
    coleccion: <T,>(nombre: string, valido: (v: unknown) => v is T) => {
      const c = memoriaDePruebas.coleccion(nombre, valido);
      return {
        ...c,
        guardarVarios: async (cambios: Record<string, T | undefined>) => {
          if (falla.alGuardar) throw new Error("supabase 503");
          return c.guardarVarios(cambios);
        },
      };
    },
  };
});
vi.mock("@/lib/correo", () => ({
  correoConfigurado: () => false,
  mandarCorreo: async () => ({ estado: "sin_configurar" }),
}));
vi.mock("@/lib/equipo", () => ({
  personaPorId: async () => null,
  quienesRecibenTodo: async () => [],
}));
vi.mock("@/lib/permisos", () => ({ cadenaHasta: async () => [] }));
vi.mock("@/lib/responsables", () => ({ responsablesDe: async () => ({}) }));

const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const { avisar } = await import("@/lib/avisar");
const { losAvisos, marcarVistos } = await import("@/lib/avisos");

const cafe = { clienteId: "c", cliente: "Café" };
const banners = { ...cafe, carpetaId: "k", carpeta: "Banners" };
const stories = { ...cafe, carpetaId: "s", carpeta: "Stories" };

beforeEach(() => {
  memoriaDePruebas.vaciar();
  falla.alGuardar = false;
});

describe("avisar contesta si dejó el aviso anotado", () => {
  it("sí cuando se guardó", async () => {
    expect(await avisar({ clase: "vencio", ...banners, detalle: "la v2 de a" })).toBe(true);
  });

  it("no cuando el almacén falló, sin lanzar", async () => {
    // Quien lo llama —los recordatorios— necesita saberlo para reintentar:
    // `avisar` se traga el error, y sin esto lo daba por mandado.
    falla.alGuardar = true;
    expect(await avisar({ clase: "vencio", ...banners, detalle: "la v2 de a" })).toBe(false);
    expect(await losAvisos()).toEqual([]);
  });
});

describe("la racha cuenta piezas, no toques", () => {
  it("pedir cambios dos veces sobre la misma pieza es una pieza", async () => {
    // Pedir cambios, descartar y volver a pedir decía «2 piezas: la v2 de a y
    // la v2 de a».
    await avisar({ clase: "pidio_cambios", ...banners, detalle: "la v2 de a" });
    await avisar({ clase: "pidio_cambios", ...banners, detalle: "la v2 de a" });

    const [aviso, ...resto] = await losAvisos();
    expect(resto).toEqual([]);
    expect(aviso.texto).toBe("Pidió cambios en la v2 de a de Banners.");
    expect(aviso.veces ?? 1).toBe(1);
    expect(aviso.piezas).toEqual(["la v2 de a"]);
  });

  it("una pieza distinta sí se suma", async () => {
    await avisar({ clase: "aprobo", ...banners, detalle: "a" });
    await avisar({ clase: "aprobo", ...banners, detalle: "b" });
    await avisar({ clase: "aprobo", ...banners, detalle: "a" });

    const [aviso] = await losAvisos();
    expect(aviso.texto).toBe("Aprobó 2 piezas en Banners: a y b.");
    expect(aviso.veces).toBe(2);
  });

  it("los mensajes siguen contando cada uno", async () => {
    await avisar({ clase: "escribio", ...banners });
    await avisar({ clase: "escribio", ...banners });
    const [aviso] = await losAvisos();
    expect(aviso.texto).toBe("Escribió 2 mensajes en la conversación.");
  });
});

describe("la racha parte de lo guardado", () => {
  it("mensajes simultáneos no se pisan la cuenta", async () => {
    // Cada uno leía el aviso, sumaba uno a su copia y la escribía: tres a la
    // vez guardaban «2 mensajes» en lugar de 4.
    await avisar({ clase: "escribio", ...banners });
    await Promise.all([
      avisar({ clase: "escribio", ...banners }),
      avisar({ clase: "escribio", ...banners }),
      avisar({ clase: "escribio", ...banners }),
    ]);

    const todos = await losAvisos();
    expect(todos).toHaveLength(1);
    expect(todos[0].veces).toBe(4);
    expect(todos[0].texto).toBe("Escribió 4 mensajes en la conversación.");
  });

  it("si alguien lo vio entre la lectura y la escritura, lo nuevo es otro aviso", async () => {
    await avisar({ clase: "escribio", ...banners });
    const [primero] = await losAvisos();

    // Nari abre la campana justo mientras llega el segundo mensaje: la marca
    // entra después de que `avisar` leyó el aviso y antes de que lo reescriba.
    const llega = avisar({ clase: "escribio", ...banners });
    await marcarVistos([primero.id], "nari");
    await llega;

    const todos = await losAvisos();
    expect(todos).toHaveLength(2);
    const visto = todos.find((a) => a.id === primero.id)!;
    expect(visto.veces ?? 1).toBe(1);
    expect(visto.texto).toBe("Escribió en la conversación.");
  });
});

describe("la racha es por carpeta", () => {
  it("alternar carpetas no corta la de cada una", async () => {
    // Revisar dos trabajos en paralelo mandaba un correo por aprobación: el
    // aviso de Stories tapaba al de Banners y el tercero no lo encontraba.
    await avisar({ clase: "aprobo", ...banners, detalle: "x" });
    await avisar({ clase: "aprobo", ...stories, detalle: "y" });
    await avisar({ clase: "aprobo", ...banners, detalle: "z" });

    const textos = (await losAvisos()).map((a) => a.texto).sort();
    expect(textos).toEqual(["Aprobó 2 piezas en Banners: x y z.", "Aprobó y en Stories."]);
  });
});
