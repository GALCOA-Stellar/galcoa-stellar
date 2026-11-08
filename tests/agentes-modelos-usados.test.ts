import { describe, expect, it } from "vitest";
import { procesarMensaje } from "../src/lib/agentes/flujo";
import { calcularMetricas, informe, type ResultadoCaso } from "../src/lib/agentes/evaluacion";
import type { ConfigAgentes, Proveedor } from "../src/lib/agentes/proveedor";

const una = { remito: "R-1", producto: "Aceite", unidad: "cajas", cantidadPedida: 10, cantidadRecibida: 10, fechaEntrega: "2026-11-05" };
// Simula un proveedor con respaldo: responde "el segundo modelo" de la lista y lo avisa.
const respondeCon = (modelo: string, o: unknown): Proveedor => async (p) => { p.alResponder?.(modelo); return JSON.stringify(o); };

describe("qué modelo respondió de verdad", () => {
  it("el flujo informa el modelo que respondió a cada agente, no solo la lista configurada", async () => {
    const config: ConfigAgentes = { registrador: respondeCon("gemini:respaldo", { entregas: [una] }), verificador: respondeCon("groq:principal", { hallazgos: [] }), independientes: true, modelos: { registrador: "gemini:principal,gemini:respaldo", verificador: "groq:principal" } };
    const r = await procesarMensaje(config, "R-1 llegaron 10 cajas de aceite", "ana", "2026-11-06");
    expect(r.modelosUsados).toEqual({ registrador: "gemini:respaldo", verificador: "groq:principal" });
  });

  it("si un agente no avisa (o no respondió), queda en null en vez de inventar uno", async () => {
    const fijo = (o: unknown): Proveedor => async () => JSON.stringify(o);
    const r = await procesarMensaje({ registrador: fijo({ entregas: [] }), verificador: fijo({ hallazgos: [] }), independientes: true, modelos: { registrador: "a", verificador: "b" } }, "nada", "ana", "2026-11-06");
    expect(r.modelosUsados).toEqual({ registrador: null, verificador: null });
  });

  it("la evaluación cuenta cuántas veces respondió cada modelo y lo muestra en el informe", () => {
    const caso = (registrador: string): ResultadoCaso => ({ id: registrador, categoria: "limpio", falloTecnico: false, omisiones: 0, erroresDeDato: 0, frenado: false, debeFrenar: false, firma: "x", modelosUsados: { registrador, verificador: "groq:v" } });
    const m = calcularMetricas([[caso("gemini:a")], [caso("gemini:a")], [caso("gemini:b")]]);
    expect(m.modelosUsados).toEqual({ registrador: { "gemini:a": 2, "gemini:b": 1 }, verificador: { "groq:v": 3 } });
    expect(informe(m, { registrador: "x", verificador: "y" })).toContain("registrador gemini:a ×2, gemini:b ×1");
  });
});
