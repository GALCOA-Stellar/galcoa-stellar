export const VERSION_REGLAS = "reglas-demo-0.2";

export type Veredicto = "verde" | "amarillo" | "rojo";
export type Gravedad = "critica" | "advertencia";
export type Regla = { id: string; atributo: string; ok: boolean; gravedad: Gravedad; detalle: string };
export type Entrega = {
  remito: string;
  producto: string;
  unidad: string;
  cantidadPedida: number;
  cantidadRecibida: number;
  fechaEntrega: string;
  fechaRegistro: string;
  cargadoPor: string;
  confirmadoPor: string;
  evidenciaHash?: string;
  observacion?: string;
};
export type Evaluacion = { veredicto: Veredicto; reglas: Regla[]; documento: Entrega | null };

/**
 * Reglas DETERMINISTAS de demostración (código, no IA), organizadas por atributo ALCOA+.
 * La misma entrada da siempre el mismo veredicto. No son el motor completo de GALCOA.
 *  ALC-COM-01  Completo      campos obligatorios presentes                       (falla: rojo, "no se pudo leer")
 *  ALC-LEG-01  Legible       tipos y formatos válidos                            (falla: rojo)
 *  ALC-ATR-01  Atribuible    quien carga no es quien confirma (cuatro ojos)      (falla: rojo)
 *  ALC-COH-01  Consistente   la fecha de registro no es anterior a la de entrega (falla: rojo)
 *  ALC-CTE-01  Contemporáneo registrado dentro de los 3 días de la entrega       (falla: amarillo, carga tardía)
 *  ALC-ORI-01  Original      huella SHA-256 del original adjunta                 (falla: amarillo, sin evidencia)
 *  ALC-EXA-01  Exacto        recibido = pedido; si difiere: con observación amarillo, sin ella rojo
 * Disponible, Perdurable y Trazable los aporta el sistema (comprobante, versión de reglas, anclaje en Stellar).
 */
const ID_INTERNO = /^[A-Za-z0-9._-]{1,60}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HEX64 = /^[0-9a-f]{64}$/;
export const DIAS_MAX_CARGA = 3;

function diaUTC(s: string): number | null {
  if (!FECHA.test(s)) return null;
  const [a, m, d] = s.split("-").map(Number);
  const t = Date.UTC(a, m - 1, d);
  const f = new Date(t);
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d ? t : null;
}
const regla = (id: string, atributo: string, ok: boolean, gravedad: Gravedad, detalle: string): Regla => ({ id, atributo, ok, gravedad, detalle });
const textoOk = (v: unknown, max: number) => typeof v === "string" && v.trim() !== "" && v.length <= max;

export function evaluar(entrada: unknown): Evaluacion {
  const o = (typeof entrada === "object" && entrada !== null && !Array.isArray(entrada) ? entrada : {}) as Record<string, unknown>;
  const reglas: Regla[] = [];

  const obligatorios = ["remito", "producto", "unidad", "cantidadPedida", "cantidadRecibida", "fechaEntrega", "fechaRegistro", "cargadoPor", "confirmadoPor"];
  const faltan = obligatorios.filter((k) => o[k] === undefined || o[k] === null || o[k] === "");
  reglas.push(regla("ALC-COM-01", "Completo", faltan.length === 0, "critica", faltan.length === 0 ? "Campos obligatorios presentes" : `Faltan: ${faltan.join(", ")}`));
  if (faltan.length > 0) return { veredicto: "rojo", reglas, documento: null };

  const fe = typeof o.fechaEntrega === "string" ? diaUTC(o.fechaEntrega) : null;
  const fr = typeof o.fechaRegistro === "string" ? diaUTC(o.fechaRegistro) : null;
  const formatoOk =
    textoOk(o.remito, 60) && textoOk(o.producto, 120) && textoOk(o.unidad, 20) &&
    typeof o.cantidadPedida === "number" && Number.isInteger(o.cantidadPedida) && o.cantidadPedida >= 0 &&
    typeof o.cantidadRecibida === "number" && Number.isInteger(o.cantidadRecibida) && o.cantidadRecibida >= 0 &&
    fe !== null && fr !== null &&
    typeof o.cargadoPor === "string" && ID_INTERNO.test(o.cargadoPor) &&
    typeof o.confirmadoPor === "string" && ID_INTERNO.test(o.confirmadoPor) &&
    (o.evidenciaHash === undefined || (typeof o.evidenciaHash === "string" && HEX64.test(o.evidenciaHash))) &&
    (o.observacion === undefined || (typeof o.observacion === "string" && o.observacion.length <= 300));
  reglas.push(regla("ALC-LEG-01", "Legible", formatoOk, "critica", formatoOk ? "Tipos y formatos válidos" : "Hay campos con tipo o formato inválido (fechas AAAA-MM-DD, cantidades enteras, identificadores internos, huella de 64 caracteres)"));
  if (!formatoOk) return { veredicto: "rojo", reglas, documento: null };

  const doc: Entrega = {
    remito: (o.remito as string).trim(),
    producto: (o.producto as string).trim(),
    unidad: (o.unidad as string).trim(),
    cantidadPedida: o.cantidadPedida as number,
    cantidadRecibida: o.cantidadRecibida as number,
    fechaEntrega: o.fechaEntrega as string,
    fechaRegistro: o.fechaRegistro as string,
    cargadoPor: o.cargadoPor as string,
    confirmadoPor: o.confirmadoPor as string,
    ...(typeof o.evidenciaHash === "string" ? { evidenciaHash: o.evidenciaHash } : {}),
    ...(typeof o.observacion === "string" && o.observacion.trim() !== "" ? { observacion: o.observacion.trim() } : {}),
  };

  const cuatroOjos = doc.cargadoPor !== doc.confirmadoPor;
  reglas.push(regla("ALC-ATR-01", "Atribuible", cuatroOjos, "critica", cuatroOjos ? "Cargó y confirmó personas distintas" : "Quien carga no puede confirmar su propio dato (cuatro ojos)"));

  const dias = ((fr as number) - (fe as number)) / 86_400_000;
  reglas.push(regla("ALC-COH-01", "Consistente", dias >= 0, "critica", dias >= 0 ? "Fechas coherentes" : "La fecha de registro es anterior a la de entrega"));
  if (dias >= 0) reglas.push(regla("ALC-CTE-01", "Contemporáneo", dias <= DIAS_MAX_CARGA, "advertencia", dias <= DIAS_MAX_CARGA ? "Registrado a tiempo" : `Carga tardía: ${dias} días después de la entrega`));

  reglas.push(regla("ALC-ORI-01", "Original", doc.evidenciaHash !== undefined, "advertencia", doc.evidenciaHash !== undefined ? "Huella del original adjunta" : "Sin huella del documento original (declarado)"));

  if (doc.cantidadPedida === doc.cantidadRecibida) reglas.push(regla("ALC-EXA-01", "Exacto", true, "critica", "Recibido coincide con lo pedido"));
  else if (doc.observacion) reglas.push(regla("ALC-EXA-01", "Exacto", false, "advertencia", "Diferencia declarada con observación"));
  else reglas.push(regla("ALC-EXA-01", "Exacto", false, "critica", "Diferencia sin observación: requiere revisión"));

  const veredicto: Veredicto = reglas.some((r) => !r.ok && r.gravedad === "critica") ? "rojo" : reglas.some((r) => !r.ok) ? "amarillo" : "verde";
  return { veredicto, reglas, documento: doc };
}
