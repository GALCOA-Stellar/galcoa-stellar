// Prueba en TESTNET el contrato registro-lotes: cuatro ojos aplicados por la red y costo real.
// Uso: CONTRATO=C... SECRETO_CARGADOR=S... SECRETO_APROBADOR=S... node scripts/probar-contrato.mjs   (cuentas de PRUEBA)
import { Address, BASE_FEE, Contract, Keypair, Networks, Operation, TransactionBuilder, authorizeEntry, nativeToScVal, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { createHash, randomBytes } from "node:crypto";

const { CONTRATO, SECRETO_CARGADOR, SECRETO_APROBADOR } = process.env;
if (!CONTRATO || !SECRETO_CARGADOR || !SECRETO_APROBADOR) { console.error("Faltan CONTRATO, SECRETO_CARGADOR y SECRETO_APROBADOR"); process.exit(1); }
const server = new rpc.Server("https://soroban-testnet.stellar.org");
const cargador = Keypair.fromSecret(SECRETO_CARGADOR), aprobador = Keypair.fromSecret(SECRETO_APROBADOR);
const contrato = new Contract(CONTRATO);
const huella = createHash("sha256").update(randomBytes(16)).digest();
const bytes32 = (b) => nativeToScVal(b, { type: "bytes" });
const dir = (kp) => new Address(kp.publicKey()).toScVal();

async function armar(metodo, ...args) {
  const cuenta = await server.getAccount(cargador.publicKey());
  return new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(contrato.call(metodo, ...args)).setTimeout(120).build();
}
const motivo = (sim) => (sim.error ?? "").match(/Error\(Contract, #(\d+)\)/)?.[0] ?? String(sim.error ?? "").slice(0, 120);

async function registrar({ cargadorKp, aprobadorKp, firmaAprobador }) {
  const tx = await armar("registrar", bytes32(huella), dir(cargadorKp), dir(aprobadorKp));
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) return { ok: false, etapa: "simulación", motivo: motivo(sim) };
  const listo = rpc.assembleTransaction(tx, sim).build();
  const ult = (await server.getLatestLedger()).sequence + 100;
  const entradas = listo.operations[0].auth ?? [];
  const firmadas = [];
  for (const e of entradas) {
    const c = e.credentials;
    if (c.type === "sorobanCredentialsSourceAccount") { firmadas.push(e); continue; } // la del origen va cubierta por la firma de la transacción
    const quien = Address.fromScAddress(c.value.address).toString();
    if (process.env.DEPURAR) console.error("entrada", c.type, quien);
    firmadas.push(quien === aprobadorKp.publicKey() && !firmaAprobador ? e : await authorizeEntry(e, quien === aprobadorKp.publicKey() ? aprobadorKp : cargadorKp, ult, Networks.TESTNET));
  }
  // en SDK 17 las operaciones de una transacción armada no se modifican: se reconstruye con las autorizaciones firmadas
  const op = listo.operations[0];
  const conAuth = new TransactionBuilder(await server.getAccount(cargador.publicKey()), { fee: listo.fee, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.invokeHostFunction({ func: op.func, auth: firmadas }))
    .setSorobanData(sim.transactionData.build())
    .setTimeout(120).build();
  conAuth.sign(cargador);
  const envio = await server.sendTransaction(conAuth);
  if (envio.status === "ERROR") return { ok: false, etapa: "envío", motivo: envio.errorResult?.result()?.switch()?.name ?? "error" };
  let r;
  for (let i = 0; i < 30; i++) { r = await server.getTransaction(envio.hash); if (r.status !== "NOT_FOUND") break; await new Promise((o) => setTimeout(o, 1500)); }
  if (r.status !== "SUCCESS") return { ok: false, etapa: "ejecución", motivo: r.status, hash: envio.hash };
  return { ok: true, hash: envio.hash, ledger: r.ledger, comisionTotalStroops: Number(r.resultXdr.toXdrObject().feeCharged), recursosStroops: Number(sim.minResourceFee) };
}
async function leer(metodo) {
  const sim = await server.simulateTransaction(await armar(metodo, bytes32(huella)));
  return rpc.Api.isSimulationSuccess(sim) ? scValToNative(sim.result.retval) : { error: motivo(sim) };
}

const out = {};
out["1. misma persona como cargador y aprobador"] = await registrar({ cargadorKp: cargador, aprobadorKp: cargador, firmaAprobador: true });
out["2. falta la firma del aprobador"] = await registrar({ cargadorKp: cargador, aprobadorKp: aprobador, firmaAprobador: false });
out["3. existe antes de registrar"] = await leer("existe");
out["4. dos personas distintas con las dos firmas"] = await registrar({ cargadorKp: cargador, aprobadorKp: aprobador, firmaAprobador: true });
out["5. existe después"] = await leer("existe");
const reg = await leer("obtener");
out["6. quién cargó y quién aprobó"] = reg.error ? reg : { cargador: reg.cargador, aprobador: reg.aprobador, ledger: reg.ledger };
out["7. registrar la misma huella otra vez"] = await registrar({ cargadorKp: cargador, aprobadorKp: aprobador, firmaAprobador: true });
console.log(JSON.stringify(out, null, 2));
