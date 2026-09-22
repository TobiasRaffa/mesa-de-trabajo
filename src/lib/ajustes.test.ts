import { beforeEach, describe, expect, it, vi } from "vitest";

// El almacén compartido en memoria: cumple el contrato entero —`cambiar`
// incluido— así que lo que pasa acá dice algo de lo que va a pasar de verdad.
const { memoriaDePruebas } = await import("@/lib/almacen/enMemoria");
const guardado = memoriaDePruebas.ver("ajustes");
vi.mock("@/lib/almacen", async () => (await import("@/lib/almacen/enMemoria")).memoriaDePruebas);

const { ajustesDe, cambiarAjustesDe, mostrarUOcultar, linkDeCarpeta } = await import(
  "@/lib/ajustes"
);

const CARPETA = "carpeta-1";

beforeEach(() => {
  for (const k of Object.keys(guardado)) delete guardado[k];
});

describe("cambiar un ajuste no se lleva puesto el resto", () => {
  it("apagar una carpeta conserva su link", async () => {
    // El link se genera y queda guardado.
    const token = await linkDeCarpeta(CARPETA);
    expect(token).not.toBe("");

    // Apagarla no puede borrarlo: el cliente que ya tiene ese link sigue
    // entrando. Era el agujero: `guardarAjustesDe` pisaba el documento entero
    // desde una foto vieja que no incluía el token recién creado.
    await mostrarUOcultar(CARPETA, false);

    const despues = await ajustesDe(CARPETA);
    expect(despues.token).toBe(token);
    expect(despues.visible).toBe(false);
  });

  it("generar el link después de apagar conserva el apagado", async () => {
    await mostrarUOcultar(CARPETA, false);
    await linkDeCarpeta(CARPETA);

    const despues = await ajustesDe(CARPETA);
    expect(despues.visible).toBe(false);
    expect(despues.token).not.toBe("");
  });

  it("cambiar la vista conserva token y visibilidad", async () => {
    const token = await linkDeCarpeta(CARPETA);
    await mostrarUOcultar(CARPETA, false);

    await cambiarAjustesDe(CARPETA, { vista: "calendario" });

    const despues = await ajustesDe(CARPETA);
    expect(despues.vista).toBe("calendario");
    expect(despues.token).toBe(token);
    expect(despues.visible).toBe(false);
  });
});
