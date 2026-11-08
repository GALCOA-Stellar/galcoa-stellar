// Despliega el contrato de custodia (escrow-entrega) en TESTNET con la cuenta del servicio como administradora.
// Uso: node scripts/desplegar-escrow.mjs   (necesita .env.local con SELLADOR_STELLAR_SECRETO; el wasm sale de `cargo build --release --target wasm32v1-none`)
// Imprime solo el ID del contrato nuevo. No toca el contrato vigente: cambiar los IDs es un paso aparte (src/lib/config/contratos.ts).
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { Address, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder, nativeToScVal, rpc, scValToNative } from "@stellar/stellar-sdk";

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

console.log("Subiendo el código (" + wasm.length + " bytes)…");
const subida = await enviar(Operation.uploadContractWasm({ wasm }));
const wasmHash = Buffer.from(scValToNative(subida.returnValue));
console.log("Creando el contrato (registro fijo, administradora = cuenta del servicio)…");
const creado = await enviar(
  Operation.createCustomContract({
    address: new Address(servicio.publicKey()),
    wasmHash,
    salt: randomBytes(32),
    constructorArgs: [new Address(REGISTRO).toScVal(), new Address(servicio.publicKey()).toScVal()],
  }),
);
console.log("ESCROW_NUEVO=" + String(scValToNative(creado.returnValue)));
