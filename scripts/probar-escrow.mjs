// Prueba del escrow de entrega en TESTNET con cuentas y un asset descartables (sin dinero real).
// Uso: node scripts/probar-escrow.mjs   (necesita .env.local con SELLADOR_STELLAR_SECRETO y CONTRATO_REGISTRO_ID, y ESCROW_ID en el entorno)
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { Address, Asset, BASE_FEE, Contract, Keypair, Networks, Operation, TransactionBuilder, authorizeEntry, nativeToScVal, rpc, scValToNative } from "@stellar/stellar-sdk";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const REGISTRO = process.env.CONTRATO_REGISTRO_ID ?? env.CONTRATO_REGISTRO_ID;
const ESCROW = process.env.ESCROW_ID;
if (!REGISTRO || !ESCROW) { console.error("Faltan CONTRATO_REGISTRO_ID (.env.local) y ESCROW_ID (entorno)"); process.exit(1); }
const servicio = Keypair.fromSecret(env.SELLADOR_STELLAR_SECRETO);
const RPC = new rpc.Server("https://soroban-testnet.stellar.org");
const HORIZON = "https://horizon-testnet.stellar.org";
const P = Networks.TESTNET;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
// Cada corrida usa huellas y tratos NUEVOS (el registro es permanente: repetir una huella daría "ya registrado").
const CORRIDA = randomBytes(8).toString("hex");
const b32 = (n) => nativeToScVal(createHash("sha256").update(CORRIDA + ":" + n).digest(), { type: "bytes" });
const addr = (kp) => new Address(kp.publicKey()).toScVal();
const i128 = (n) => nativeToScVal(BigInt(n), { type: "i128" });
const u32 = (n) => nativeToScVal(n, { type: "u32" });

async function fondear(kp) { const r = await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`); if (!r.ok) throw new Error("friendbot " + r.status); }
async function esperar(hash) { for (let i = 0; i < 40; i++) { const r = await RPC.getTransaction(hash); if (r.status === "SUCCESS") return r; if (r.status === "FAILED") throw new Error("falló en la red"); await dormir(1500); } throw new Error("sin confirmar"); }

/** Llama a un contrato. Devuelve {ok, valor, error}. Los errores del contrato salen como "#N". */
async function invocar(origen, id, fn, args, firmantes = []) {
  try {
    const base = new TransactionBuilder(await RPC.getAccount(origen.publicKey()), { fee: BASE_FEE, networkPassphrase: P }).addOperation(new Contract(id).call(fn, ...args)).setTimeout(120).build();
    const sim = await RPC.simulateTransaction(base);
    if (!rpc.Api.isSimulationSuccess(sim)) return { ok: false, error: (String(sim.error).match(/Error\(Contract, #(\d+)\)/) ?? [, String(sim.error).slice(0, 120)])[1] };
    const armada = rpc.assembleTransaction(base, sim).build();
    const hasta = (await RPC.getLatestLedger()).sequence + 100;
    const op = armada.operations[0];
    const auth = [];
    for (const e of op.auth ?? []) {
      if (e.credentials.type === "sorobanCredentialsSourceAccount") { auth.push(e); continue; }
      const quien = Address.fromScAddress(e.credentials.value.address).toString();
      const kp = [origen, ...firmantes].find((k) => k.publicKey() === quien);
      if (!kp) return { ok: false, error: "falta firmante " + quien.slice(0, 6) };
      auth.push(await authorizeEntry(e, kp, hasta, P));
    }
    const final = new TransactionBuilder(await RPC.getAccount(origen.publicKey()), { fee: armada.fee, networkPassphrase: P })
      .addOperation(Operation.invokeHostFunction({ func: op.func, auth })).setSorobanData(sim.transactionData.build()).setTimeout(120).build();
    final.sign(origen);
    const envio = await RPC.sendTransaction(final);
    if (envio.status === "ERROR") return { ok: false, error: "rechazada" };
    const r = await esperar(envio.hash);
    return { ok: true, valor: r.returnValue ? scValToNative(r.returnValue) : undefined, fee: Number(r.resultXdr.toXdrObject().feeCharged), hash: envio.hash };
  } catch (e) { return { ok: false, error: String(e.message).slice(0, 120) }; }
}
async function claseico(kp, ops) {
  const cuenta = await (await fetch(`${HORIZON}/accounts/${kp.publicKey()}`)).json();
  const { Account } = await import("@stellar/stellar-sdk");
  let tx = new TransactionBuilder(new Account(kp.publicKey(), cuenta.sequence), { fee: "1000", networkPassphrase: P });
  for (const o of ops) tx = tx.addOperation(o);
  const t = tx.setTimeout(60).build(); t.sign(kp);
  const r = await fetch(`${HORIZON}/transactions`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "tx=" + encodeURIComponent(t.toXDR()) });
  if (!r.ok) throw new Error("horizon " + (await r.text()).slice(0, 200));
}
const saldo = async (id, kp) => Number((await invocar(servicio, id, "balance", [addr(kp)])).valor ?? -1);
const marca = (ok, texto) => console.log(`${ok ? "✔" : "✖"} ${texto}`);
let fallos = 0;
const esperarQue = (cond, texto) => { marca(cond, texto); if (!cond) fallos++; };

console.log("Creando cuentas y asset de prueba…");
const emisor = Keypair.random(), pagador = Keypair.random(), benef = Keypair.random(), cargador = Keypair.random(), aprobador = Keypair.random();
await Promise.all([emisor, pagador, benef, cargador, aprobador].map(fondear));
const ACTIVO = new Asset("GALCOAT", emisor.publicKey());
await claseico(pagador, [Operation.changeTrust({ asset: ACTIVO })]);
await claseico(benef, [Operation.changeTrust({ asset: ACTIVO })]);
await claseico(emisor, [Operation.payment({ destination: pagador.publicKey(), asset: ACTIVO, amount: "1000" })]);
const despliegue = await (async () => { // el contrato del asset (SAC); si ya existía, no pasa nada
  try {
    const tx = new TransactionBuilder(await RPC.getAccount(emisor.publicKey()), { fee: BASE_FEE, networkPassphrase: P }).addOperation(Operation.createStellarAssetContract({ asset: ACTIVO })).setTimeout(60).build();
    const sim = await RPC.simulateTransaction(tx);
    const f = rpc.assembleTransaction(tx, sim).build(); f.sign(emisor);
    const e = await RPC.sendTransaction(f); await esperar(e.hash); return "ok";
  } catch (e) { return "ya existía o: " + e.message.slice(0, 60); }
})();
const TOKEN = ACTIVO.contractId(P);
console.log("Asset GALCOAT, contrato:", TOKEN, "|", despliegue);
const antes = await saldo(TOKEN, pagador);
esperarQue(antes === 10000000000, `El pagador arranca con 1000 GALCOAT (${antes} en unidades de 7 decimales)`);

const registrar = (n) => invocar(servicio, REGISTRO, "registrar", [b32(n), addr(cargador), addr(aprobador)], [cargador, aprobador]);
const depositar = async (trato, huella, vence) => invocar(pagador, ESCROW, "depositar", [b32(trato), addr(pagador), addr(benef), new Address(TOKEN).toScVal(), i128(100_0000000), b32(huella), u32(vence)]);
const liberar = (trato) => invocar(servicio, ESCROW, "liberar", [b32(trato), addr(pagador)]);
const reembolsar = (trato) => invocar(servicio, ESCROW, "reembolsar", [b32(trato), addr(pagador)]);
const ledger = async () => (await RPC.getLatestLedger()).sequence;

console.log("\nA) Pago condicionado a la entrega verificada");
let r = await depositar(11, 21, (await ledger()) + 5000);
esperarQue(r.ok, `Depósito de 100 GALCOAT en custodia (comisión ${r.fee} stroops)${r.ok ? "" : " — error " + r.error}`);
esperarQue((await saldo(TOKEN, pagador)) === 900_0000000, "El pagador quedó con 900");
r = await liberar(11);
esperarQue(!r.ok && r.error === "3", `Liberar SIN huella registrada falla con error #3 (NoVerificada): ${r.error}`);
esperarQue((await saldo(TOKEN, benef)) === 0, "El beneficiario sigue con 0");
r = await registrar(21);
esperarQue(r.ok, `La huella se registra en el contrato (servicio + cargador + aprobador)${r.ok ? "" : " — error " + r.error}`);
r = await liberar(11);
esperarQue(r.ok, `Liberar CON huella registrada paga (comisión ${r.fee} stroops)${r.ok ? "" : " — error " + r.error}`);
esperarQue((await saldo(TOKEN, benef)) === 100_0000000, "El beneficiario cobró 100");
r = await liberar(11);
esperarQue(!r.ok && r.error === "5", `Liberar de nuevo falla con #5 (YaLiquidado): ${r.error}`);

console.log("\nB) Reembolso si la entrega nunca se verifica");
const vence = (await ledger()) + 8;
r = await depositar(12, 22, vence);
esperarQue(r.ok, "Depósito con vencimiento en ~8 ledgers (~40 s)");
r = await reembolsar(12);
esperarQue(!r.ok && r.error === "4", `Reembolsar ANTES del vencimiento falla con #4 (NoVencio): ${r.error}`);
while ((await ledger()) <= vence) await dormir(3000);
r = await reembolsar(12);
esperarQue(r.ok, `Reembolsar DESPUÉS del vencimiento devuelve el monto al pagador${r.ok ? "" : " — error " + r.error}`);
esperarQue((await saldo(TOKEN, pagador)) === 900_0000000, "El pagador recuperó los 100 (queda con 900 porque 100 se pagaron en A)");

console.log("\nC) Lote revocado: no se paga");
r = await depositar(13, 23, (await ledger()) + 5000);
esperarQue(r.ok, "Depósito");
await registrar(23);
r = await invocar(servicio, REGISTRO, "revocar", [b32(23), b32(9), addr(aprobador)], [aprobador]);
esperarQue(r.ok, `El aprobador revoca el lote con servicio + su firma${r.ok ? "" : " — error " + r.error}`);
r = await liberar(13);
esperarQue(!r.ok && r.error === "3", `Liberar un lote REVOCADO falla con #3: ${r.error}`);

console.log("\nD) Historial y pausa (la pausa frena depósitos nuevos, no atrapa plata)");
r = await invocar(servicio, ESCROW, "historial", [b32(11), addr(pagador)]);
esperarQue(r.ok && Array.isArray(r.valor) && r.valor.length === 2, `El historial del trato A tiene 2 líneas (depositado y liberado): ${r.ok ? r.valor.length : r.error}`);
r = await depositar(14, 24, (await ledger()) + 5000); // trato que quedará depositado antes de pausar
esperarQue(r.ok, "Depósito previo a la pausa");
r = await invocar(pagador, ESCROW, "pausar", []); // alguien que no es admin
esperarQue(!r.ok, `Pausar sin ser admin falla: ${r.error}`);
r = await invocar(servicio, ESCROW, "pausar", []);
esperarQue(r.ok, `El admin pausa${r.ok ? "" : " — error " + r.error}`);
r = await depositar(15, 25, (await ledger()) + 5000);
esperarQue(!r.ok && r.error === "9", `Depositar con el contrato pausado falla con #9 (Pausado): ${r.error}`);
await registrar(24);
r = await liberar(14);
esperarQue(r.ok, `Liberar un trato ya depositado SIGUE funcionando con el contrato pausado${r.ok ? "" : " — error " + r.error}`);
r = await invocar(servicio, ESCROW, "reanudar", []);
esperarQue(r.ok, "El admin reanuda");

console.log("\nE) El administrador se transfiere en dos pasos");
const nuevoAdmin = Keypair.random();
await fondear(nuevoAdmin);
r = await invocar(servicio, ESCROW, "transferir_administracion", [addr(nuevoAdmin), u32((await ledger()) + 500)]);
esperarQue(r.ok, `El administrador actual propone a otra cuenta${r.ok ? "" : " — error " + r.error}`);
r = await invocar(servicio, ESCROW, "admin", []);
esperarQue(r.ok && r.valor === servicio.publicKey(), "Mientras no acepte, sigue mandando el administrador anterior");
r = await invocar(servicio, ESCROW, "aceptar_administracion", []);
esperarQue(!r.ok, `Aceptar sin ser la cuenta propuesta falla: ${r.error}`);
r = await invocar(nuevoAdmin, ESCROW, "aceptar_administracion", []);
esperarQue(r.ok, `La cuenta propuesta acepta${r.ok ? "" : " — error " + r.error}`);
r = await invocar(servicio, ESCROW, "admin", []);
esperarQue(r.ok && r.valor === nuevoAdmin.publicKey(), "Ahora manda la cuenta nueva");
r = await invocar(servicio, ESCROW, "pausar", []);
esperarQue(!r.ok, `El administrador anterior ya no puede pausar: ${r.error}`);
r = await invocar(nuevoAdmin, ESCROW, "pausar", []);
esperarQue(r.ok, "El administrador nuevo sí puede pausar");
r = await invocar(nuevoAdmin, ESCROW, "reanudar", []);
esperarQue(r.ok, "y reanudar");

console.log(fallos ? `\n${fallos} verificación(es) fallaron` : "\nTodo lo esperado ocurrió.");
process.exit(fallos ? 1 : 0);
