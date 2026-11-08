import { createHash } from "node:crypto";

/**
 * Codificación v2 de los datos que se hashean (idea tomada de la especificación de compromisos de Lafiya, MIT):
 *  - el ORDEN de los campos lo fija el esquema, nunca se ordena en tiempo de ejecución;
 *  - cada valor lleva una marca de tipo, así "ausente" no se confunde con un texto vacío;
 *  - el texto se normaliza a NFC (dos textos que se ven iguales dan los mismos bytes);
 *  - no hay números decimales: no hay ambigüedad de formato entre lenguajes;
 *  - la huella lleva un prefijo de dominio y de versión, para que no se confunda con otra huella;
 *  - campos desconocidos se RECHAZAN (si no, alguien podría agregar datos sin cambiar la huella).
 * Todo se puede reimplementar en cualquier lenguaje con los vectores de prueba de `docs/vectores/`.
 */

export const DOMINIO_MANIFIESTO = "galcoa:manifiesto:v2";
export const DOMINIO_LOTE = "galcoa:lote:v2";
export const VERSION_CODIFICACION = 0x02;

export const MAX_CAMPO_BYTES = 65_536;
export const MAX_ELEMENTOS_LISTA = 256;

const TAG_AUSENTE = 0x00;
const TAG_TEXTO = 0x01;
const TAG_ENTERO = 0x02;
const TAG_BYTES = 0x03;
const TAG_LISTA = 0x04;

/** Orden fijo de los campos del documento de entrega (esquema `galcoa.entrega.v2`). */
export const CAMPOS_ENTREGA = [
  { nombre: "remito", tipo: "texto", opcional: false },
  { nombre: "producto", tipo: "texto", opcional: false },
  { nombre: "unidad", tipo: "texto", opcional: false },
  { nombre: "cantidadPedida", tipo: "entero", opcional: false },
  { nombre: "cantidadRecibida", tipo: "entero", opcional: false },
  { nombre: "fechaEntrega", tipo: "texto", opcional: false },
  { nombre: "fechaRegistro", tipo: "texto", opcional: false },
  { nombre: "cargadoPor", tipo: "texto", opcional: false },
  { nombre: "confirmadoPor", tipo: "texto", opcional: false },
  { nombre: "evidenciaHash", tipo: "huella", opcional: true },
  { nombre: "observacion", tipo: "texto", opcional: true },
] as const;

const u32 = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
const u64 = (n: number): Buffer => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(n));
  return b;
};

const SURROGADO_SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function texto(v: unknown, campo: string): Buffer {
  if (typeof v !== "string") throw new Error(`${campo}: se esperaba texto`);
  if (SURROGADO_SUELTO.test(v)) throw new Error(`${campo}: texto con caracteres inválidos`);
  const bytes = Buffer.from(v.normalize("NFC"), "utf8");
  if (bytes.length > MAX_CAMPO_BYTES) throw new Error(`${campo}: demasiado largo`);
  return Buffer.concat([Buffer.from([TAG_TEXTO]), u32(bytes.length), bytes]);
}
function entero(v: unknown, campo: string): Buffer {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) throw new Error(`${campo}: se esperaba un entero sin signo`);
  return Buffer.concat([Buffer.from([TAG_ENTERO]), u64(v)]);
}
function huella(v: unknown, campo: string): Buffer {
  if (typeof v !== "string" || !/^[0-9a-f]{64}$/.test(v)) throw new Error(`${campo}: se esperaba una huella de 64 caracteres hexadecimales en minúscula`);
  return Buffer.concat([Buffer.from([TAG_BYTES]), u32(32), Buffer.from(v, "hex")]);
}
function lista(v: unknown, campo: string): Buffer {
  if (!Array.isArray(v) || v.length > MAX_ELEMENTOS_LISTA) throw new Error(`${campo}: lista inválida`);
  return Buffer.concat([Buffer.from([TAG_LISTA]), u32(v.length), ...v.map((x, i) => texto(x, `${campo}[${i}]`))]);
}

/** Codifica un documento de entrega según el orden fijo del esquema. Rechaza campos que el esquema no conoce. */
export function codificarEntrega(doc: unknown): Buffer {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) throw new Error("documento: se esperaba un objeto");
  const o = doc as Record<string, unknown>;
  const conocidos = new Set<string>(CAMPOS_ENTREGA.map((c) => c.nombre));
  for (const k of Object.keys(o)) if (!conocidos.has(k)) throw new Error(`documento: campo desconocido "${k}"`);
  const partes = CAMPOS_ENTREGA.map((c) => {
    const v = o[c.nombre];
    if (v === undefined || v === null) {
      if (!c.opcional) throw new Error(`${c.nombre}: falta`);
      return Buffer.from([TAG_AUSENTE]);
    }
    return c.tipo === "texto" ? texto(v, c.nombre) : c.tipo === "entero" ? entero(v, c.nombre) : huella(v, c.nombre);
  });
  return Buffer.concat(partes);
}

export type ManifiestoCodificable = { documento: unknown; reglasVersion: string; reglasIds: string[]; veredicto: string };

/** Bytes canónicos del manifiesto: versión de reglas, ids de reglas, veredicto y luego el documento. */
export function codificarManifiesto(m: ManifiestoCodificable): Buffer {
  const o = m as unknown as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!["documento", "reglasVersion", "reglasIds", "veredicto"].includes(k)) throw new Error(`manifiesto: campo desconocido "${k}"`);
  return Buffer.concat([texto(o.reglasVersion, "reglasVersion"), lista(o.reglasIds, "reglasIds"), texto(o.veredicto, "veredicto"), codificarEntrega(o.documento)]);
}

const sha = (...b: Buffer[]) => createHash("sha256").update(Buffer.concat(b)).digest();

/** Huella del manifiesto: SHA-256(dominio || versión || bytes canónicos). Es la hoja del árbol de Merkle. */
export const huellaManifiestoV2 = (m: ManifiestoCodificable): string =>
  sha(Buffer.from(DOMINIO_MANIFIESTO, "utf8"), Buffer.from([VERSION_CODIFICACION]), codificarManifiesto(m)).toString("hex");

/** Huella que va al memo de Stellar: SHA-256(dominio || versión || cantidadHojas (u32) || raíz (32 bytes)). */
export function memoDelLoteV2(raizHex: string, cantidadHojas: number): string {
  if (!/^[0-9a-f]{64}$/.test(raizHex)) throw new Error("raíz inválida");
  if (!Number.isInteger(cantidadHojas) || cantidadHojas < 1 || cantidadHojas > 0xffffffff) throw new Error("cantidad de hojas inválida");
  return sha(Buffer.from(DOMINIO_LOTE, "utf8"), Buffer.from([VERSION_CODIFICACION]), u32(cantidadHojas), Buffer.from(raizHex, "hex")).toString("hex");
}
