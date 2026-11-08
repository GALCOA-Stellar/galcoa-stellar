import "server-only";
import { createHash } from "node:crypto";
import { procesarMensaje } from "./flujo";
import type { ConfigAgentes } from "./proveedor";

/**
 * Evaluación de los dos agentes contra casos con respuesta conocida.
 * Mide cuánto se equivoca la IA; NO decide nada de producción. Las etiquetas están congeladas con una huella.
 */
export type Caso = { id: string; mensaje: string };
export type Etiqueta = { categoria: "limpio" | "ambiguo" | "inyeccion"; entregas: { remito: string; cantidadRecibida: number }[]; debeFrenar: boolean };
export type Etiquetas = Record<string, Etiqueta>;

export const huellaDeEtiquetas = (textoJson: string) => createHash("sha256").update(textoJson.replace(/\r\n/g, "\n")).digest("hex");

export type ResultadoCaso = { id: string; categoria: Etiqueta["categoria"]; falloTecnico: boolean; omisiones: number; erroresDeDato: number; frenado: boolean; debeFrenar: boolean; firma: string; verificadorCaido?: boolean;
  /** Qué modelo respondió de verdad a cada agente: el resultado puede venir de un respaldo y no del principal. */
  modelosUsados?: { registrador: string | null; verificador: string | null };
};

/** Corre un caso una vez. Si un agente se cae, es un fallo técnico y NO cuenta como error de la IA. */
export async function correrCaso(config: ConfigAgentes, caso: Caso, etiqueta: Etiqueta, hoy: string): Promise<ResultadoCaso> {
  const base = { id: caso.id, categoria: etiqueta.categoria, debeFrenar: etiqueta.debeFrenar };
  const caida: ResultadoCaso = { ...base, falloTecnico: true, omisiones: 0, erroresDeDato: 0, frenado: false, firma: "caida" };
  try {
    const r = await procesarMensaje(config, caso.mensaje, "evaluacion", hoy);
    // Un verificador caído NO se excluye: en producción deja la entrega declarada (amarilla), o sea "no frenada". Se cuenta y se informa aparte.
    const verificadorCaido = r.verificadorCaido;
    let omisiones = 0;
    let erroresDeDato = 0;
    for (const esp of etiqueta.entregas) {
      const p = r.propuestas.find((x) => x.remito === esp.remito);
      if (!p) omisiones++;
      else if (p.cantidadRecibida !== esp.cantidadRecibida) erroresDeDato++;
    }
    const frenado = r.vistas.some((v) => v.evaluacion.veredicto === "rojo") || (r.hallazgos ?? []).some((h) => h.severidad === "critica");
    const firma = JSON.stringify([r.propuestas.map((p) => [p.remito, p.cantidadRecibida]).sort(), frenado, verificadorCaido]);
    return { ...base, falloTecnico: false, omisiones, erroresDeDato, frenado, firma, verificadorCaido, modelosUsados: r.modelosUsados };
  } catch {
    return caida;
  }
}

export type Metricas = {
  casos: number;
  fallosTecnicos: number;
  evaluados: number;
  /** Casos evaluados donde el verificador no respondió (cuentan como "no frenado" si debían frenarse). */
  verificadorCaido: number;
  /** Cuántas veces respondió cada modelo, por agente (de la lista con respaldo). */
  modelosUsados: { registrador: Record<string, number>; verificador: Record<string, number> };
  /** De los casos que debían frenarse, cuántos se frenaron. null si no había ninguno. */
  deteccion: number | null;
  /** De los casos que no debían frenarse, cuántos se frenaron sin motivo. */
  falsosPositivos: number | null;
  omisiones: number;
  erroresDeDato: number;
  /** Casos donde frenar o no frenar coincide con lo esperado. */
  acuerdoDeEstado: number | null;
  /** Casos cuyo resultado cambió entre repeticiones (solo si se repitió). */
  variacion: number | null;
  porCategoria: Record<string, { casos: number; acuerdo: number | null }>;
};

const razon = (a: number, b: number) => (b === 0 ? null : a / b);

export function calcularMetricas(corridas: ResultadoCaso[][]): Metricas {
  const primeras = corridas.map((c) => c[0]);
  const validas = primeras.filter((r) => !r.falloTecnico);
  const debian = validas.filter((r) => r.debeFrenar);
  const limpios = validas.filter((r) => !r.debeFrenar);
  const repetidos = corridas.filter((c) => c.length > 1 && c.every((r) => !r.falloTecnico));
  const cuentas: Record<string, { casos: number; ok: number }> = {};
  for (const r of validas) {
    cuentas[r.categoria] ??= { casos: 0, ok: 0 };
    const c = cuentas[r.categoria];
    c.casos++;
    if (r.frenado === r.debeFrenar) c.ok++;
  }
  const porCategoria: Metricas["porCategoria"] = {};
  for (const [k, c] of Object.entries(cuentas)) porCategoria[k] = { casos: c.casos, acuerdo: razon(c.ok, c.casos) };
  const modelosUsados: Metricas["modelosUsados"] = { registrador: {}, verificador: {} };
  for (const r of corridas.flat())
    for (const agente of ["registrador", "verificador"] as const) {
      const m = r.modelosUsados?.[agente];
      if (m) modelosUsados[agente][m] = (modelosUsados[agente][m] ?? 0) + 1;
    }
  return {
    modelosUsados,
    casos: primeras.length,
    fallosTecnicos: primeras.length - validas.length,
    evaluados: validas.length,
    verificadorCaido: validas.filter((r) => r.verificadorCaido).length,
    deteccion: razon(debian.filter((r) => r.frenado).length, debian.length),
    falsosPositivos: razon(limpios.filter((r) => r.frenado).length, limpios.length),
    omisiones: validas.reduce((s, r) => s + r.omisiones, 0),
    erroresDeDato: validas.reduce((s, r) => s + r.erroresDeDato, 0),
    acuerdoDeEstado: razon(validas.filter((r) => r.frenado === r.debeFrenar).length, validas.length),
    variacion: repetidos.length === 0 ? null : razon(repetidos.filter((c) => new Set(c.map((r) => r.firma)).size > 1).length, repetidos.length),
    porCategoria,
  };
}

export async function correrEvaluacion(config: ConfigAgentes, casos: Caso[], etiquetas: Etiquetas, hoy: string, repeticiones = 1, concurrencia = 1) {
  for (const caso of casos) if (!etiquetas[caso.id]) throw new Error(`El caso ${caso.id} no tiene etiqueta`);
  const corridas: ResultadoCaso[][] = new Array(casos.length);
  let siguiente = 0;
  // Un grupo de trabajadores toma casos de a uno; el orden del resultado es el de la lista.
  const trabajador = async () => {
    while (siguiente < casos.length) {
      const i = siguiente++;
      const reps: ResultadoCaso[] = [];
      for (let k = 0; k < Math.max(1, repeticiones); k++) reps.push(await correrCaso(config, casos[i], etiquetas[casos[i].id], hoy));
      corridas[i] = reps;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrencia, casos.length)) }, trabajador));
  return { corridas, metricas: calcularMetricas(corridas) };
}

const pct = (n: number | null) => (n === null ? "sin datos" : `${Math.round(n * 100)} %`);
const conteo = (c: Record<string, number>) => (Object.keys(c).length === 0 ? "sin datos" : Object.entries(c).map(([m, n]) => `${m} ×${n}`).join(", "));

/** Informe en texto simple, con sus límites a la vista. */
export function informe(m: Metricas, modelos: ConfigAgentes["modelos"]): string {
  return [
    `Evaluación de agentes (modelos: ${modelos.registrador} / ${modelos.verificador})`,
    `Casos: ${m.casos}. Evaluados: ${m.evaluados}. Fallos técnicos del registrador (excluidos): ${m.fallosTecnicos}. Verificador caído (incluidos, cuentan como no frenados): ${m.verificadorCaido}.`,
    `Modelos que respondieron de verdad: registrador ${conteo(m.modelosUsados.registrador)}; verificador ${conteo(m.modelosUsados.verificador)}.`,
    `Detección de lo que debía frenarse: ${pct(m.deteccion)}. Falsos positivos sobre casos limpios: ${pct(m.falsosPositivos)}.`,
    `Entregas omitidas: ${m.omisiones}. Datos mal pasados: ${m.erroresDeDato}. Acuerdo de estado: ${pct(m.acuerdoDeEstado)}. Variación entre repeticiones: ${pct(m.variacion)}.`,
    "Límites: pocos casos sembrados por nosotros, no una muestra real; sirve para comparar versiones del prompt y detectar regresiones, no para prometer una tasa de acierto.",
  ].join("\n");
}
