import { CAMPOS_CON_CITA } from "../../src/lib/dominio/procedencia";

/** Agrega a una entrega simulada una cita textual (el mismo fragmento del mensaje) para cada dato que trae. */
export function conCitas<T extends Record<string, unknown>>(entrega: T, fragmento: string): T & { citas: Record<string, string> } {
  const citas: Record<string, string> = {};
  for (const campo of CAMPOS_CON_CITA) if (entrega[campo] !== undefined) citas[campo] = fragmento;
  return { ...entrega, citas };
}
