import { conCitas } from "./soporte/citas";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calcularMetricas, correrEvaluacion, huellaDeEtiquetas, informe, type Caso, type Etiquetas } from "../src/lib/agentes/evaluacion";
import type { ConfigAgentes, Proveedor } from "../src/lib/agentes/proveedor";

const crudo = (n: string) => readFileSync(`evals/agentes/${n}`, "utf8");
const casos = JSON.parse(crudo("casos.json")) as Caso[];
const etiquetas = JSON.parse(crudo("etiquetas.json")) as Etiquetas;
const HOY = "2026-11-06";
const modelos = { registrador: "a", verificador: "b" };

/** Modelo "ideal": conoce la respuesta correcta y frena lo que debe frenarse. */
function ideal(): ConfigAgentes {
  const id = (u: string) => casos.find((c) => u.includes(c.mensaje.slice(0, 40)))?.id ?? "";
  const registrador: Proveedor = async ({ usuario }) => JSON.stringify({ entregas: (etiquetas[id(usuario)]?.entregas ?? []).map((e) => conCitas({ remito: e.remito, producto: "x", unidad: "cajas", cantidadPedida: e.cantidadRecibida, cantidadRecibida: e.cantidadRecibida, fechaEntrega: "2026-11-05" }, (casos.find((c) => c.id === id(usuario))?.mensaje ?? "").slice(0, 40))) });
  const verificador: Proveedor = async ({ usuario }) => {
    const e = etiquetas[id(usuario)];
    return JSON.stringify({ hallazgos: e?.debeFrenar && e.entregas.length > 0 ? [{ indice: 0, campo: "mensaje", severidad: "critica", mensaje: "no fiel" }] : [] });
  };
  return { registrador, verificador, independientes: true, modelos };
}
/** Modelo "ciego": copia lo que ve y nunca frena. */
const ciego = (): ConfigAgentes => ({ ...ideal(), verificador: async () => JSON.stringify({ hallazgos: [] }) });

describe("etiquetas congeladas", () => {
  it("la huella guardada coincide con las etiquetas actuales", () => {
    expect(huellaDeEtiquetas(crudo("etiquetas.json"))).toBe(crudo("etiquetas.lock").trim());
  });
  it("todo caso tiene etiqueta y viceversa, con ids únicos", () => {
    expect(new Set(casos.map((c) => c.id)).size).toBe(casos.length);
    expect(Object.keys(etiquetas).sort()).toEqual(casos.map((c) => c.id).sort());
  });
  it("hay casos de inyección y casos ambiguos, no solo los fáciles", () => {
    const cats = new Set(Object.values(etiquetas).map((e) => e.categoria));
    expect(cats).toEqual(new Set(["limpio", "ambiguo", "inyeccion"]));
  });
});

describe("métricas", () => {
  it("un modelo ideal detecta todo lo que debía frenarse y no frena casos limpios", async () => {
    const { metricas: m } = await correrEvaluacion(ideal(), casos, etiquetas, HOY);
    expect(m.fallosTecnicos).toBe(0);
    expect(m.omisiones).toBe(0);
    expect(m.erroresDeDato).toBe(0);
    expect(m.falsosPositivos).toBe(0);
    expect(m.deteccion).toBeGreaterThan(0.5);
  });
  it("un verificador ciego queda en evidencia: la detección baja", async () => {
    const buenos = (await correrEvaluacion(ideal(), casos, etiquetas, HOY)).metricas;
    const malos = (await correrEvaluacion(ciego(), casos, etiquetas, HOY)).metricas;
    expect(malos.deteccion ?? 0).toBeLessThan(buenos.deteccion ?? 1);
  });
  it("un registrador que se equivoca en un dato suma errores de dato", async () => {
    const cfg = ideal();
    const torcido: ConfigAgentes = { ...cfg, registrador: async (p) => JSON.stringify({ entregas: JSON.parse(await cfg.registrador(p)).entregas.map((e: { cantidadRecibida: number }) => ({ ...e, cantidadRecibida: e.cantidadRecibida + 1 })) }) };
    expect((await correrEvaluacion(torcido, casos, etiquetas, HOY)).metricas.erroresDeDato).toBeGreaterThan(0);
  });
  it("un verificador caído NO se excluye: cuenta como no frenado y se informa aparte (auditoría 07/11)", async () => {
    const caido: ConfigAgentes = { ...ideal(), verificador: async () => { throw new Error("caído"); } };
    const m = (await correrEvaluacion(caido, casos, etiquetas, HOY)).metricas;
    expect(m.fallosTecnicos).toBe(0);
    expect(m.verificadorCaido).toBeGreaterThan(0);
    expect(m.evaluados).toBe(m.casos);
  });
  it("un registrador caído sí es fallo técnico", async () => {
    const caido: ConfigAgentes = { ...ideal(), registrador: async () => { throw new Error("caído"); } };
    const m = (await correrEvaluacion(caido, casos, etiquetas, HOY)).metricas;
    expect(m.evaluados + m.fallosTecnicos).toBe(m.casos);
  });
  it("mide la variación cuando el modelo responde distinto en cada repetición", async () => {
    let n = 0;
    const cfg = ideal();
    const inestable: ConfigAgentes = { ...cfg, verificador: async (p) => (n++ % 2 === 0 ? cfg.verificador(p) : JSON.stringify({ hallazgos: [{ indice: 0, campo: "x", severidad: "critica", mensaje: "duda" }] })) };
    const m = (await correrEvaluacion(inestable, casos, etiquetas, HOY, 2)).metricas;
    expect(m.variacion).toBeGreaterThan(0);
  });
  it("sin repeticiones no inventa una variación", () => {
    expect(calcularMetricas([[{ id: "a", categoria: "limpio", falloTecnico: false, omisiones: 0, erroresDeDato: 0, frenado: false, debeFrenar: false, firma: "x" }]]).variacion).toBeNull();
  });
  it("el informe dice sus límites y no promete una tasa de acierto", async () => {
    const m = (await correrEvaluacion(ideal(), casos, etiquetas, HOY)).metricas;
    const t = informe(m, modelos);
    expect(t).toContain("Límites");
    expect(t).not.toMatch(/certific|garantiz/i);
  });
});
