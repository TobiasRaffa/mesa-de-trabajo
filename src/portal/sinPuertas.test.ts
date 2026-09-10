// Que del portal no salga ningún camino hacia administración.
//
// El linter ya impide que el código del portal **importe** algo de
// administración. Esto cubre lo otro, que no es una importación y no lo veía
// nadie: **un link**. Una dirección escrita a mano en un `href` no rompe
// ninguna regla de módulos y sin embargo abre exactamente la puerta que no
// tiene que haber.
//
// Pasó de verdad: la raíz del sitio redirigía a `/diagnostico`, así que un
// cliente que borraba el final de la dirección caía en una pantalla interna
// con las miniaturas de los archivos y el estado de la conexión con Drive.
//
// Esta prueba lee los archivos del portal como texto y busca esas direcciones.
// Es tosca a propósito: no le importa el contexto, y por eso no se le escapa
// un caso que a una regla más lista sí se le escaparía.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(process.cwd(), "src");

/** Las carpetas donde vive todo lo que ve el cliente. */
const DEL_PORTAL = [
  path.join(RAIZ, "portal"),
  path.join(RAIZ, "app", "(portal)"),
  // Lo compartido también: si una pieza de `ui` linkeara a gestión, la
  // arrastraría al portal sin que nadie la mirara.
  path.join(RAIZ, "ui"),
];

/** Las direcciones que solo existen del lado de la agencia. */
const DE_LA_AGENCIA = ["/gestion", "/diagnostico"];

function archivosDe(carpeta: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(carpeta)) {
    const completo = path.join(carpeta, entrada);
    if (statSync(completo).isDirectory()) {
      salida.push(...archivosDe(completo));
    } else if (/\.(ts|tsx)$/.test(entrada) && !entrada.endsWith(".test.ts")) {
      salida.push(completo);
    }
  }
  return salida;
}

describe("el portal no tiene puertas a administración", () => {
  const archivos = DEL_PORTAL.flatMap((c) => archivosDe(c));

  it("encuentra los archivos del portal, así que la prueba mira algo", () => {
    // Sin esto, una carpeta renombrada dejaría la prueba en verde mirando nada.
    expect(archivos.length).toBeGreaterThan(5);
  });

  it.each(DE_LA_AGENCIA)("ningún archivo del portal nombra «%s»", (direccion) => {
    const culpables = archivos.filter((archivo) =>
      readFileSync(archivo, "utf8").includes(direccion)
    );

    expect(
      culpables.map((c) => path.relative(process.cwd(), c)),
      `Estos archivos del portal nombran «${direccion}». El cliente no puede ` +
        `tener ningún camino hacia administración.`
    ).toEqual([]);
  });

  it("la raíz del sitio no lleva a administración", () => {
    // La raíz no está adentro del portal, pero es a donde cae un cliente que
    // borra el final de la dirección. Es la misma puerta.
    const raiz = readFileSync(path.join(RAIZ, "app", "page.tsx"), "utf8");
    for (const direccion of DE_LA_AGENCIA) {
      expect(raiz.includes(`"${direccion}"`)).toBe(false);
    }
  });
});
