import { evaluar } from "../../src/lib/rules";
import { CASOS, type Caso } from "./casos";

export type Fallo = { caso: string; conjunto: Caso["conjunto"]; motivo: string };
export type Metricas = {
  total: number;
  /** De los documentos con error sembrado (esperado ≠ verde): cuántos se frenaron o marcaron como corresponde. */
  sensibilidad: number;
  /** De los documentos correctos (esperado = verde): cuántos pasaron sin falsa alarma. */
  especificidad: number;
  /** Veredicto exacto y reglas esperadas, sobre todos los casos. */
  exactitud: number;
  fallos: Fallo[];
};

function juzgar(c: Caso): string | null {
  const ev = evaluar(c.entrada);
  if (ev.veredicto !== c.esperado) return `veredicto ${ev.veredicto}, se esperaba ${c.esperado}`;
  const fallan = ev.reglas.filter((r) => !r.ok).map((r) => r.id);
  const faltan = c.fallan.filter((id) => !fallan.includes(id));
  if (faltan.length) return `no marcó ${faltan.join(", ")}`;
  const demas = c.nombre.startsWith("limpio") && fallan.length ? `marcó ${fallan.join(", ")} en un caso limpio` : null;
  return demas;
}

export function medir(conjunto?: Caso["conjunto"]): Metricas {
  const casos = CASOS.filter((c) => !conjunto || c.conjunto === conjunto);
  const resultados = casos.map((c) => ({ c, falla: juzgar(c) }));
  const razon = (xs: typeof resultados) => (xs.length ? xs.filter((x) => x.falla === null).length / xs.length : 1);
  return {
    total: casos.length,
    sensibilidad: razon(resultados.filter((x) => x.c.esperado !== "verde")),
    especificidad: razon(resultados.filter((x) => x.c.esperado === "verde")),
    exactitud: razon(resultados),
    fallos: resultados.filter((x) => x.falla !== null).map((x) => ({ caso: x.c.nombre, conjunto: x.c.conjunto, motivo: x.falla as string })),
  };
}
