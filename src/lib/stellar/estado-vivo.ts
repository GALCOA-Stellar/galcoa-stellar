import { BASE_FEE, Contract, Networks, TransactionBuilder, nativeToScVal, rpc, scValToNative } from "@stellar/stellar-sdk";
import { conCache } from "../servidor/cache-corto";
import { interpretarSimulacion, type RegistroContrato } from "./contrato";

/**
 * Lecturas de solo lectura a la red de prueba para la portada: nada se firma ni se paga.
 * Los identificadores son públicos (cuentas y contratos de testnet) y el lote de ejemplo es el mismo del comprobante descargable en /spec.
 */
import { REGISTRO_ID, ESCROW_ID, LOTE_EJEMPLO, SERVICIO_ID, RPC_URL } from "../config/contratos";
export { REGISTRO_ID, ESCROW_ID, LOTE_EJEMPLO };

export type EstadoVivo = { ledger: number; lote: RegistroContrato | null; escrowApuntaAlRegistro: boolean | null; escrowPausado: boolean | null };

/** Abre una conexión de solo lectura y devuelve `simular(contrato, función, ...args)`: nada se firma ni se paga. */
async function lectura() {
  const s = new rpc.Server(RPC_URL);
  const cuenta = await s.getAccount(SERVICIO_ID);
  const simular = (id: string, fn: string, ...args: ReturnType<typeof nativeToScVal>[]) =>
    s.simulateTransaction(new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(new Contract(id).call(fn, ...args)).setTimeout(30).build());
  return { s, simular };
}
const huellaScVal = (hex: string) => nativeToScVal(Buffer.from(hex, "hex"), { type: "bytes" });

const conTope = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tiempo")), ms))]);

async function leerEstadoVivoDeLaRed(): Promise<EstadoVivo | null> {
  try {
    const { s, simular } = await lectura();
    const [ult, lote, reg, pausa] = await conTope(Promise.all([
      s.getLatestLedger(),
      simular(REGISTRO_ID, "obtener", huellaScVal(LOTE_EJEMPLO)),
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

/** Estado vivo para la portada y /custodia: la red se lee como mucho cada 30 s por instancia. */
export const leerEstadoVivo = (): Promise<EstadoVivo | null> => conCache("estado-vivo", 30_000, 300_000, leerEstadoVivoDeLaRed);

/** Estado de UN lote leído del contrato de registro (solo lectura): para el enlace público /lote/[id]. null = no se pudo consultar. */
export function leerLote(idHex: string): Promise<RegistroContrato | null> {
  if (!/^[0-9a-f]{64}$/.test(idHex)) return Promise.resolve(null);
  return conCache(`lote:${idHex}`, 15_000, 120_000, () => leerLoteDeLaRed(idHex));
}
async function leerLoteDeLaRed(idHex: string): Promise<RegistroContrato | null> {
  try {
    const { simular } = await lectura();
    const sim = await conTope(simular(REGISTRO_ID, "obtener", huellaScVal(idHex)), 8000);
    return interpretarSimulacion(sim, REGISTRO_ID);
  } catch {
    return null;
  }
}
