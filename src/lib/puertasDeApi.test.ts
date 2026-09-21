// Qué rol entra por cada ruta de `/api`.
//
// **Era la única puerta de la aplicación por la que los roles no pasaban.** El
// `proxy` separa por sección mirando la dirección, y su matcher cubre
// `/gestion` y `/diagnostico` pero nunca incluyó `/api`: cualquier sesión de
// gestión valía lo mismo en las cuatro rutas. Alguien dado de alta para
// facturar —con el alcance «todos», que es el que pone el alta— se bajaba con
// `GET /api/historial/<cliente>` el CSV completo de piezas, entregas,
// aprobaciones y pedidos de cambio: justo lo que la sección «Clientes» guarda.
//
// Acá se prueba la decisión, que es lo nuestro: las rutas se limitan a pasarle
// su `Puerta` a estas dos funciones y a contestar 404 con el `null`.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const { quienLleva, clientesHabilitados, entradaDe, entroAlCliente } = vi.hoisted(() => ({
  quienLleva: vi.fn(),
  clientesHabilitados: vi.fn(),
  entradaDe: vi.fn(),
  entroAlCliente: vi.fn(),
}));

vi.mock("@/lib/sesion", () => ({ quienLleva }));
vi.mock("@/lib/clientes", () => ({ clientesHabilitados }));
vi.mock("@/lib/acceso", () => ({ entradaDe, entroAlCliente }));
vi.mock("@/lib/google", () => ({
  metadatosArchivo: vi.fn(),
  alOlvidarDrive: () => {},
}));

import { quienPideDe, quienPideEn, type Puerta } from "@/lib/permisos";
import { seccionesDe, type Rol } from "@/dominio/roles";

const GALLETAS = { get: () => ({ value: "una-galleta" }) };
const SIN_GALLETAS = { get: () => undefined };

const CLIENTE = "cliente-uno";
const OTRO = "cliente-dos";

/** Alguien del equipo con ese rol, que llega a todos los clientes. */
function comoAgencia(rol: Rol, clientes: "todos" | string[] = "todos") {
  quienLleva.mockResolvedValue({
    persona: { id: "p", nombre: "Alguien", correo: "a@b.c", rol },
    secciones: seccionesDe(rol),
    clientes,
  });
  clientesHabilitados.mockResolvedValue([{ id: CLIENTE }, { id: OTRO }]);
  entradaDe.mockResolvedValue(null);
}

/** Alguien que entró por el link del portal de un cliente. */
function comoCliente(raiz = CLIENTE) {
  quienLleva.mockResolvedValue(null);
  entradaDe.mockResolvedValue({ cliente: { id: raiz }, carpeta: undefined });
  entroAlCliente.mockImplementation(async (id: string) => id === raiz);
}

beforeEach(() => {
  vi.clearAllMocks();
  quienLleva.mockResolvedValue(null);
  entradaDe.mockResolvedValue(null);
  clientesHabilitados.mockResolvedValue([{ id: CLIENTE }, { id: OTRO }]);
});

// Las puertas de verdad, copiadas de cada ruta.
const DEL_ARCHIVO: Puerta = { agencia: ["clientes", "tablero", "facturas"], cliente: true };
const DEL_HISTORIAL: Puerta = { agencia: ["clientes"], cliente: false };
const DE_LA_CONVERSACION: Puerta = { agencia: null, cliente: true };

describe("las puertas de acá son las de las rutas", () => {
  // Copiadas a mano, se despegan: alguien abre una sección en la ruta y las
  // pruebas siguen midiendo la puerta vieja, en verde. Se leen del archivo.
  const laDeLaRuta = (ruta: string) => {
    const fuente = readFileSync(
      path.join(process.cwd(), "src", "app", "api", ruta, "route.ts"),
      "utf8"
    );
    const m = fuente.match(/const PUERTA: Puerta = (\{[^}]*\});/);
    if (!m) throw new Error(`${ruta} no declara su PUERTA`);
    return m[1].replace(/\s+/g, " ").trim();
  };

  /** La puerta escrita como se escribe en la ruta, para comparar textos. */
  const comoTexto = (p: Puerta) => {
    const agencia = p.agencia ? `[${p.agencia.map((s) => `"${s}"`).join(", ")}]` : "null";
    return `{ agencia: ${agencia}, cliente: ${p.cliente} }`;
  };

  it.each([
    ["archivo/[fileId]", DEL_ARCHIVO],
    ["miniatura/[fileId]", DEL_ARCHIVO],
    ["historial/[clienteId]", DEL_HISTORIAL],
    ["conversacion/[clienteId]", DE_LA_CONVERSACION],
  ])("%s", (ruta, puerta) => {
    expect(laDeLaRuta(ruta as string)).toBe(comoTexto(puerta as Puerta));
  });
});

describe("sin galleta no entra nadie", () => {
  it("ni por la puerta más abierta", async () => {
    expect(await quienPideEn(SIN_GALLETAS, DEL_ARCHIVO)).toBeNull();
  });
});

describe("el historial es de la sección Clientes", () => {
  it("quien lleva clientes se lo baja", async () => {
    comoAgencia("diseno");
    expect(await quienPideDe(CLIENTE, GALLETAS, DEL_HISTORIAL)).not.toBeNull();
  });

  it("**quien solo factura, no**", async () => {
    comoAgencia("facturacion");

    expect(
      await quienPideDe(CLIENTE, GALLETAS, DEL_HISTORIAL),
      "Es el agujero que tuvo esto: alcance «todos» y ninguna sección de por " +
        "medio, así que Facturación se bajaba la historia entera de un cliente."
    ).toBeNull();
  });

  it("tampoco de un cliente que no lleva, aunque la sección le toque", async () => {
    comoAgencia("diseno", [CLIENTE]);
    expect(await quienPideDe(OTRO, GALLETAS, DEL_HISTORIAL)).toBeNull();
  });

  it("y el cliente no baja el historial ni siquiera del suyo", async () => {
    comoCliente(CLIENTE);
    expect(await quienPideDe(CLIENTE, GALLETAS, DEL_HISTORIAL)).toBeNull();
  });
});

describe("la conversación por la ruta es solo del cliente", () => {
  it("el cliente lee la suya", async () => {
    comoCliente(CLIENTE);
    expect(await quienPideDe(CLIENTE, GALLETAS, DE_LA_CONVERSACION)).not.toBeNull();
  });

  it("y no la de otro cambiando el identificador", async () => {
    comoCliente(CLIENTE);
    expect(await quienPideDe(OTRO, GALLETAS, DE_LA_CONVERSACION)).toBeNull();
  });

  it("la agencia no entra por acá, ni siendo Administración", async () => {
    comoAgencia("admin");

    expect(
      await quienPideDe(CLIENTE, GALLETAS, DE_LA_CONVERSACION),
      "Del lado de la agencia el chat va por una acción, que además lo marca " +
        "leído. Una segunda puerta a lo mismo es un segundo criterio."
    ).toBeNull();
  });
});

describe("los archivos: quien tiene dónde abrirlos", () => {
  it("entra el cliente", async () => {
    comoCliente(CLIENTE);
    expect(await quienPideEn(GALLETAS, DEL_ARCHIVO)).not.toBeNull();
  });

  it.each(["diseno", "facturacion", "admin"] as const)("entra %s", async (rol) => {
    comoAgencia(rol);
    expect(await quienPideEn(GALLETAS, DEL_ARCHIVO)).not.toBeNull();
  });

  it("no entra quien solo mira el diagnóstico", async () => {
    // El rol `personalizado` no da nada por sí mismo: lo que ve sale de sus
    // sueltas. Con una sola suelta que no abre archivos, no abre archivos.
    quienLleva.mockResolvedValue({
      persona: { id: "p", nombre: "Alguien", correo: "a@b.c", rol: "personalizado" },
      secciones: seccionesDe("personalizado", ["diagnostico"]),
      clientes: "todos" as const,
    });

    expect(await quienPideEn(GALLETAS, DEL_ARCHIVO)).toBeNull();
  });

  it("las raíces son las de su alcance, no las de todos", async () => {
    comoAgencia("diseno", [CLIENTE]);

    const quien = await quienPideEn(GALLETAS, DEL_ARCHIVO);

    expect(quien?.tipo).toBe("agencia");
    expect(quien?.tipo === "agencia" && quien.raices).toEqual([CLIENTE]);
  });
});

describe("una puerta cerrada para la agencia lo está para todos sus roles", () => {
  it.each(["admin", "diseno", "facturacion", "personalizado"] as const)(
    "%s no entra donde agencia es null",
    async (rol) => {
      comoAgencia(rol);
      expect(await quienPideEn(GALLETAS, { agencia: null, cliente: true })).toBeNull();
    }
  );
});
