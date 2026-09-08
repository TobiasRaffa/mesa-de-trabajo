import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resuelve los alias del proyecto ("@/lib/...") leyendo tsconfig.json,
    // igual que hace Next.
    tsconfigPaths: true,
  },
  test: {
    // Por ahora todo lo que probamos corre en el servidor. Cuando haya
    // componentes que probar se agrega un entorno de navegador aparte.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
