import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Las acciones del servidor no hacen falta para ver cómo se arma el
// formulario, y cargarlas arrastra la base y la sesión.
vi.mock("@/app/(admin)/gestion/acciones", () => ({
  cambiarCliente: vi.fn(),
  cambiarVerEnDrive: vi.fn(),
  ponerTelefonoDeCliente: vi.fn(),
  renovarLinkDeCliente: vi.fn(),
}));

const { ConfiguracionDeCliente } = await import("@/admin/ConfiguracionDeCliente");

/** El `<form …>` que contiene el campo con ese nombre. */
function formularioCon(html: string, campo: string): string {
  const donde = html.indexOf(`name="${campo}"`);
  const abre = html.lastIndexOf("<form", donde);
  return html.slice(abre, html.indexOf(">", abre) + 1);
}

describe("un error al guardar no borra lo que se escribió", () => {
  // React vacía todo formulario que se manda con `<form action>`, salga bien
  // o salga mal. Con un error del servidor, el teléfono que se estaba
  // corrigiendo volvía al viejo debajo del mensaje que decía qué estaba mal.
  // Un formulario que React maneja así se dibuja con un `action` propio.
  it("el teléfono no se manda por la acción del formulario", () => {
    const html = renderToStaticMarkup(
      createElement(ConfiguracionDeCliente, {
        cliente: {
          id: "c1",
          nombre: "Café",
          token: "abc",
          habilitado: true,
          telefono: "+54 9 11 5555-5555",
          responsable: null,
          dias: undefined,
          verEnDrive: false,
        } as never,
        equipo: [],
        alGuardar: () => {},
      })
    );

    expect(formularioCon(html, "telefono")).not.toContain("action=");
  });
});
