import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { correrEvaluacion, informe, type Caso, type Etiquetas } from "../src/lib/agentes/evaluacion";
import { proveedoresDesdeEntorno, type Proveedor } from "../src/lib/agentes/proveedor";

/**
 * Corre la evaluación con los modelos REALES. Solo si se pide: EVALUAR_REAL=1 npx vitest run tests/evaluacion-real.test.ts
 * Usa únicamente los casos inventados de evals/agentes/ (sin datos de personas) y escribe docs/evidencia/EVALUACION-AGENTES.md.
 */
function cargarEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* sin archivo */ }
  return env;
}

/** Los modelos gratuitos se saturan: espera entre pedidos y reintenta con pausa creciente, para no confundir saturación con falla. */
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
function conReintento(p: Proveedor): Proveedor {
  return async (x) => {
    let ultimo: unknown;
    for (let i = 0; i < 5; i++) {
      try { const r = await p(x); await esperar(2000); return r; } catch (e) { ultimo = e; await esperar(15000 * (i + 1)); }
    }
    throw ultimo;
  };
}

describe.skipIf(!process.env.EVALUAR_REAL)("evaluación con modelos reales", () => {
  it("mide a los agentes y deja el informe", async () => {
    const base = proveedoresDesdeEntorno({ ...cargarEnv(), ...process.env });
    const config = base && { ...base, registrador: conReintento(base.registrador), verificador: conReintento(base.verificador) };
    expect(config).not.toBeNull();
    const casos = JSON.parse(readFileSync("evals/agentes/casos.json", "utf8")) as Caso[];
    const etiquetas = JSON.parse(readFileSync("evals/agentes/etiquetas.json", "utf8")) as Etiquetas;
    const hoy = new Date().toISOString().slice(0, 10);
    const { corridas, metricas } = await correrEvaluacion(config!, casos, etiquetas, hoy, 2, 1);
    const filas = corridas.map((c) => `| ${c[0].id} | ${c[0].categoria} | ${c[0].debeFrenar ? "sí" : "no"} | ${c.map((r) => (r.falloTecnico ? "caída" : r.frenado ? "frenó" : "pasó")).join(" / ")} | ${c[0].omisiones} | ${c[0].erroresDeDato} |`);
    writeFileSync("docs/evidencia/EVALUACION-AGENTES.md", [
      "# Evaluación de los agentes con modelos reales", "",
      `Fecha: ${hoy}. Casos inventados de \`evals/agentes/\` (${casos.length} casos, 2 repeticiones cada uno). Sin datos de personas.`, "",
      "```", informe(metricas, config!.modelos), "```", "",
      "| Caso | Categoría | Debía frenarse | Resultado (rep. 1 / rep. 2) | Omisiones | Datos mal pasados |", "|---|---|---|---|---|---|", ...filas, "",
      "Esto mide a la IA con pocos casos nuestros; sirve para comparar versiones del prompt, no para prometer una tasa de acierto. Las reglas en código siguen decidiendo el veredicto.",
    ].join("\n"));
    console.log(informe(metricas, config!.modelos));
  }, 6000000);
});
