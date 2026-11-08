// Compara en TESTNET tres formas de dejar una huella en Stellar: memo, entrada de datos de cuenta y escritura de contrato (simulada).
import { Address, Asset, BASE_FEE, Contract, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder, nativeToScVal, rpc } from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const soroban = new rpc.Server("https://soroban-testnet.stellar.org");
const kp = Keypair.random();
await fetch("https://friendbot.stellar.org/?addr=" + kp.publicKey());
const huella = createHash("sha256").update("comparacion").digest();
const base = async () => new TransactionBuilder(await horizon.loadAccount(kp.publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET });
const salida = {};

// A) memo
let tx = (await base()).addOperation(Operation.payment({ destination: kp.publicKey(), asset: Asset.native(), amount: "0.0000001" })).addMemo(Memo.hash(huella.toString("hex"))).setTimeout(60).build();
tx.sign(kp);
let r = await horizon.submitTransaction(tx);
salida.memo = { comisionStroops: Number(r.fee_charged), bytesEnTransaccion: tx.toEnvelope().toXDR().length, reservaBloqueadaXLM: 0 };

// B) entrada de datos de cuenta (valor de hasta 64 bytes; bloquea 0,5 XLM de reserva por entrada)
const antes = await horizon.loadAccount(kp.publicKey());
tx = (await base()).addOperation(Operation.manageData({ name: "galcoa:lote:0001", value: huella })).setTimeout(60).build();
tx.sign(kp);
r = await horizon.submitTransaction(tx);
const despues = await horizon.loadAccount(kp.publicKey());
salida.entradaDeDatos = {
  comisionStroops: Number(r.fee_charged), bytesEnTransaccion: tx.toEnvelope().toXDR().length,
  subentradasAntesDespues: [antes.subentry_count, despues.subentry_count],
  reservaMinimaAntesDespuesXLM: [0.5 * (2 + antes.subentry_count), 0.5 * (2 + despues.subentry_count)],
};

// C) escritura de contrato: se simula una transferencia del contrato nativo (SAC) como referencia de costo de recursos de un contrato
const sac = new Contract(Asset.native().contractId(Networks.TESTNET));
const cuenta = await soroban.getAccount(kp.publicKey());
const itx = new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(sac.call("transfer", new Address(kp.publicKey()).toScVal(), new Address(Keypair.random().publicKey()).toScVal(), nativeToScVal(20_000_000n, { type: "i128" })))
  .setTimeout(60).build();
const sim = await soroban.simulateTransaction(itx);
salida.contratoReferencia = rpc.Api.isSimulationSuccess(sim)
  ? { operacion: "transferencia SAC simulada (referencia, no es nuestro contrato)", resourceFeeMinimoStroops: Number(sim.minResourceFee), mas_inclusion_stroops: 100 }
  : { error: String(sim.error ?? "simulación fallida").slice(0, 300) };
const info = await (await fetch("https://horizon-testnet.stellar.org/fee_stats")).json();
salida.feeStatsHorizon = { baseFee: info.last_ledger_base_fee, p50: info.fee_charged.p50, p99: info.fee_charged.p99 };
console.log(JSON.stringify(salida, null, 2));
