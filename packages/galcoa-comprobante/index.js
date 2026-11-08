// galcoa-comprobante: arma y verifica lotes (galcoa.stellar.comprobante.v2; sigue verificando los v1). Sin dependencias; solo node:crypto.
import { createHash } from "node:crypto";

export const ESQUEMA_LOTE = "galcoa.batch.v1";
export const ESQUEMA_COMPROBANTE_V1 = "galcoa.stellar.comprobante.v1";
export const ESQUEMA_COMPROBANTE = "galcoa.stellar.comprobante.v2";

const sha256 = (...bufs) => createHash("sha256").update(Buffer.concat(bufs)).digest();
const HEX64 = /^[0-9a-f]{64}$/;

/** Serialización canónica v1: claves en orden alfabético, sin espacios; los valores simples salen como JSON.stringify. */
export function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}

/** Huella v1 de un manifiesto (JSON canónico). Solo para verificar comprobantes viejos. */
export const huellaDeV1 = (manifiesto) => sha256(Buffer.from(canonical(manifiesto), "utf8")).toString("hex");

// ---- Codificación v2: orden fijo, marcas de tipo, texto NFC, prefijo de dominio, campos desconocidos rechazados. ----
const CAMPOS = [
  ["remito", "texto", false], ["producto", "texto", false], ["unidad", "texto", false],
  ["cantidadPedida", "entero", false], ["cantidadRecibida", "entero", false],
  ["fechaEntrega", "texto", false], ["fechaRegistro", "texto", false],
  ["cargadoPor", "texto", false], ["confirmadoPor", "texto", false],
  ["evidenciaHash", "huella", true], ["observacion", "texto", true],
];
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const txt = (v, c) => {
  if (typeof v !== "string" || SUELTO.test(v)) throw new Error(`${c}: texto inválido`);
  const b = Buffer.from(v.normalize("NFC"), "utf8");
  if (b.length > 65536) throw new Error(`${c}: demasiado largo`);
  return Buffer.concat([Buffer.from([1]), u32(b.length), b]);
};
const codificarDoc = (d) => {
  if (typeof d !== "object" || d === null || Array.isArray(d)) throw new Error("documento: se esperaba un objeto");
  const conocidos = CAMPOS.map((c) => c[0]);
  for (const k of Object.keys(d)) if (!conocidos.includes(k)) throw new Error(`documento: campo desconocido "${k}"`);
  return Buffer.concat(CAMPOS.map(([n, t, op]) => {
    const v = d[n];
    if (v === undefined || v === null) { if (!op) throw new Error(`${n}: falta`); return Buffer.from([0]); }
    if (t === "texto") return txt(v, n);
    if (t === "entero") {
      if (!Number.isSafeInteger(v) || v < 0) throw new Error(`${n}: entero inválido`);
      const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(v)); return Buffer.concat([Buffer.from([2]), b]);
    }
    if (typeof v !== "string" || !HEX64.test(v)) throw new Error(`${n}: huella inválida`);
    return Buffer.concat([Buffer.from([3]), u32(32), Buffer.from(v, "hex")]);
  }));
};
/** Huella v2 de un manifiesto { documento, reglasVersion, reglasIds, veredicto }: es la hoja del árbol. */
export const huellaDe = (m) => {
  for (const k of Object.keys(m)) if (!["documento", "reglasVersion", "reglasIds", "veredicto"].includes(k)) throw new Error(`manifiesto: campo desconocido "${k}"`);
  if (!Array.isArray(m.reglasIds) || m.reglasIds.length > 256) throw new Error("reglasIds: lista inválida");
  const cuerpo = Buffer.concat([txt(m.reglasVersion, "reglasVersion"), Buffer.from([4]), u32(m.reglasIds.length), ...m.reglasIds.map((x) => txt(x, "reglasIds")), txt(m.veredicto, "veredicto"), codificarDoc(m.documento)]);
  return sha256(Buffer.from("galcoa:manifiesto:v2", "utf8"), Buffer.from([2]), cuerpo).toString("hex");
};

const hoja = (h) => sha256(Buffer.from([0x00]), h);
const nodo = (l, r) => sha256(Buffer.from([0x01]), l, r);

/** Árbol de Merkle: hojas con prefijo 0x00, nodos con 0x01; si un nivel es impar, el último nodo sube sin duplicarse. */
export function construirArbol(huellasHex) {
  if (!Array.isArray(huellasHex) || huellasHex.length === 0 || !huellasHex.every((h) => HEX64.test(h))) throw new Error("Hacen falta huellas de 64 caracteres hexadecimales");
  const niveles = [huellasHex.map((h) => hoja(Buffer.from(h, "hex")))];
  while (niveles.at(-1).length > 1) {
    const a = niveles.at(-1), s = [];
    for (let i = 0; i < a.length; i += 2) s.push(i + 1 < a.length ? nodo(a[i], a[i + 1]) : a[i]);
    niveles.push(s);
  }
  return { niveles, raiz: niveles.at(-1)[0].toString("hex") };
}

export function caminoDe(niveles, indice) {
  const out = [];
  let idx = indice;
  for (let l = 0; l < niveles.length - 1; l++) {
    const h = idx ^ 1;
    if (h < niveles[l].length) out.push({ lado: idx % 2 === 0 ? "R" : "L", hash: niveles[l][h].toString("hex") });
    idx = Math.floor(idx / 2);
  }
  return out;
}

export function verificarCamino(huellaHex, camino, raizHex) {
  if (!HEX64.test(huellaHex) || !HEX64.test(raizHex) || !Array.isArray(camino)) return false;
  let actual = hoja(Buffer.from(huellaHex, "hex"));
  for (const p of camino) {
    if (!p || !HEX64.test(p.hash) || (p.lado !== "L" && p.lado !== "R")) return false;
    const h = Buffer.from(p.hash, "hex");
    actual = p.lado === "R" ? nodo(actual, h) : nodo(h, actual);
  }
  return actual.toString("hex") === raizHex;
}

/** Memo v1 (comprobantes viejos): SHA-256 del resumen canónico del lote. */
export const memoDelLoteV1 = (raiz, cantidadHojas) => createHash("sha256").update(canonical({ cantidadHojas, raiz, schemaVersion: ESQUEMA_LOTE }), "utf8").digest("hex");
/** La huella de 32 bytes que va en el memo de la transacción (v2): SHA-256(dominio || versión || cantidad (u32) || raíz). */
export const memoDelLote = (raiz, cantidadHojas) => {
  if (!HEX64.test(raiz) || !Number.isInteger(cantidadHojas) || cantidadHojas < 1 || cantidadHojas > 0xffffffff) throw new Error("raíz o cantidad de hojas inválida");
  return sha256(Buffer.from("galcoa:lote:v2", "utf8"), Buffer.from([2]), u32(cantidadHojas), Buffer.from(raiz, "hex")).toString("hex");
};

/** Arma un lote: devuelve el memo a sellar y un comprobante por manifiesto (todavía sin txHash ni prueba). */
export function armarLote(manifiestos, red = "stellar:testnet") {
  const huellas = manifiestos.map(huellaDe);
  const { niveles, raiz } = construirArbol(huellas);
  const memo = memoDelLote(raiz, huellas.length);
  const comprobantes = manifiestos.map((manifiesto, i) => ({
    schemaVersion: ESQUEMA_COMPROBANTE, red, txHash: null, manifiesto, manifestHash: huellas[i], indice: i, cantidadHojas: huellas.length, camino: caminoDe(niveles, i), raiz,
  }));
  return { memo, raiz, comprobantes };
}

/** Verificación sin red: el manifiesto no fue alterado, lleva a la raíz y de ahí al memo esperado. Acepta v2 y v1. */
export function verificarComprobante(c) {
  const v2 = c?.schemaVersion === ESQUEMA_COMPROBANTE;
  if (!v2 && c?.schemaVersion !== ESQUEMA_COMPROBANTE_V1) return { coherente: false, motivo: "Versión de comprobante desconocida" };
  let h;
  try { h = v2 ? huellaDe(c.manifiesto) : huellaDeV1(c.manifiesto); } catch (e) { return { coherente: false, motivo: "El manifiesto no tiene la forma esperada: " + e.message }; }
  if (h !== c.manifestHash) return { coherente: false, motivo: "El contenido no coincide con su huella (fue alterado)" };
  if (!verificarCamino(c.manifestHash, c.camino, c.raiz)) return { coherente: false, motivo: "El comprobante no lleva a la raíz del lote" };
  try { return { coherente: true, memoEsperado: v2 ? memoDelLote(c.raiz, c.cantidadHojas) : memoDelLoteV1(c.raiz, c.cantidadHojas) }; }
  catch { return { coherente: false, motivo: "Raíz o cantidad de hojas inválida" }; }
}

/** Compara el memo esperado con el que se leyó de la red (o de la transacción guardada). */
export const coincideConMemo = (c, memoDeRedHex) => {
  const v = verificarComprobante(c);
  return v.coherente && v.memoEsperado === memoDeRedHex;
};
