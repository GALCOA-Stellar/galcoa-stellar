// Mide en TESTNET costo y tiempo de sellar N documentos de a uno (N transacciones) contra un lote (1 transacción).
// Usa una cuenta descartable nueva; no toca ninguna clave del proyecto.
import { Asset, BASE_FEE, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";

const N = Number(process.argv[2] ?? 10);
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const kp = Keypair.random();
await fetch("https://friendbot.stellar.org/?addr=" + kp.publicKey());
const h = (b) => createHash("sha256").update(b).digest();
const huella = (i) => h("documento-" + i).toString("hex");

async function sellar(memoHex) {
  const t0 = performance.now();
  const tx = new TransactionBuilder(await horizon.loadAccount(kp.publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: kp.publicKey(), asset: Asset.native(), amount: "0.0000001" }))
    .addMemo(Memo.hash(memoHex)).setTimeout(60).build();
  tx.sign(kp);
  const r = await horizon.submitTransaction(tx);
  return { ms: performance.now() - t0, fee: Number(r.fee_charged) };
}

// Merkle local (hojas h(0x00||x), nodos h(0x01||l||r), igual que el proyecto)
function raizMerkle(hojas) {
  let nivel = hojas.map((x) => h(Buffer.concat([Buffer.from([0]), Buffer.from(x, "hex")])));
  let niveles = 1;
  while (nivel.length > 1) {
    const sig = [];
    for (let i = 0; i < nivel.length; i += 2) sig.push(h(Buffer.concat([Buffer.from([1]), nivel[i], nivel[i + 1] ?? nivel[i]])));
    nivel = sig; niveles++;
  }
  return { raiz: nivel[0].toString("hex"), niveles };
}

const individuales = [];
for (let i = 0; i < N; i++) individuales.push(await sellar(huella(i)));
const tLocal0 = performance.now();
const { raiz, niveles } = raizMerkle(Array.from({ length: N }, (_, i) => huella(i)));
const msMerkle = performance.now() - tLocal0;
const lote = await sellar(raiz);

const suma = (a, k) => a.reduce((s, x) => s + x[k], 0);
const salida = {
  documentos: N,
  individual: { transacciones: N, tiempoTotalSeg: +(suma(individuales, "ms") / 1000).toFixed(2), tiempoPromedioSeg: +(suma(individuales, "ms") / N / 1000).toFixed(2), comisionStroops: suma(individuales, "fee"), comisionXLM: suma(individuales, "fee") / 1e7 },
  lote: { transacciones: 1, tiempoSeg: +(lote.ms / 1000).toFixed(2), calculoMerkleMs: +msMerkle.toFixed(2), comisionStroops: lote.fee, comisionXLM: lote.fee / 1e7, hashesPorComprobante: niveles - 1 },
  ahorro: { transacciones: `${N} -> 1`, comision: `${((1 - lote.fee / suma(individuales, "fee")) * 100).toFixed(0)}%` },
};
console.log(JSON.stringify(salida, null, 2));
