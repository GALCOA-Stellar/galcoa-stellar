import { createHmac, timingSafeEqual } from "node:crypto";
import { randomBytes } from "node:crypto";
import { evaluar } from "../dominio/rules";

/**
 * Sello de la confirmación del comercio: lo emite el SERVIDOR cuando el comercio responde "lo recibí así".
 * Va en el campo confirmadoPor como `comercio-<id>-<marca>` y está atado a los datos que el comercio vio.
 * Si alguien lo escribe a mano, o cambia un dato después de la confirmación, la marca no coincide y el
 * documento queda como "sin confirmar" (rojo). Sin servidor no se puede fabricar.
 */
export const DATOS_PUBLICOS = ["remito", "producto", "unidad", "cantidadPedida", "cantidadRecibida", "fechaEntrega", "observacion"] as const;
const FORMATO = /^comercio-([0-9a-f]{8})-([0-9a-f]{32})$/;

let efimero: Buffer | null = null;
function secreto(): Buffer | null {
  const s = process.env.DESAFIO_SECRETO;
  if (s) return Buffer.from(s, "utf8");
  if (process.env.NODE_ENV === "production") return null;
  efimero ??= randomBytes(32);
  return efimero; // desarrollo local: secreto efímero
}

/** Texto canónico de lo que el comercio ve y confirma (orden fijo, solo datos públicos). */
export const datosPublicos = (doc: Record<string, unknown>): string =>
  JSON.stringify(DATOS_PUBLICOS.map((k) => [k, doc[k] === undefined || doc[k] === null ? null : doc[k]]));

const marca = (id8: string, doc: Record<string, unknown>, s: Buffer) => createHmac("sha256", s).update(`comercio:${id8}:${datosPublicos(doc)}`).digest("hex").slice(0, 32);

/** Emite el sello para una confirmación hecha. Devuelve null si falta el secreto del servidor. */
export function emitirSello(id: string, doc: Record<string, unknown>): string | null {
  const s = secreto();
  if (!s) return null;
  const id8 = id.slice(0, 8);
  return `comercio-${id8}-${marca(id8, doc, s)}`;
}

export const pareceSelloDeComercio = (v: unknown): v is string => typeof v === "string" && v.startsWith("comercio-");

/** ¿El sello corresponde a estos datos y lo emitió este servidor? */
export function selloValido(valor: unknown, doc: Record<string, unknown>): boolean {
  const s = secreto();
  if (!s || typeof valor !== "string") return false;
  const m = FORMATO.exec(valor);
  if (!m) return false;
  const esperada = marca(m[1], doc, s);
  return esperada.length === m[2].length && timingSafeEqual(Buffer.from(esperada), Buffer.from(m[2]));
}

/**
 * Antes de evaluar un documento: si dice estar confirmado por un comercio pero el sello no es auténtico
 * o no corresponde a estos datos, se lo trata como sin confirmar (la regla de completitud lo pone en rojo).
 */
export function aplicarSelloDeComercio(entrada: unknown): unknown {
  if (typeof entrada !== "object" || entrada === null) return entrada;
  const doc = entrada as Record<string, unknown>;
  if (!pareceSelloDeComercio(doc.confirmadoPor)) return entrada;
  const normalizado = evaluar(entrada).documento; // mismos valores que vio y confirmó el comercio
  if (!normalizado) return entrada; // datos ilegibles: las reglas ya lo ponen en rojo
  return selloValido(doc.confirmadoPor, normalizado as unknown as Record<string, unknown>) ? entrada : { ...doc, confirmadoPor: "" };
}
