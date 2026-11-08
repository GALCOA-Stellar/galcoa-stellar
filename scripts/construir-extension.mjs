// Arma extension/dist/contenido.js (un solo archivo) desde extension/src/contenido.ts.
// Usa Vite, que ya está instalado como dependencia de Vitest. Uso: npm run extension:construir
import { build } from "vite";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
await build({
  root: raiz,
  configFile: false,
  publicDir: false, // si no, Vite copia la carpeta public/ de la app dentro de la extensión
  logLevel: "warn",
  build: {
    outDir: "extension/dist",
    emptyOutDir: true,
    minify: false,
    lib: { entry: "extension/src/contenido.ts", formats: ["iife"], name: "galcoaExtension", fileName: () => "contenido.js" },
  },
});
console.log("Listo: extension/dist/contenido.js");
