import { Asset, FeeBumpTransaction, Keypair, Memo, Networks, Operation, StrKey, Transaction, TransactionBuilder, BASE_FEE, rpc } from "@stellar/stellar-sdk";
import type { Comprobante, Enviador, Prueba } from "./lote";
import { internaDe } from "./multifirma";
import { comisionActual, subirComision, topeDeComision } from "./comision";

// Solo TESTNET. No hay forma de configurar otra red desde afuera.
const RPC_URL = "https://soroban-testnet.stellar.org";
const PASSPHRASE = Networks.TESTNET;
const servidor = () => new rpc.Server(RPC_URL);

async function esperar(hashTx: string) {
  const s = servidor();
  for (let i = 0; i < 30; i++) {
    const r = await s.getTransaction(hashTx);
    if (r.status !== "NOT_FOUND") return r;
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  throw new Error("La red no confirmó a tiempo");
}

/** Sella una huella de 32 bytes en el memo de una transacción de Stellar testnet. */
export const enviarMemo: Enviador = async (memoHex) => {
  const secreto = process.env.SELLADOR_STELLAR_SECRETO;
  if (!secreto) throw new Error("Falta configurar la cuenta selladora de testnet");
  const kp = Keypair.fromSecret(secreto);
  const s = servidor();
  let comision = await comisionActual();
  for (let intento = 0; intento < 3; intento++) {
    const cuenta = await s.getAccount(kp.publicKey());
    const tx = new TransactionBuilder(cuenta, { fee: String(comision), networkPassphrase: PASSPHRASE })
      .addOperation(Operation.payment({ destination: kp.publicKey(), asset: Asset.native(), amount: "0.0000001" }))
      .addMemo(Memo.hash(memoHex))
      .setTimeout(60)
      .build();
    tx.sign(kp);
    const hashTx = Buffer.from(tx.hash()).toString("hex");
    const envio = await s.sendTransaction(tx);
    if (envio.status === "ERROR" || envio.status === "TRY_AGAIN_LATER") {
      if (intento < 2) { comision = subirComision(comision); continue; } // número de secuencia ocupado o red congestionada: se reintenta con más comisión, hasta el tope
      throw new Error(`Stellar rechazó la transacción: ${envio.status} (tope de comisión ${topeDeComision()} stroops)`);
    }
    const r = await esperar(hashTx);
    if (r.status !== "SUCCESS") throw new Error("La transacción no se confirmó");
    const aBase64 = (x: unknown): string => (typeof x === "string" ? x : (x as { toXDR: (f: "base64") => string }).toXDR("base64"));
    const crudo = r as unknown as { envelopeXdr: unknown; resultXdr?: unknown; createdAt?: unknown };
    const creado = Number(crudo.createdAt);
    const prueba: Prueba = {
      ledger: r.ledger,
      cierreLedger: Number.isFinite(creado) && creado > 0 ? new Date(creado * 1000).toISOString() : null,
      envelopeXdr: aBase64(crudo.envelopeXdr),
      resultXdr: crudo.resultXdr ? aBase64(crudo.resultXdr) : null,
    };
    return { txHash: hashTx, ledger: r.ledger, prueba };
  }
  throw new Error("No se pudo enviar");
};

// El RPC guarda solo unos 7 días de historial; el Horizon público de SDF guarda un año (truncado desde el 01/08/2024).
// Horizon figura en mantenimiento en la documentación de Stellar: se usa solo como respaldo para verificar comprobantes viejos.
const HORIZON_URL = "https://horizon-testnet.stellar.org";

/** Interpreta la respuesta de Horizon: devuelve el memo (hash) en hexadecimal si la transacción fue exitosa y su memo es de tipo hash. */
export function memoDeHorizon(j: unknown): { memoHex: string; ledger: number } | null {
  const o = (typeof j === "object" && j !== null ? j : {}) as Record<string, unknown>;
  if (o.successful !== true || o.memo_type !== "hash" || typeof o.memo !== "string" || typeof o.ledger !== "number") return null;
  const memoHex = Buffer.from(o.memo, "base64").toString("hex");
  return /^[0-9a-f]{64}$/.test(memoHex) ? { memoHex, ledger: o.ledger } : null;
}

/** Lee de la red el memo (hash) de una transacción: primero por RPC y, si ya no está en su ventana, por Horizon. */
export async function leerMemo(hashTx: string): Promise<{ memoHex: string; ledger: number } | null> {
  if (!/^[0-9a-f]{64}$/.test(hashTx)) return null;
  const r = await servidor().getTransaction(hashTx);
  if (r.status === "SUCCESS") {
    const tx = internaDe(TransactionBuilder.fromXDR(r.envelopeXdr, PASSPHRASE));
    if (tx.memo.type !== "hash" || !tx.memo.value) return null;
    return { memoHex: Buffer.from(tx.memo.value as Uint8Array).toString("hex"), ledger: r.ledger };
  }
  if (r.status !== "NOT_FOUND") return null;
  try {
    const h = await fetch(`${HORIZON_URL}/transactions/${hashTx}`, { signal: AbortSignal.timeout(15_000) });
    return h.ok ? memoDeHorizon(await h.json()) : null;
  } catch {
    return null;
  }
}

export const cuentaSelladora2de2 = (): string | null => {
  const c = process.env.CUENTA_SELLADORA_2DE2?.trim();
  return c && StrKey.isValidEd25519PublicKey(c) ? c : null;
};

/** Secuencia actual de la cuenta de sellado 2 de 2 (para armar la transacción a firmar). */
export async function secuenciaDe(cuenta: string): Promise<string> {
  return (await servidor().getAccount(cuenta)).sequenceNumber();
}

/**
 * Envía a la red el sello ya firmado por dos personas. Si el servicio tiene cuenta propia (SELLADOR_STELLAR_SECRETO),
 * paga la comisión con una transacción envolvente ("fee bump"): quienes firman no necesitan tener XLM.
 * La red vuelve a exigir las dos firmas: si faltara una, rechaza.
 */
export async function enviarSelloFirmado(xdrFirmado: string): Promise<{ txHash: string; ledger: number; prueba: Prueba; comisionPagadaPor: string | null }> {
  const interna = TransactionBuilder.fromXDR(xdrFirmado, PASSPHRASE) as Transaction;
  const secreto = process.env.SELLADOR_STELLAR_SECRETO;
  let aEnviar: Transaction | FeeBumpTransaction = interna;
  let pagador: string | null = null;
  if (secreto) {
    const kp = Keypair.fromSecret(secreto);
    aEnviar = TransactionBuilder.buildFeeBumpTransaction(kp, String(await comisionActual()), interna, PASSPHRASE);
    aEnviar.sign(kp);
    pagador = kp.publicKey();
  }
  const hashTx = Buffer.from(aEnviar.hash()).toString("hex");
  const envio = await servidor().sendTransaction(aEnviar);
  if (envio.status === "ERROR" || envio.status === "TRY_AGAIN_LATER") throw new Error("Stellar rechazó el sello: falta alguna firma o la transacción ya no es válida");
  const r = await esperar(hashTx);
  if (r.status !== "SUCCESS") throw new Error("La transacción no se confirmó");
  const crudo = r as unknown as { envelopeXdr: unknown; resultXdr?: unknown; createdAt?: unknown };
  const aBase64 = (x: unknown): string => (typeof x === "string" ? x : (x as { toXDR: (f: "base64") => string }).toXDR("base64"));
  const creado = Number(crudo.createdAt);
  return {
    txHash: hashTx,
    ledger: r.ledger,
    comisionPagadaPor: pagador,
    prueba: {
      ledger: r.ledger,
      cierreLedger: Number.isFinite(creado) && creado > 0 ? new Date(creado * 1000).toISOString() : null,
      envelopeXdr: aBase64(crudo.envelopeXdr),
      resultXdr: crudo.resultXdr ? aBase64(crudo.resultXdr) : null,
    },
  };
}

export const urlExplorador =(hashTx: string) => `https://stellar.expert/explorer/testnet/tx/${hashTx}`;

/**
 * Verifica SIN red la prueba guardada: el sobre firmado tiene el hash de transacción declarado y su memo es la huella esperada.
 * Esto prueba qué contenía la transacción; por sí solo no prueba que la red la haya incluido.
 */
export function verificarPruebaLocal(c: Comprobante, memoEsperado: string): { ok: boolean; motivo: string } {
  const p = c.prueba;
  if (!p || typeof p.envelopeXdr !== "string") return { ok: false, motivo: "El comprobante no trae prueba guardada" };
  try {
    const externa = TransactionBuilder.fromXDR(p.envelopeXdr, PASSPHRASE);
    if (Buffer.from(externa.hash()).toString("hex") !== c.txHash) return { ok: false, motivo: "La prueba guardada no corresponde a esa transacción" };
    const tx = internaDe(externa); // con comisión pagada por otra cuenta, el memo está en la transacción de adentro
    if (tx.memo.type !== "hash" || !tx.memo.value) return { ok: false, motivo: "La transacción guardada no tiene memo de tipo hash" };
    const memo = Buffer.from(tx.memo.value as Uint8Array).toString("hex");
    return memo === memoEsperado
      ? { ok: true, motivo: "La transacción guardada contiene exactamente la huella de este lote" }
      : { ok: false, motivo: "El memo de la prueba guardada no coincide con el lote" };
  } catch {
    return { ok: false, motivo: "No se pudo leer la prueba guardada" };
  }
}
