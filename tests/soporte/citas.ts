import { CAMPOS_CON_CITA, respalda } from "../../src/lib/dominio/procedencia";

/**
 * Agrega a una entrega simulada una cita textual (el mismo fragmento del mensaje) para cada dato que ese fragmento respalda,
 * como haría un modelo honesto. Un dato que el fragmento no respalda queda sin cita (ALC-PRO-01 lo marca como advertencia).
 */
export function conCitas<T extends Record<string, unknown>>(entrega: T, fragmento: string): T & { citas: Record<string, string> } {
  const citas: Record<string, string> = {};
  for (const campo of CAMPOS_CON_CITA) if (entrega[campo] !== undefined && respalda(campo, entrega[campo], fragmento)) citas[campo] = fragmento;
  return { ...entrega, citas };
}
