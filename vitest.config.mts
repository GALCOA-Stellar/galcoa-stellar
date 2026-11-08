import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
    // Cobertura de la lógica (src/lib): lo que decide, firma y verifica. Las pantallas se prueban en e2e.
    coverage: { provider: "v8", include: ["src/lib/**/*.ts"], reporter: ["text-summary", "json-summary"], reportsDirectory: "coverage" },
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
