// Huella del examen de las reglas (idea tomada del evaluador de arm-whatsapp): una nota solo se puede comparar con otra
// si el examen es el mismo. Se calcula un hash de las reglas y de los casos; una persona lo aprueba con un motivo y queda
// guardado en huella-aprobada.json. Si cualquiera de los dos cambia, el examen se niega a pasar hasta una nueva aprobación.
// Así una nota mejor no puede salir de reglas más blandas o de casos más fáciles sin que quede escrito quién y por qué.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");
export const ARCHIVO_APROBACION = join(AQUI, "huella-aprobada.json");
const COMPONENTES = { reglas: "src/lib/rules.ts", casos: "evals/reglas/casos.ts", medicion: "evals/reglas/medir.ts" };

// CRLF y LF dan el mismo hash: un checkout en Windows no es un cambio del examen.
const hash = (texto) => createHash("sha256").update(texto.replace(/\r\n?/g, "\n")).digest("hex");

export function calcularHuella() {
  const componentes = Object.fromEntries(Object.entries(COMPONENTES).map(([k, ruta]) => [k, hash(readFileSync(join(RAIZ, ruta), "utf8"))]));
  return { total: hash(JSON.stringify(componentes)), componentes };
}

export function leerAprobacion() {
  return existsSync(ARCHIVO_APROBACION) ? JSON.parse(readFileSync(ARCHIVO_APROBACION, "utf8")) : null;
}

export function aprobar({ por, motivo }) {
  if (!por || !motivo || motivo.length < 10) throw new Error("Hace falta quién aprueba y un motivo de al menos 10 caracteres");
  const h = calcularHuella();
  writeFileSync(ARCHIVO_APROBACION, JSON.stringify({ ...h, aprobadaPor: por, motivo, fecha: new Date().toISOString() }, null, 2) + "\n", "utf8");
  return h;
}

/** Estado de la huella: "aprobada" o "cambio" (con qué componentes cambiaron). */
export function revisar() {
  const actual = calcularHuella();
  const ap = leerAprobacion();
  if (!ap) return { estado: "sin-aprobar", actual, cambiaron: Object.keys(actual.componentes) };
  const cambiaron = Object.keys(actual.componentes).filter((k) => actual.componentes[k] !== ap.componentes?.[k]);
  return cambiaron.length === 0 ? { estado: "aprobada", actual, aprobacion: ap } : { estado: "cambio", actual, aprobacion: ap, cambiaron };
}
