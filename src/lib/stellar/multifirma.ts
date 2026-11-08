import { Account, Asset, BASE_FEE, FeeBumpTransaction, Keypair, Memo, Networks, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

/**
 * Sello con aprobación 2 de 2 (multifirma nativa de Stellar).
 *
 * La cuenta de sellado se configura en la red con varios firmantes de peso 1, la clave maestra en 0 y umbral medio 2:
 * la RED rechaza cualquier sello que no lleve al menos dos firmas distintas. Acá se arma la transacción (sin firmar),
 * cada persona la firma con su billetera y, antes de enviarla, el servidor revisa que dice exactamente lo que debe decir.
 * Esta revisión es una segunda barrera: la primera es la propia red.
 */

export const PASSPHRASE = Networks.TESTNET;
export const MONTO_SELLO = "0.0000001";
/** Tiempo para juntar las dos firmas (en pasos las firman dos personas): 10 minutos. */
export const VIGENCIA_TX_S = 600;

/** Transacción de sellado SIN firmar: un pago mínimo de la cuenta a sí misma que lleva la huella del lote en el memo. */
export function armarTxSello(cuentaSelladora: string, secuencia: string, memoHex: string): string {
  if (!/^[0-9a-f]{64}$/.test(memoHex)) throw new Error("Huella inválida");
  return new TransactionBuilder(new Account(cuentaSelladora, secuencia), { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(Operation.payment({ destination: cuentaSelladora, asset: Asset.native(), amount: MONTO_SELLO }))
    .addMemo(Memo.hash(memoHex))
    .setTimeout(VIGENCIA_TX_S)
    .build()
    .toXDR();
}

/** Si la transacción viene envuelta para que otra cuenta pague la comisión, mira la de adentro. */
export const internaDe = (tx: Transaction | FeeBumpTransaction): Transaction => (tx instanceof FeeBumpTransaction ? tx.innerTransaction : tx);

export type EntradaSello = {
  cuentaSelladora: string;
  memoEsperado: string;
  autorizadas: string[];
  identidadDe: (cuenta: string) => string;
  /** Identificadores internos de quienes cargaron los documentos que entran al lote. */
  cargadores: string[];
  ahora?: number;
};
export type ResultadoSello = { ok: true; firmantes: string[]; identidades: string[] } | { ok: false; motivo: string };

/** Revisa la transacción firmada: contenido exacto, vigencia y que haya firmas válidas de dos personas distintas. */
export function evaluarSello(xdr: unknown, e: EntradaSello): ResultadoSello {
  if (typeof xdr !== "string" || xdr.length === 0 || xdr.length > 20_000) return { ok: false, motivo: "Falta la transacción firmada" };
  let tx: Transaction;
  try {
    const t = TransactionBuilder.fromXDR(xdr, PASSPHRASE);
    if (t instanceof FeeBumpTransaction) return { ok: false, motivo: "Mandá la transacción sin envoltorio: la comisión la paga el servicio" };
    tx = t;
  } catch {
    return { ok: false, motivo: "La transacción no se puede leer" };
  }
  if (tx.source !== e.cuentaSelladora) return { ok: false, motivo: "La transacción no es de la cuenta de sellado" };
  if (tx.memo.type !== "hash" || !tx.memo.value || Buffer.from(tx.memo.value as Uint8Array).toString("hex") !== e.memoEsperado)
    return { ok: false, motivo: "La transacción no lleva la huella de este lote" };
  const op = tx.operations[0];
  if (tx.operations.length !== 1 || op.type !== "payment" || op.destination !== e.cuentaSelladora || !op.asset.isNative() || op.amount !== MONTO_SELLO)
    return { ok: false, motivo: "La transacción hace algo distinto de sellar" };
  const maximo = Number(tx.timeBounds?.maxTime ?? 0);
  const ahora = Math.floor((e.ahora ?? Date.now()) / 1000);
  if (!maximo || ahora > maximo) return { ok: false, motivo: "La transacción venció: pedí una nueva" };

  const hash = tx.hash();
  const firmantes = e.autorizadas.filter((cuenta) => {
    const kp = Keypair.fromPublicKey(cuenta);
    return tx.signatures.some((s) => kp.verify(hash, Buffer.from(s.signature.toBytes())));
  });
  const identidades = [...new Set(firmantes.map(e.identidadDe))];
  if (identidades.length < 2) return { ok: false, motivo: "Faltan firmas: se necesitan dos personas distintas" };
  if (identidades.every((i) => e.cargadores.includes(i)))
    return { ok: false, motivo: "Cuatro ojos: al menos una de las firmas tiene que ser de alguien que no cargó documentos de este lote" };
  return { ok: true, firmantes, identidades };
}
