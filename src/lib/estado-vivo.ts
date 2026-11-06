import { BASE_FEE, Contract, Networks, TransactionBuilder, nativeToScVal, rpc, scValToNative } from "@stellar/stellar-sdk";
import { interpretarSimulacion, type RegistroContrato } from "./contrato";

/**
 * Lecturas de solo lectura a la red de prueba para la portada: nada se firma ni se paga.
 * Los identificadores son públicos (cuentas y contratos de testnet) y el lote de ejemplo es el mismo del comprobante descargable en /spec.
 */
export const REGISTRO_ID = "CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV";
export const ESCROW_ID = "CASLCSQ3QYDJBPVLQS275HMMDDWJSNUQDS3Q7ES36ZPQWWADPRTID5G6";
export const LOTE_EJEMPLO = "ec5dedf0b5c18380f39a9d29b2021023e91a857e7849cda71b5d6739a6dc5b76";
const ORIGEN = "GCRTRAAGPQJSP444J5QSIBM5MILRUI4XKL36Z4UW7OEE43TAC6X3EI3Y";

export type EstadoVivo = { ledger: number; lote: RegistroContrato | null; escrowApuntaAlRegistro: boolean | null; escrowPausado: boolean | null };

const conTope = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tiempo")), ms))]);

export async function leerEstadoVivo(): Promise<EstadoVivo | null> {
  try {
    const s = new rpc.Server("https://soroban-testnet.stellar.org");
    const cuenta = await s.getAccount(ORIGEN);
    const simular = (id: string, fn: string, ...args: ReturnType<typeof nativeToScVal>[]) =>
      s.simulateTransaction(new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(new Contract(id).call(fn, ...args)).setTimeout(30).build());
    const [ult, lote, reg, pausa] = await conTope(Promise.all([
      s.getLatestLedger(),
      simular(REGISTRO_ID, "obtener", nativeToScVal(Buffer.from(LOTE_EJEMPLO, "hex"), { type: "bytes" })),
      simular(ESCROW_ID, "registro"),
      simular(ESCROW_ID, "pausado"),
    ]), 8000);
    const leer = (sim: typeof reg) => (rpc.Api.isSimulationSuccess(sim) && sim.result ? scValToNative(sim.result.retval) : null);
    const r = leer(reg), p = leer(pausa);
    return { ledger: ult.sequence, lote: interpretarSimulacion(lote, REGISTRO_ID), escrowApuntaAlRegistro: r === null ? null : String(r) === REGISTRO_ID, escrowPausado: p === null ? null : Boolean(p) };
  } catch {
    return null;
  }
}
