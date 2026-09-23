// Lo que `google.ts` le pide a Drive y lo que se acuerda de la respuesta.
//
// Drive se reemplaza por un `fetch` de mentira que contesta según la
// dirección: lo que se prueba es qué se pide, qué se recuerda y qué se olvida,
// no la conexión con Google.

import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La llave es de verdad porque el token se firma de verdad; lo que no existe es
// Google del otro lado.
const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const LLAVE = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

vi.mock("@/lib/entorno", () => ({
  credencialesDeGoogle: () => ({ email: "robot@prueba.iam", llave: LLAVE }),
}));

import {
  comentariosDeArchivo,
  leerComentarios,
  subcarpetasDe,
  metadatosArchivo,
  moverArchivo,
  olvidarDrive,
  renombrarArchivo,
} from "@/lib/google";

type Contestar = (url: string, init?: RequestInit) => Promise<Response> | Response;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Los pedidos a Drive que se hicieron, sin contar los del token. */
let pedidos: Array<{ url: string; metodo: string }> = [];

function conDrive(contestar: Contestar) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (entrada: string | URL, init?: RequestInit) => {
      const url = String(entrada);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return json({ access_token: "token-de-prueba" });
      }
      pedidos.push({ url, metodo: init?.method ?? "GET" });
      return contestar(url, init);
    })
  );
}

const aDrive = (parte: string) => pedidos.filter((p) => p.url.includes(parte));

beforeEach(() => {
  pedidos = [];
  olvidarDrive();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lo que está en la papelera de Drive", () => {
  it("se pide si está en la papelera, y se devuelve", async () => {
    // `files.get` contesta 200 por un archivo en la papelera, y con sus
    // carpetas madre intactas: si no se pregunta, no hay forma de saberlo.
    conDrive(() =>
      json({ id: "f1", name: "boceto.pdf", mimeType: "application/pdf", parents: ["t"], trashed: true })
    );

    const datos = await metadatosArchivo("f1");

    expect(decodeURIComponent(aDrive("/files/f1")[0].url)).toContain("trashed");
    expect(datos.trashed).toBe(true);
  });
});

describe("lo que la aplicación cambia en Drive se ve enseguida", () => {
  // Un listado que sale **mientras** el PATCH está en viaje trae el estado
  // viejo, y la memoria lo guardaba medio minuto: la aplicación contradecía lo
  // que acababa de hacer.
  function conPatchColgado() {
    let soltar!: () => void;
    const suelto = new Promise<void>((r) => (soltar = r));
    let movido = false;

    conDrive(async (url, init) => {
      if (init?.method === "PATCH") {
        await suelto;
        movido = true;
        return json({ id: "f1", name: "nuevo.pdf", parents: ["B"] });
      }
      if (url.includes("/files?q=")) {
        return json({ files: movido ? [] : [{ id: "f1", name: "viejo.pdf", mimeType: "application/pdf" }] });
      }
      return json({});
    });

    return { soltar };
  }

  it("mover: lo leído durante el PATCH no queda recordado", async () => {
    const { soltar } = conPatchColgado();

    const moviendo = moverArchivo("f1", "A", "B");
    // Alguien más mira la carpeta mientras tanto: todavía está ahí.
    expect((await subcarpetasDe("A")).map((a) => a.id)).toEqual(["f1"]);

    soltar();
    await moviendo;

    expect((await subcarpetasDe("A")).map((a) => a.id)).toEqual([]);
  });

  it("renombrar: tampoco", async () => {
    const { soltar } = conPatchColgado();

    const renombrando = renombrarArchivo("f1", "nuevo.pdf");
    await subcarpetasDe("A");

    soltar();
    await renombrando;

    await subcarpetasDe("A");
    expect(aDrive("/files?q=")).toHaveLength(2);
  });
});

describe("los comentarios de un archivo", () => {
  const crudo = (id: string) => ({ id, content: `texto ${id}`, author: { displayName: "Marina" } });

  it("un fallo de Drive no queda recordado como «no hay comentarios»", async () => {
    let primera = true;
    conDrive(() => {
      if (primera) {
        primera = false;
        return json({ error: { message: "demasiados pedidos" } }, 429);
      }
      return json({ comments: [crudo("c1")] });
    });

    // El fallo se dice como fallo: no es una lista vacía.
    expect(await comentariosDeArchivo("f1")).toBeNull();
    // Y la vez siguiente se vuelve a preguntar.
    expect((await comentariosDeArchivo("f1"))?.map((c) => c.id)).toEqual(["c1"]);
  });

  it("lo que se leyó bien sí se recuerda", async () => {
    conDrive(() => json({ comments: [crudo("c1")] }));

    await comentariosDeArchivo("f1");
    await comentariosDeArchivo("f1");

    expect(aDrive("/comments")).toHaveLength(1);
  });

  it("se leen todas las páginas, no solo las primeras cien", async () => {
    // Cien es el máximo que Drive da por página. Un PDF largo, muy comentado,
    // perdía en silencio todo lo que pasara de ahí.
    conDrive((url) => {
      if (url.includes("pageToken=p2")) return json({ comments: [crudo("c101")] });
      return json({
        comments: Array.from({ length: 100 }, (_, i) => crudo(`c${i + 1}`)),
        nextPageToken: "p2",
      });
    });

    const r = await leerComentarios("f1");

    expect(r.ok && r.comentarios).toHaveLength(101);
    expect(decodeURIComponent(aDrive("/comments")[0].url)).toContain("nextPageToken");
  });

  it("si una página falla, falla todo", async () => {
    // Media lista presentada como la lista entera es la misma mentira que
    // cortar en cien.
    conDrive((url) => {
      if (url.includes("pageToken=p2")) return json({ error: { message: "se cayó" } }, 503);
      return json({ comments: [crudo("c1")], nextPageToken: "p2" });
    });

    expect((await leerComentarios("f1")).ok).toBe(false);
  });
});
