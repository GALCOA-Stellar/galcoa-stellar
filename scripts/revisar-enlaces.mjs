// Revisa que los enlaces relativos de los .md apunten a archivos que existen. Uso: node scripts/revisar-enlaces.mjs [carpeta-raiz]
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
const raiz = path.resolve(process.argv[2] || ".");
const archivos = execSync("git ls-files '*.md'", { cwd: raiz, encoding: "utf8" }).split("\n").filter(Boolean);
let rotos = 0;
for (const f of archivos) {
  const t = readFileSync(path.join(raiz, f), "utf8").replace(/```[\s\S]*?```/g, "");
  for (const m of t.matchAll(/\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g)) {
    if (/^(https?:|mailto:|\/)/.test(m[1])) continue;
    if (!existsSync(path.join(raiz, path.dirname(f), m[1]))) { console.log(`${f}: ${m[1]}`); rotos++; }
  }
}
console.log(rotos ? `${rotos} enlaces rotos` : "Sin enlaces rotos");
process.exit(rotos ? 1 : 0);
