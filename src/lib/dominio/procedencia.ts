/**
 * Procedencia de cada dato: todo valor que propone el modelo tiene que venir con una cita textual del mensaje.
 * El código (no el modelo) comprueba que la cita aparezca de verdad en la fuente Y que respalde el valor propuesto:
 * una cita real que habla de otra cosa ("llegaron 8 cajas" para proponer 18) no sirve como respaldo.
 */
import { numerosEn } from "./inyeccion";

export const REGLA_PROCEDENCIA = "ALC-PRO-01";

export const CAMPOS_CON_CITA = ["remito", "producto", "unidad", "cantidadPedida", "cantidadRecibida", "fechaEntrega", "observacion"] as const;
export type CampoCitable = (typeof CAMPOS_CON_CITA)[number];
export type Citas = Partial<Record<CampoCitable, string>>;

export type FaltaDeProcedencia = { indice: number; campo: CampoCitable; motivo: "sin-cita" | "cita-inexistente" | "cita-no-respalda" };

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
      else if (!respalda(campo, p[campo], cita)) faltas.push({ indice, campo, motivo: "cita-no-respalda" });
    }
  });
  return faltas;
}

/** Palabras de un texto normalizado, sin plural simple: "cajas" y "caja" cuentan como la misma. */
const palabras = (s: string): string[] =>
  normalizarCita(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 0).map((w) => (w.length > 3 && w.endsWith("es") ? w.slice(0, -2) : w.length > 2 && w.endsWith("s") ? w.slice(0, -1) : w));

/**
 * ¿La cita respalda el valor? Las cantidades tienen que figurar en la cita (en cifras o en palabras) y los textos tienen que estar
 * contenidos en ella, palabra por palabra. La fecha no se ata: la cita suele ser relativa ("ayer", "el lunes") y la resuelve el modelo.
 */
export function respalda(campo: CampoCitable, valor: unknown, cita: string): boolean {
  if (campo === "fechaEntrega") return true;
  if (typeof valor === "number") return numerosEn(cita).has(valor);
  if (typeof valor !== "string") return false;
  if (normalizarCita(cita).includes(normalizarCita(valor))) return true;
  const enCita = new Set(palabras(cita));
  const delValor = palabras(valor);
  return delValor.length > 0 && delValor.every((w) => enCita.has(w));
}
