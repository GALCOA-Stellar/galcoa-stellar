// Despliega el contrato de custodia (escrow-entrega) en TESTNET con la cuenta del servicio como administradora.
// Uso: node scripts/desplegar-escrow.mjs   (necesita .env.local con SELLADOR_STELLAR_SECRETO; el wasm sale de `cargo build --release --target wasm32v1-none`)
// Imprime solo el ID del contrato nuevo. No toca el contrato vigente: cambiar los IDs es un paso aparte (src/lib/config/contratos.ts).
// Lista blanca de tokens (#56): queda FIJA al crear el contrato. Por defecto, solo el token de prueba GALCOAT emitido por la
// cuenta del servicio (el que usan las pruebas de punta a punta). TOKENS_PERMITIDOS=C...,C... agrega otros (por ejemplo USDC de prueba).
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { Address, Asset, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const REGISTRO = readFileSync(new URL("../src/lib/config/contratos.ts", import.meta.url), "utf8").match(/REGISTRO_ID\s*=\s*"(C[A-Z0-9]{55})"/)[1];
const servicio = Keypair.fromSecret(env.SELLADOR_STELLAR_SECRETO);
const wasm = readFileSync(process.env.WASM ?? new URL("../contracts/escrow-entrega/target/wasm32v1-none/release/escrow_entrega.wasm", import.meta.url)); // WASM=ruta: el wasm que publicó el CI
const servidor = new rpc.Server("https://soroban-testnet.stellar.org");
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function enviar(operacion) {
  const base = new TransactionBuilder(await servidor.getAccount(servicio.publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).addOperation(operacion).setTimeout(120).build();
  const sim = await servidor.simulateTransaction(base);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error("simulación falló: " + String(sim.error).slice(0, 200));
  const tx = rpc.assembleTransaction(base, sim).build();
  tx.sign(servicio);
  const envio = await servidor.sendTransaction(tx);
  if (envio.status === "ERROR") throw new Error("rechazada");
  for (let i = 0; i < 60; i++) {
    const r = await servidor.getTransaction(envio.hash);
    if (r.status === "SUCCESS") return r;
    if (r.status === "FAILED") throw new Error("falló en la red");
    await dormir(1500);
  }
  throw new Error("sin confirmar");
}

const GALCOAT = new Asset("GALCOAT", servicio.publicKey());
const extra = (process.env.TOKENS_PERMITIDOS ?? "").split(",").map((t) => t.trim()).filter(Boolean);
for (const t of extra) if (!/^C[A-Z2-7]{55}$/.test(t)) throw new Error("TOKENS_PERMITIDOS: dirección de contrato inválida: " + t);
const tokens = [...new Set([GALCOAT.contractId(Networks.TESTNET), ...extra])];
if (tokens.length > 10) throw new Error("La custodia acepta como mucho 10 tokens");
try {
  await enviar(Operation.createStellarAssetContract({ asset: GALCOAT })); // si ya existía, la simulación falla y se sigue
} catch {
  /* el contrato del token ya existía */
}
console.log("Tokens permitidos (fijos): " + tokens.join(", "));

console.log("Subiendo el código (" + wasm.length + " bytes)…");
const subida = await enviar(Operation.uploadContractWasm({ wasm }));
const wasmHash = Buffer.from(scValToNative(subida.returnValue));
console.log("Creando el contrato (registro fijo, administradora = cuenta del servicio)…");
const creado = await enviar(
  Operation.createCustomContract({
    address: new Address(servicio.publicKey()),
    wasmHash,
    salt: randomBytes(32),
    constructorArgs: [new Address(REGISTRO).toScVal(), new Address(servicio.publicKey()).toScVal(), xdr.ScVal.scvVec(tokens.map((t) => new Address(t).toScVal()))],
  }),
);
console.log("ESCROW_NUEVO=" + String(scValToNative(creado.returnValue)));
