// Cuenta del servicio con firmas de respaldo (#55). Dos modos:
//
//   node scripts/multifirma-servicio.mjs prueba
//     Prueba en TESTNET con cuentas descartables (friendbot). No usa ni toca ninguna clave del proyecto. Muestra que:
//     (1) el servidor opera solo, (2) una sola clave NO cambia firmantes, (3) dos de tres SÍ,
//     (4) perdida la clave del servidor, las dos de respaldo la reemplazan y la cuenta sigue operando.
//
//   RESPALDO_1=G... RESPALDO_2=G... node scripts/multifirma-servicio.mjs armar
//     Arma (SIN FIRMAR) la transacción que configura la cuenta real del servicio (SERVICIO_ID de src/lib/config/contratos.ts).
//     Imprime el XDR para firmarlo con la clave del servicio en Stellar Lab o en una billetera. Este script no lee claves secretas.
import { readFileSync } from "node:fs";
import { Account, Asset, BASE_FEE, Horizon, Keypair, Networks, Operation, StrKey, TransactionBuilder } from "@stellar/stellar-sdk";

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const P = Networks.TESTNET;
const UMBRALES = { masterWeight: 1, lowThreshold: 1, medThreshold: 1, highThreshold: 2 }; // igual que src/lib/stellar/rotacion.ts
const modo = process.argv[2];

const tx = async (cuenta, ops) => {
  const b = new TransactionBuilder(await horizon.loadAccount(cuenta), { fee: BASE_FEE, networkPassphrase: P }).setTimeout(120);
  for (const op of ops) b.addOperation(op);
  return b.build();
};
const enviar = async (t, firmantes) => {
  for (const f of firmantes) t.sign(f);
  try {
    await horizon.submitTransaction(t);
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e?.response?.data?.extras?.result_codes?.transaction ?? String(e.message).slice(0, 80) };
  }
};
let fallos = 0;
const esperar = (cond, texto) => {
  console.log(`${cond ? "✔" : "✖"} ${texto}`);
  if (!cond) fallos++;
};

if (modo === "prueba") {
  const fondear = async (kp) => {
    const r = await fetch("https://friendbot.stellar.org/?addr=" + kp.publicKey());
    if (!r.ok) throw new Error("friendbot " + r.status);
  };
  const servicio = Keypair.random(), r1 = Keypair.random(), r2 = Keypair.random(), nueva = Keypair.random(), intrusa = Keypair.random();
  await fondear(servicio);
  const S = servicio.publicKey();
  const pago = () => tx(S, [Operation.payment({ destination: S, asset: Asset.native(), amount: "0.0000001" })]);
  console.log("Cuenta del servicio (descartable):", S);

  let r = await enviar(await tx(S, [Operation.setOptions({ signer: { ed25519PublicKey: r1.publicKey(), weight: 1 } }), Operation.setOptions({ signer: { ed25519PublicKey: r2.publicKey(), weight: 1 } }), Operation.setOptions(UMBRALES)]), [servicio]);
  esperar(r.ok, "Configurada: servidor + dos respaldos, operar = 1 firma, cambiar firmantes = 2 firmas");

  r = await enviar(await pago(), [servicio]);
  esperar(r.ok, "El servidor opera solo, como hoy (umbral medio = 1)");

  r = await enviar(await tx(S, [Operation.setOptions({ signer: { ed25519PublicKey: intrusa.publicKey(), weight: 1 } })]), [servicio]);
  esperar(!r.ok, `Una sola clave (la del servidor) NO puede sumar un firmante${r.ok ? "" : " — la red respondió " + r.motivo}`);

  r = await enviar(await tx(S, [Operation.setOptions({ signer: { ed25519PublicKey: intrusa.publicKey(), weight: 1 } })]), [r1]);
  esperar(!r.ok, "Una sola clave de respaldo tampoco");

  // Se "pierde" la clave del servidor: las dos de respaldo hacen entrar una nueva y le ponen peso 0 a la original, en una sola transacción.
  r = await enviar(await tx(S, [Operation.setOptions({ signer: { ed25519PublicKey: nueva.publicKey(), weight: 1 } }), Operation.setOptions({ masterWeight: 0 })]), [r1, r2]);
  esperar(r.ok, "Perdida la clave del servidor, dos respaldos la reemplazan (2 de 3)");

  r = await enviar(await pago(), [servicio]);
  esperar(!r.ok, "La clave vieja ya no sirve");
  r = await enviar(await pago(), [nueva]);
  esperar(r.ok, "La clave nueva opera sola: la cuenta (y SERVICIO_ID) no cambió y nada se redesplegó");

  const datos = await horizon.loadAccount(S);
  console.log("Firmantes finales:", datos.signers.map((s) => `${s.key.slice(0, 6)}…:${s.weight}`).join(", "), "| umbrales", JSON.stringify(datos.thresholds));
  console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} comprobación(es) fallaron.`);
  process.exit(fallos === 0 ? 0 : 1);
} else if (modo === "armar") {
  const fuente = readFileSync(new URL("../src/lib/config/contratos.ts", import.meta.url), "utf8");
  const S = /export const SERVICIO_ID = "(G[A-Z2-7]{55})"/.exec(fuente)?.[1];
  const respaldos = [process.env.RESPALDO_1, process.env.RESPALDO_2];
  if (!S) throw new Error("No encontré SERVICIO_ID en src/lib/config/contratos.ts");
  if (!respaldos.every((r) => r && StrKey.isValidEd25519PublicKey(r))) throw new Error("Faltan RESPALDO_1 y RESPALDO_2 (claves PÚBLICAS G..., una por persona)");
  if (new Set([S, ...respaldos]).size !== 3) throw new Error("Los tres firmantes tienen que ser distintos");
  const cuenta = await horizon.loadAccount(S);
  const t = new TransactionBuilder(new Account(S, cuenta.sequence), { fee: BASE_FEE, networkPassphrase: P })
    .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: respaldos[0], weight: 1 } }))
    .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: respaldos[1], weight: 1 } }))
    .addOperation(Operation.setOptions(UMBRALES))
    .setTimeout(1800)
    .build();
  console.log("Transacción SIN FIRMAR (vence en 30 minutos). Firmala con la clave del servicio en Stellar Lab y enviala:\n");
  console.log(t.toXDR());
} else {
  console.log("Uso: node scripts/multifirma-servicio.mjs prueba | armar   (ver el comentario del principio)");
  process.exit(2);
}
