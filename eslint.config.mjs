import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Las fronteras que no se pueden cruzar, y por qué cada una existe.
 *
 * **Ojo con cómo se arma esto.** `no-restricted-imports` no se suma entre
 * bloques: para un archivo que cae en dos, gana el último y el primero
 * desaparece sin decir nada. Ya pasó —la regla de Drive, que abarca todo
 * `src/`, dejó muda a la frontera portal↔administración durante días—.
 *
 * Por eso cada ámbito de acá abajo declara **todo lo que le corresponde**,
 * aunque se repita. Repetir es feo; que un guardián no atrape es peor, porque
 * da tranquilidad falsa.
 *
 * Y por eso mismo estas reglas no son la única defensa: `cimientos.test.ts`
 * revisa lo mismo leyendo el texto de los archivos, sin depender de cómo
 * ESLint resuelve empates.
 */

// El portal es lo que ve el cliente; administración, lo que ve la agencia.
// Comparten datos a través del almacén, no llamándose funciones: así un
// descuido en una pantalla del portal no puede terminar leyendo la cobranza.
const NADA_DE_ADMIN = {
  group: ["@/admin", "@/admin/*", "**/admin/*"],
  message:
    "El portal no puede importar nada de administración. Si hace falta compartir algo, va en src/dominio (reglas) o src/lib (plomería).",
};

const NADA_DEL_PORTAL = {
  group: ["@/portal", "@/portal/*", "**/portal/*"],
  message:
    "Administración no puede importar nada del portal. Si hace falta compartir algo, va en src/dominio (reglas) o src/lib (plomería).",
};

// `archivosDe` le pregunta a Drive qué hay en una carpeta. Es verdad sobre
// Drive y mentira sobre el trabajo: aprobar muda el archivo a «Entregas
// finales», así que las piezas aprobadas desaparecen de esa respuesta.
//
// Se coló en cinco lugares distintos, de a uno por vez, y cada uno rompía algo
// diferente. La pregunta correcta es `piezasDeLaCarpeta`, y para que sea
// también la fácil de escribir, la otra queda prohibida salvo donde se envuelve.
const NADA_DE_DRIVE_CRUDO = {
  name: "@/lib/google",
  importNames: ["archivosDe", "listarCarpeta"],
  message:
    "Usá piezasDeLaCarpeta() de @/lib/piezas. archivosDe le pregunta a Drive, y Drive no lista las piezas ya aprobadas: se mudaron a «Entregas finales».",
};

// Dónde se guardan las cosas es asunto de un solo lugar. Antes, once módulos
// repetían la misma plomería —leer, parsear, validar, escribir a un temporal,
// renombrar— y la duodécima vez es donde se olvida un detalle.
//
// También es lo que hace posible mudarse a Supabase cambiando una línea: si
// alguien vuelve a escribir un archivo por su cuenta, ese dato se queda en la
// computadora el día del despliegue y nadie se entera hasta que falta.
const NADA_DE_DISCO = [
  {
    name: "node:fs/promises",
    message:
      "Usá coleccion() o documento() de @/lib/almacen. Escribir archivos a mano no funciona en internet: en Netlify el disco es de solo lectura y se borra en cada despliegue.",
  },
  {
    name: "node:fs",
    message: "Usá coleccion() o documento() de @/lib/almacen.",
  },
];

/** Arma la regla entera de una sola vez, que es la única forma de que sume. */
const prohibir = ({ paths = [], patterns = [] }) => ({
  "no-restricted-imports": ["error", { paths, patterns }],
});

const TODO = [NADA_DE_DRIVE_CRUDO, ...NADA_DE_DISCO];

const frontera = [
  { files: ["src/**/*.{ts,tsx}"], rules: prohibir({ paths: TODO }) },

  {
    files: ["src/portal/**/*.{ts,tsx}", "src/app/(portal)/**/*.{ts,tsx}"],
    rules: prohibir({ paths: TODO, patterns: [NADA_DE_ADMIN] }),
  },
  {
    files: ["src/admin/**/*.{ts,tsx}", "src/app/(admin)/**/*.{ts,tsx}"],
    rules: prohibir({ paths: TODO, patterns: [NADA_DEL_PORTAL] }),
  },

  {
    // El dominio es el corazón: no depende de nada de afuera. Si necesitara
    // Drive o el almacén, dejaría de ser probable sin infraestructura, que es
    // todo su valor. No hace falta prohibirle lo demás: ya no puede tocar lib.
    files: ["src/dominio/**/*.ts"],
    rules: prohibir({
      patterns: [
        {
          group: ["@/portal*", "@/admin*", "@/lib*", "**/portal/*", "**/admin/*", "**/lib/*"],
          message:
            "El dominio no depende de nada: ni de pantallas, ni de la base de datos, ni de Drive. Si necesitás algo de afuera, pasalo como parámetro.",
        },
      ],
    }),
  },

  // Los dos únicos lugares que pueden preguntarle a Drive en crudo: uno es el
  // que habla con Drive, el otro el que envuelve la respuesta.
  {
    files: ["src/lib/piezas.ts", "src/lib/google.ts"],
    rules: prohibir({ paths: NADA_DE_DISCO }),
  },

  // Y el único que puede tocar el disco es el que abstrae dónde se guarda.
  {
    files: ["src/lib/almacen/**/*.ts"],
    rules: prohibir({ paths: [NADA_DE_DRIVE_CRUDO] }),
  },

  // Las pruebas sí leen archivos: varias revisan el código fuente como texto.
  // Eso corre en la computadora de quien programa, nunca en el servidor.
  {
    files: ["src/**/*.test.{ts,tsx}"],
    rules: prohibir({ paths: [NADA_DE_DRIVE_CRUDO] }),
  },
  {
    files: ["src/portal/**/*.test.{ts,tsx}"],
    rules: prohibir({ paths: [NADA_DE_DRIVE_CRUDO], patterns: [NADA_DE_ADMIN] }),
  },
  {
    files: ["src/admin/**/*.test.{ts,tsx}"],
    rules: prohibir({ paths: [NADA_DE_DRIVE_CRUDO], patterns: [NADA_DEL_PORTAL] }),
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
  // `.claude/worktrees`: copias temporales del repositorio que crean las
  // herramientas para trabajar en paralelo; mirarlas sería revisar todo dos veces.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".claude/worktrees/**"]),
]);

export default eslintConfig;
