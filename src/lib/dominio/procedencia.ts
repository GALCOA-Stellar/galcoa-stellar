/**
 * Procedencia de cada dato: todo valor que propone el modelo tiene que venir con una cita textual del mensaje.
 * El código (no el modelo) comprueba que la cita aparezca de verdad en la fuente.
 */
export const REGLA_PROCEDENCIA = "ALC-PRO-01";

export const CAMPOS_CON_CITA = ["remito", "producto", "unidad", "cantidadPedida", "cantidadRecibida", "fechaEntrega", "observacion"] as const;
export type CampoCitable = (typeof CAMPOS_CON_CITA)[number];
export type Citas = Partial<Record<CampoCitable, string>>;

export type FaltaDeProcedencia = { indice: number; campo: CampoCitable; motivo: "sin-cita" | "cita-inexistente" };

/** Minúsculas, sin tildes y con espacios simples: así "Remito  A-12" y "remito a-12" cuentan como la misma cita. */
export const normalizarCita = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Limpia lo que devolvió el modelo: solo campos conocidos con texto corto. */
export function limpiarCitas(crudo: unknown): Citas {
  const o = typeof crudo === "object" && crudo !== null && !Array.isArray(crudo) ? (crudo as Record<string, unknown>) : {};
  const out: Citas = {};
  for (const campo of CAMPOS_CON_CITA) {
    const v = o[campo];
    if (typeof v === "string" && v.trim() !== "" && v.length <= 300) out[campo] = v.trim();
  }
  return out;
}

/** Lista los datos propuestos que no tienen cita o cuya cita no está, palabra por palabra, en el mensaje. */
export function faltasDeProcedencia(mensaje: string, propuestas: Record<string, unknown>[], citas: Citas[]): FaltaDeProcedencia[] {
  const fuente = normalizarCita(mensaje);
  const faltas: FaltaDeProcedencia[] = [];
  propuestas.forEach((p, indice) => {
    for (const campo of CAMPOS_CON_CITA) {
      if (p[campo] === undefined) continue;
      const cita = citas[indice]?.[campo];
      if (!cita) faltas.push({ indice, campo, motivo: "sin-cita" });
      else if (!fuente.includes(normalizarCita(cita))) faltas.push({ indice, campo, motivo: "cita-inexistente" });
    }
  });
  return faltas;
}
