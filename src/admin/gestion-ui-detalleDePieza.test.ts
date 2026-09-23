import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { DetalleDePieza } from "@/admin/DetalleDePieza";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";

// DetalleDePieza no es de cliente y no usa hooks: se lo puede llamar como una
// función y mirar lo que devuelve, sin navegador.
describe("los cambios de cada vuelta, en pantalla", () => {
  it("una vuelta revisada dos veces no repite la clave", () => {
    // «Entregar esta» vuelve a entregar la misma vuelta, y el cliente puede
    // mandar otra revisión sobre ella. Con la versión como clave, React tenía
    // tres hermanos con la misma y podía reusar el bloque de otra vuelta.
    const pieza = {
      id: "p1",
      nombre: "Banner",
      estado: "cambios_marcados",
      enviada: false,
      cambios: [{ texto: "letra más grande" }],
      comentarios: [],
      historia: [
        { que: "entregada" },
        { que: "revision_enviada", detalle: "V1: 1) Fondo azul" },
        { que: "entregada" },
        { que: "revision_enviada", detalle: "V1: 1) Ahora rojo" },
      ],
    } as unknown as PiezaConHistoria;

    const arbol = DetalleDePieza({ pieza, version: 1 }) as ReactElement<{
      children: unknown[];
    }>;
    const bloques = arbol.props.children[0] as ReactElement[];
    const claves = bloques.map((b) => b.key);

    expect(claves).toHaveLength(3);
    expect(new Set(claves).size).toBe(3);
  });
});
