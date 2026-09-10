import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * La frontera entre el portal y la administración.
 *
 * No es una convención que haya que recordar: si alguien la cruza, no compila.
 *
 *   src/portal/  lo que ve el cliente
 *   src/admin/   lo que ve la agencia
 *   src/dominio/ las reglas del negocio, sin lados
 *   src/lib/     plomería (Drive, entorno), sin lados
 *
 * Los dos mundos pueden usar `dominio` y `lib`. Lo que no pueden es tocarse
 * entre ellos. Comparten información a través de la base de datos, no
 * llamándose funciones.
 *
 * Existe para que un descuido en una pantalla del portal no pueda, ni por
 * accidente, terminar leyendo datos de otro cliente o del panel de cobranza.
 */
const frontera = [
  {
    files: ["src/portal/**/*.{ts,tsx}", "src/app/(portal)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/admin", "@/admin/*", "**/admin/*"],
              message:
                "El portal no puede importar nada de administración. Si hace falta compartir algo, va en src/dominio (reglas) o src/lib (plomería).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/admin/**/*.{ts,tsx}", "src/app/(admin)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/portal", "@/portal/*", "**/portal/*"],
              message:
                "Administración no puede importar nada del portal. Si hace falta compartir algo, va en src/dominio (reglas) o src/lib (plomería).",
            },
          ],
        },
      ],
    },
  },
  {
    // `archivosDe` le pregunta a Drive qué hay en una carpeta. Es verdad sobre
    // Drive y mentira sobre el trabajo: aprobar muda el archivo a «Entregas
    // finales», así que las piezas aprobadas desaparecen de esa respuesta.
    //
    // Se coló en cinco lugares distintos, de a uno por vez, y cada uno rompía
    // algo diferente. La pregunta correcta es `piezasDeLaCarpeta`, y para que
    // sea también la fácil de escribir, la otra queda prohibida en todos lados
    // menos donde se la envuelve.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/piezas.ts", "src/lib/google.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/google",
              importNames: ["archivosDe", "listarCarpeta"],
              message:
                "Usá piezasDeLaCarpeta() de @/lib/piezas. archivosDe le pregunta a Drive, y Drive no lista las piezas ya aprobadas: se mudaron a «Entregas finales».",
            },
          ],
        },
      ],
    },
  },
  {
    // El dominio es el corazón: no puede depender de nada de afuera.
    // Si necesitara Drive o la base de datos, dejaría de ser probable
    // sin infraestructura, que es todo su valor.
    files: ["src/dominio/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/portal*", "@/admin*", "@/lib*", "**/portal/*", "**/admin/*", "**/lib/*"],
              message:
                "El dominio no depende de nada: ni de pantallas, ni de la base de datos, ni de Drive. Si necesitás algo de afuera, pasalo como parámetro.",
            },
          ],
        },
      ],
    },
  },
];

// Un parámetro que empieza con guion bajo se declara a propósito y no se usa:
// es la forma de decir "esto va acá porque la firma lo pide".
const nombresSinUsar = [
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...nombresSinUsar,
  ...frontera,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
