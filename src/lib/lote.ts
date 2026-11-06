import { canonical, sha256, sha256Hex } from "./canonical";
import { huellaManifiestoV2, memoDelLoteV2 } from "./codificacion";
import { construir, camino, verificarCamino, type PasoCamino } from "./merkle";
import { evaluar, VERSION_REGLAS, type Evaluacion, type Veredicto } from "./rules";

/** v1 (JSON canónico simplificado): se sigue verificando para los sellos ya emitidos. */
export const ESQUEMA_LOTE_V1 = "galcoa.batch.v1";
export const ESQUEMA_COMPROBANTE_V1 = "galcoa.stellar.comprobante.v1";
/** v2 (codificación binaria con orden fijo, NFC y prefijo de dominio): es la que se emite hoy. */
export const ESQUEMA_COMPROBANTE = "galcoa.stellar.comprobante.v2";
export { RED } from "./red";
import { RED } from "./red";
import { aplicarSelloDeComercio } from "./sello-comercio";
export const MAX_DOCUMENTOS = 50;

/** Evalúa un documento, tratando como no confirmado cualquier sello de comercio que no sea auténtico. */
const evaluarEntrada = (entrada: unknown) => evaluar(aplicarSelloDeComercio(entrada));

/** Prueba primaria guardada al sellar: sobrevive aunque la red (Horizon o RPC) ya no tenga el historial. */
export type Prueba = { ledger: number; cierreLedger: string | null; envelopeXdr: string; resultXdr: string | null };
export type Enviador = (memoHex: string) => Promise<{ txHash: string; ledger: number; prueba?: Prueba }>;

export type Manifiesto = { documento: unknown; reglasVersion: string; reglasIds: string[]; veredicto: Veredicto };
export type Comprobante = {
  schemaVersion: typeof ESQUEMA_COMPROBANTE | typeof ESQUEMA_COMPROBANTE_V1;
  red: string;
  txHash: string;
  manifiesto: Manifiesto;
  manifestHash: string;
  indice: number;
  cantidadHojas: number;
  camino: PasoCamino[];
  raiz: string;
  /** Opcional y fuera de la huella del documento: transacción firmada y hora de cierre del ledger. */
  prueba?: Prueba;
};
export type ResultadoDoc = { posicion: number; veredicto: Veredicto; reglas: Evaluacion["reglas"]; enLote: boolean };

/** La huella que va a Stellar (v2): SHA-256 con prefijo de dominio de (cantidad de hojas, raíz). Cabe justo en un memo de 32 bytes. */
export const memoDelLote = (raiz: string, cantidadHojas: number): string => memoDelLoteV2(raiz, cantidadHojas);
/** Memo de los comprobantes v1 ya emitidos. */
export const memoDelLoteV1 = (raiz: string, cantidadHojas: number): string =>
  sha256Hex(canonical({ cantidadHojas, raiz, schemaVersion: ESQUEMA_LOTE_V1 }));

export const manifestHashDe = (m: Manifiesto): string => huellaManifiestoV2(m);
export const manifestHashV1 = (m: Manifiesto): string => sha256(Buffer.from(canonical(m), "utf8")).toString("hex");

/**
 * Evalúa cada documento con las reglas y sella UN lote con los verdes y amarillos.
 * El enviador solo se llama si hay al menos un documento elegible: lo rojo nunca llega a la red.
 */
export async function sellarLote(entradas: unknown[], enviar: Enviador) {
  if (!Array.isArray(entradas) || entradas.length === 0) throw new Error("Mandá al menos un documento");
  if (entradas.length > MAX_DOCUMENTOS) throw new Error(`Máximo ${MAX_DOCUMENTOS} documentos por lote`);

  const resultados: ResultadoDoc[] = [];
  const elegibles: { manifiesto: Manifiesto; hash: string }[] = [];
  entradas.forEach((entrada, posicion) => {
    const ev = evaluarEntrada(entrada);
    const enLote = ev.veredicto !== "rojo" && ev.documento !== null;
    resultados.push({ posicion, veredicto: ev.veredicto, reglas: ev.reglas, enLote });
    if (enLote) {
      const manifiesto: Manifiesto = { documento: ev.documento, reglasVersion: VERSION_REGLAS, reglasIds: ev.reglas.map((r) => r.id), veredicto: ev.veredicto };
      elegibles.push({ manifiesto, hash: manifestHashDe(manifiesto) });
    }
  });

  if (elegibles.length === 0) return { resultados, sellado: null, comprobantes: [] as Comprobante[] };

  const { niveles, raiz } = construir(elegibles.map((e) => e.hash));
  const memo = memoDelLote(raiz, elegibles.length);
  const tx = await enviar(memo);
  const comprobantes: Comprobante[] = elegibles.map((e, i) => ({
    schemaVersion: ESQUEMA_COMPROBANTE,
    red: RED,
    txHash: tx.txHash,
    manifiesto: e.manifiesto,
    manifestHash: e.hash,
    indice: i,
    cantidadHojas: elegibles.length,
    camino: camino(niveles, i),
    raiz,
    ...(tx.prueba ? { prueba: tx.prueba } : {}),
  }));
  const sellado = { raiz, memo, cantidadHojas: elegibles.length, txHash: tx.txHash, ledger: tx.ledger, cierreLedger: tx.prueba?.cierreLedger ?? null };
  return { resultados, sellado, comprobantes };
}

/** Verificación pura (sin red): el comprobante es coherente y lleva a la raíz y al memo esperados. */
export function verificarComprobante(c: Comprobante): { coherente: boolean; memoEsperado: string; motivo?: string } {
  const v2 = c?.schemaVersion === ESQUEMA_COMPROBANTE;
  if (!v2 && c?.schemaVersion !== ESQUEMA_COMPROBANTE_V1) return { coherente: false, memoEsperado: "", motivo: "Versión de comprobante desconocida" };
  let hash: string;
  try {
    hash = v2 ? manifestHashDe(c.manifiesto) : manifestHashV1(c.manifiesto);
  } catch (e) {
    return { coherente: false, memoEsperado: "", motivo: "El manifiesto no tiene la forma esperada: " + (e instanceof Error ? e.message : "inválido") };
  }
  if (hash !== c.manifestHash) return { coherente: false, memoEsperado: "", motivo: "El contenido no coincide con su huella (fue alterado)" };
  if (!verificarCamino(c.manifestHash, c.camino, c.raiz)) return { coherente: false, memoEsperado: "", motivo: "El comprobante no lleva a la raíz del lote" };
  if (!v2 && !Number.isInteger(c.cantidadHojas)) return { coherente: false, memoEsperado: "", motivo: "Cantidad de hojas inválida" };
  try {
    return { coherente: true, memoEsperado: v2 ? memoDelLote(c.raiz, c.cantidadHojas) : memoDelLoteV1(c.raiz, c.cantidadHojas) };
  } catch {
    return { coherente: false, memoEsperado: "", motivo: "Raíz o cantidad de hojas inválida" };
  }
}

/** Cuatro ojos completo: quien aprueba el sello (identidad de la cuenta que firma) no puede haber cargado ningún documento que entra al lote. */
export function cargadoresDelLote(entradas: unknown[]): string[] {
  const ids = new Set<string>();
  for (const e of entradas) {
    const ev = evaluarEntrada(e);
    if (ev.veredicto !== "rojo" && ev.documento) ids.add(ev.documento.cargadoPor);
  }
  return [...ids];
}

const motivosDe = (reglas: Evaluacion["reglas"]) => reglas.filter((r) => !r.ok).map((r) => ({ id: r.id, detalle: r.detalle }));
const remitoDe = (d: unknown): string | null => {
  const r = typeof d === "object" && d !== null ? (d as Record<string, unknown>).remito : null;
  return typeof r === "string" ? r : null;
};

export type VistaDocumento = { posicion: number; remito: string | null; veredicto: Veredicto; enLote: boolean; avisos: { id: string; detalle: string }[] };

/**
 * "Qué se sella": calcula, SIN tocar la red, qué documentos entrarían al lote, cuáles quedan afuera y por qué,
 * y la huella exacta (raíz y memo) que iría a Stellar. Usa la misma lógica que sellarLote.
 */
export function previsualizarLote(entradas: unknown[]) {
  if (!Array.isArray(entradas) || entradas.length === 0) throw new Error("Mandá al menos un documento");
  if (entradas.length > MAX_DOCUMENTOS) throw new Error(`Máximo ${MAX_DOCUMENTOS} documentos por lote`);
  const documentos: VistaDocumento[] = [];
  const hashes: string[] = [];
  entradas.forEach((entrada, posicion) => {
    const ev = evaluarEntrada(entrada);
    const enLote = ev.veredicto !== "rojo" && ev.documento !== null;
    documentos.push({ posicion, remito: remitoDe(ev.documento), veredicto: ev.veredicto, enLote, avisos: motivosDe(ev.reglas) });
    if (enLote) hashes.push(manifestHashDe({ documento: ev.documento, reglasVersion: VERSION_REGLAS, reglasIds: ev.reglas.map((r) => r.id), veredicto: ev.veredicto }));
  });
  const sellan = hashes.length;
  const raiz = sellan ? construir(hashes).raiz : null;
  return {
    reglasVersion: VERSION_REGLAS,
    esquema: "galcoa.batch.v2",
    red: RED,
    sellan,
    afuera: documentos.length - sellan,
    raiz,
    memo: raiz ? memoDelLote(raiz, sellan) : null,
    documentos,
  };
}

export const ESQUEMA_ARCHIVO = "galcoa.stellar.archivo.v1";

/** Archivo del lote para guardar por fuera de la red: sellado + todos los comprobantes con su prueba. */
export function armarArchivo(
  sellado: { raiz: string; memo: string; cantidadHojas: number; txHash: string; ledger: number; cierreLedger?: string | null },
  comprobantes: Comprobante[],
) {
  return { schemaVersion: ESQUEMA_ARCHIVO, red: RED, reglasVersion: VERSION_REGLAS, sellado, comprobantes };
}
