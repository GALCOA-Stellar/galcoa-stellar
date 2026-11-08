// Lógica pura de la extensión (sin DOM): toma lo que hay escrito en un formulario, lo evalúa con el
// MISMO motor de reglas de la app (src/lib/dominio/rules.ts) y dice qué estado le toca a cada campo.
// No hace pedidos de red y no guarda nada. La IA no interviene: deciden las reglas en código.
import { evaluar, type Evaluacion, type Gravedad } from "../../src/lib/dominio/rules";

export type EstadoCampo = "verde" | "amarillo" | "rojo";
export type ResultadoCampo = { estado: EstadoCampo; motivos: string[] };

/** Campos de una entrega que la extensión sabe revisar (por el atributo `name` del input). */
export const CAMPOS = [
  "remito", "producto", "unidad", "cantidadPedida", "cantidadRecibida", "fechaEntrega", "fechaRegistro",
  "cargadoPor", "confirmadoPor", "evidenciaHash", "observacion",
] as const;
const OBLIGATORIOS = ["remito", "producto", "unidad", "cantidadPedida", "cantidadRecibida", "fechaEntrega", "fechaRegistro", "cargadoPor", "confirmadoPor"];
const NUMERICOS = new Set(["cantidadPedida", "cantidadRecibida"]);

/** Qué campos señala cada regla cuando falla. Si una regla no figura, no marca ningún campo. */
const CAMPOS_POR_REGLA: Record<string, readonly string[]> = {
  "ALC-LEG-01": CAMPOS,
  "ALC-ATR-01": ["cargadoPor", "confirmadoPor"],
  "ALC-COH-01": ["fechaEntrega", "fechaRegistro"],
  "ALC-CTE-01": ["fechaRegistro"],
  "ALC-ORI-01": ["evidenciaHash"],
  "ALC-EXA-01": ["cantidadPedida", "cantidadRecibida"],
};

/** Convierte los textos del formulario en la entrada que espera el motor de reglas. */
export function aEntrada(valores: Record<string, string>): Record<string, unknown> {
  const entrada: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valores)) {
    const t = v.trim();
    if (t === "") continue;
    entrada[k] = NUMERICOS.has(k) && /^\d+$/.test(t) ? Number(t) : t;
  }
  return entrada;
}

const peor = (a: EstadoCampo, b: EstadoCampo): EstadoCampo => (a === "rojo" || b === "rojo" ? "rojo" : a === "amarillo" || b === "amarillo" ? "amarillo" : "verde");
const estadoDe = (g: Gravedad): EstadoCampo => (g === "critica" ? "rojo" : "amarillo");

/**
 * Evalúa el formulario completo y devuelve el veredicto del motor y el estado de cada campo presente.
 * `valores` trae solo los campos que existen en la página (nombre -> texto escrito).
 */
export function evaluarFormulario(valores: Record<string, string>): { evaluacion: Evaluacion; campos: Record<string, ResultadoCampo> } {
  const entrada = aEntrada(valores);
  const evaluacion = evaluar(entrada);
  const presentes = Object.keys(valores).filter((k) => (CAMPOS as readonly string[]).includes(k));
  const campos: Record<string, ResultadoCampo> = Object.fromEntries(presentes.map((k) => [k, { estado: "verde" as EstadoCampo, motivos: [] }]));
  const marcar = (campo: string, estado: EstadoCampo, motivo: string) => {
    const c = campos[campo];
    if (!c) return;
    c.estado = peor(c.estado, estado);
    c.motivos.push(motivo);
  };

  for (const r of evaluacion.reglas) {
    if (r.ok) continue;
    if (r.id === "ALC-COM-01") {
      for (const k of OBLIGATORIOS) if (entrada[k] === undefined) marcar(k, "rojo", `${r.id}: falta este dato`);
      continue;
    }
    for (const k of CAMPOS_POR_REGLA[r.id] ?? []) marcar(k, estadoDe(r.gravedad), `${r.id}: ${r.detalle}`);
  }
  return { evaluacion, campos };
}
