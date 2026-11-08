import type { Evaluacion, Regla } from "./rules";

/**
 * ALC-EVI-01 (Original, sin reutilización): la misma huella de evidencia no puede respaldar
 * dos entregas distintas del mismo lote. Reusar una foto o un PDF para dos remitos es el truco más común.
 * Es determinista y no usa IA. No prueba que la foto sea auténtica: solo detecta que se repitió.
 * Límite conocido: compara dentro del lote enviado, no contra lotes anteriores.
 */
export const REGLA_EVIDENCIA_REPETIDA = "ALC-EVI-01";

/** Devuelve las evaluaciones con la regla agregada; las que comparten huella quedan en rojo. */
export function marcarEvidenciaRepetida(evaluaciones: Evaluacion[]): Evaluacion[] {
  const cuenta = new Map<string, number>();
  for (const ev of evaluaciones) {
    const h = ev.documento?.evidenciaHash;
    if (h) cuenta.set(h, (cuenta.get(h) ?? 0) + 1);
  }
  return evaluaciones.map((ev) => {
    const h = ev.documento?.evidenciaHash;
    if (!h) return ev;
    const repetida = (cuenta.get(h) ?? 0) > 1;
    const r: Regla = {
      id: REGLA_EVIDENCIA_REPETIDA,
      atributo: "Original",
      ok: !repetida,
      gravedad: "critica",
      detalle: repetida ? "La misma evidencia respalda más de una entrega del lote: requiere revisión" : "Evidencia no repetida en el lote",
    };
    return { ...ev, reglas: [...ev.reglas, r], veredicto: repetida ? "rojo" : ev.veredicto };
  });
}
