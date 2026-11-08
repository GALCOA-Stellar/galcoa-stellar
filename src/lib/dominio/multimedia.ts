import type { Regla } from "./rules";

/**
 * Sistema GALCOA de evidencia multimedia (fotos y voz).
 * Un agente "perito" con skills mira el archivo y devuelve un INFORME de indicios. El perito solo puede frenar:
 * estas reglas, en código, convierten el informe en reglas ALC-* y nunca suben un veredicto.
 * Si el perito no respondió (informe null), la evidencia queda declarada, nunca verificada.
 * Un indicio no es una prueba: ninguna regla dice "auténtico" ni "falso", dice "requiere revisión".
 */
export const VERSION_MULTIMEDIA = "multimedia-0.1";

export type Indicio = { tipo: string; gravedad: "baja" | "media" | "alta"; detalle: string; afectaCifras?: boolean };
export type InformePerito = { skill: "foto" | "voz"; version: string; indicios: Indicio[]; inteligibilidad?: number };

const r = (id: string, atributo: string, ok: boolean, gravedad: Regla["gravedad"], detalle: string): Regla => ({ id, atributo, ok, gravedad, detalle });
const sinRevision = (id: string, que: string): Regla => r(id, "Original", false, "advertencia", `${que} no fue revisada por el perito: queda declarada, no verificada`);

/** ALC-MED-01: indicios de edición o generación con IA en una foto. Si tocan cantidad, calidad o precio, rojo. */
export function evaluarInformeFoto(inf: InformePerito | null): Regla[] {
  if (inf === null) return [sinRevision("ALC-MED-01", "La foto")];
  const propios = inf.indicios.filter((i) => i.tipo.startsWith("foto_"));
  const grave = propios.filter((i) => i.gravedad === "alta" || (i.afectaCifras && i.gravedad !== "baja"));
  if (grave.length) return [r("ALC-MED-01", "Original", false, "critica", `Indicios fuertes de edición o falsificación: ${grave.map((i) => i.detalle).join("; ")}. Requiere revisión`)];
  const medios = propios.filter((i) => i.gravedad === "media");
  if (medios.length) return [r("ALC-MED-01", "Original", false, "advertencia", `Indicios de edición: ${medios.map((i) => i.detalle).join("; ")}. Requiere revisión`)];
  return [r("ALC-MED-01", "Original", true, "advertencia", "El perito no encontró indicios de edición (no es una prueba de autenticidad)")];
}

/**
 * Reglas de voz.
 *  ALC-VOZ-02 Legible: se entiende el mensaje (inteligibilidad medida de 0 a 1)
 *  ALC-VOZ-03 Original: indicios de voz sintética o robótica
 *  ALC-VOZ-04 Atribuible: la cuenta autorizada firmó este audio (la identidad la da la clave, no la voz)
 */
export function evaluarInformeVoz(inf: InformePerito | null, atribucion: { cuentaAutorizada: boolean; firmaValida: boolean }): Regla[] {
  const reglas: Regla[] = [];
  const firmada = atribucion.cuentaAutorizada && atribucion.firmaValida;
  reglas.push(r("ALC-VOZ-04", "Atribuible", firmada, "critica", firmada ? "Una cuenta autorizada firmó este audio" : "El audio no está firmado por una cuenta autorizada a cargar datos: requiere revisión"));
  if (inf === null) { reglas.push(sinRevision("ALC-VOZ-03", "La voz")); return reglas; }
  const q = inf.inteligibilidad;
  if (q === undefined || Number.isNaN(q)) reglas.push(r("ALC-VOZ-02", "Legible", false, "advertencia", "No se midió si el mensaje se entiende"));
  else if (q < 0.6) reglas.push(r("ALC-VOZ-02", "Legible", false, "critica", "El mensaje no se entiende bien: requiere volver a grabarlo"));
  else if (q < 0.8) reglas.push(r("ALC-VOZ-02", "Legible", false, "advertencia", "El mensaje se entiende solo en parte"));
  else reglas.push(r("ALC-VOZ-02", "Legible", true, "advertencia", "El mensaje se entiende"));
  const voz = inf.indicios.filter((i) => i.tipo.startsWith("voz_"));
  const fuertes = voz.filter((i) => i.gravedad === "alta");
  const medios = voz.filter((i) => i.gravedad === "media");
  if (fuertes.length) reglas.push(r("ALC-VOZ-03", "Original", false, "critica", `Indicios fuertes de voz sintética o editada: ${fuertes.map((i) => i.detalle).join("; ")}. Requiere revisión`));
  else if (medios.length) reglas.push(r("ALC-VOZ-03", "Original", false, "advertencia", `Indicios de voz sintética o editada: ${medios.map((i) => i.detalle).join("; ")}. Requiere revisión`));
  else reglas.push(r("ALC-VOZ-03", "Original", true, "advertencia", "El perito no encontró indicios de voz sintética (no es una prueba de que la voz sea humana)"));
  return reglas;
}

/** Valida y recorta un informe crudo de un modelo. Cualquier cosa fuera de forma se descarta (null: no hubo informe válido). */
export function validarInforme(crudo: unknown, skill: "foto" | "voz"): InformePerito | null {
  if (typeof crudo !== "object" || crudo === null) return null;
  const o = crudo as Record<string, unknown>;
  if (!Array.isArray(o.indicios)) return null;
  const indicios: Indicio[] = [];
  for (const x of o.indicios.slice(0, 20)) {
    const i = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
    if (typeof i.tipo !== "string" || !new RegExp(`^${skill}_[a-z_]{1,40}$`).test(i.tipo)) continue;
    if (i.gravedad !== "baja" && i.gravedad !== "media" && i.gravedad !== "alta") continue;
    if (typeof i.detalle !== "string" || !i.detalle.trim()) continue;
    indicios.push({ tipo: i.tipo, gravedad: i.gravedad, detalle: i.detalle.trim().slice(0, 200), ...(i.afectaCifras === true ? { afectaCifras: true } : {}) });
  }
  const q = typeof o.inteligibilidad === "number" && o.inteligibilidad >= 0 && o.inteligibilidad <= 1 ? o.inteligibilidad : undefined;
  return { skill, version: VERSION_MULTIMEDIA, indicios, ...(q !== undefined ? { inteligibilidad: q } : {}) };
}
