// Prueba en TESTNET de la multifirma nativa de Stellar: una cuenta de sellado que exige DOS firmas.
// Crea cuentas nuevas descartables (friendbot), no usa ni toca ninguna clave del proyecto.
import { Asset, BASE_FEE, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const fondear = async (kp) => {
  const r = await fetch("https://friendbot.stellar.org/?addr=" + kp.publicKey());
  if (!r.ok) throw new Error("friendbot " + r.status);
};
const construir = async (origen, memoHex) =>
  new TransactionBuilder(await horizon.loadAccount(origen), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: origen, asset: Asset.native(), amount: "0.0000001" }))
    .addMemo(Memo.hash(memoHex))
    .setTimeout(60)
    .build();

const selladora = Keypair.random(), cargador = Keypair.random(), aprobador = Keypair.random();
await fondear(selladora);
console.log("1. Cuenta selladora creada:", selladora.publicKey());

// La clave maestra pasa a peso 0; dos firmantes de peso 1; operaciones medias (pagos) piden umbral 2.
let tx = new TransactionBuilder(await horizon.loadAccount(selladora.publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: cargador.publicKey(), weight: 1 } }))
  .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: aprobador.publicKey(), weight: 1 } }))
  .addOperation(Operation.setOptions({ masterWeight: 0, lowThreshold: 1, medThreshold: 2, highThreshold: 2 }))
  .setTimeout(60).build();
tx.sign(selladora);
await horizon.submitTransaction(tx);
console.log("2. Configurada: dos firmantes de peso 1, umbral medio = 2, clave maestra = 0");

const memo = createHash("sha256").update("prueba-multifirma-galcoa").digest("hex");
const resultados = {};

// a) una sola firma debe fallar
tx = await construir(selladora.publicKey(), memo);
tx.sign(cargador);
try { await horizon.submitTransaction(tx); resultados.unaFirma = "ACEPTADA (mal)"; }
catch (e) { resultados.unaFirma = "RECHAZADA: " + (e?.response?.data?.extras?.result_codes?.transaction ?? e.message); }
console.log("3. Con UNA firma:", resultados.unaFirma);

// b) la clave maestra (peso 0) tampoco alcanza
tx = await construir(selladora.publicKey(), memo);
tx.sign(selladora);
try { await horizon.submitTransaction(tx); resultados.maestra = "ACEPTADA (mal)"; }
catch (e) { resultados.maestra = "RECHAZADA: " + (e?.response?.data?.extras?.result_codes?.transaction ?? e.message); }
console.log("4. Con la clave maestra sola:", resultados.maestra);

// c) dos firmas distintas deben funcionar
tx = await construir(selladora.publicKey(), memo);
tx.sign(cargador); tx.sign(aprobador);
const ok = await horizon.submitTransaction(tx);
resultados.dosFirmas = "ACEPTADA, hash " + ok.hash + ", ledger " + ok.ledger;
console.log("5. Con DOS firmas:", resultados.dosFirmas);
console.log("   https://stellar.expert/explorer/testnet/tx/" + ok.hash);
console.log(JSON.stringify({ cuenta: selladora.publicKey(), ...resultados }, null, 2));
