// Crea en TESTNET la cuenta de sellado 2 de 2: firmantes = CUENTAS_AUTORIZADAS (de .env.local), cada uno con peso 1,
// clave maestra con peso 0 y umbral 2. La clave secreta temporal se descarta: nadie puede saltearse las dos firmas.
import { Horizon, Keypair, Networks, Operation, StrKey, TransactionBuilder, BASE_FEE } from "@stellar/stellar-sdk";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const firmantes = (env.CUENTAS_AUTORIZADAS ?? "").split(",").map((c) => c.trim().split("=")[0].trim()).filter(Boolean);
if (firmantes.length < 2 || !firmantes.every((c) => StrKey.isValidEd25519PublicKey(c))) {
  console.error("Hacen falta al menos 2 cuentas válidas (G...) en CUENTAS_AUTORIZADAS de .env.local"); process.exit(1);
}
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const kp = Keypair.random();
const r = await fetch("https://friendbot.stellar.org/?addr=" + kp.publicKey());
if (!r.ok) throw new Error("friendbot " + r.status);
const b = new TransactionBuilder(await horizon.loadAccount(kp.publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET });
firmantes.forEach((g) => b.addOperation(Operation.setOptions({ signer: { ed25519PublicKey: g, weight: 1 } })));
b.addOperation(Operation.setOptions({ masterWeight: 0, lowThreshold: 1, medThreshold: 2, highThreshold: 2 }));
const tx = b.setTimeout(60).build();
tx.sign(kp);
await horizon.submitTransaction(tx);
console.log("Cuenta de sellado 2 de 2 creada. Agregá esto a .env.local:\nCUENTA_SELLADORA_2DE2=" + kp.publicKey());
