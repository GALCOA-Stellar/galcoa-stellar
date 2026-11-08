// Guion de los criterios de éxito del sprint, en TESTNET, con cuentas y assets descartables (sin dinero real).
//   1. Registrar N lotes (por defecto 12) en el contrato de registro.
//   2. Emitir los comprobantes (v2) de cada lote.
//   3. Que un TERCERO (solo el paquete independiente + un nodo público de la red, sin el servidor de GALCOA) verifique al menos 3.
//   4. Dos flujos de escrow de punta a punta: pago de un lote verificado, y lote revocado (no se paga, se reembolsa al vencer).
// Deja la evidencia en docs/evidencia/EVIDENCIA-<corrida>.json y .md (con enlaces al explorador).
// Uso: CONTRATO_REGISTRO_ID=C... ESCROW_ID=C... node scripts/criterios-de-exito.mjs     (LOTES=12 por defecto)
// Necesita .env.local con SELLADOR_STELLAR_SECRETO (la cuenta del servicio, fondeada en testnet).
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { Address, Asset, BASE_FEE, Contract, Keypair, Networks, Operation, TransactionBuilder, authorizeEntry, nativeToScVal, rpc, scValToNative } from "@stellar/stellar-sdk";
import { armarLote, verificarComprobante } from "../packages/galcoa-comprobante/index.js";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const REGISTRO = process.env.CONTRATO_REGISTRO_ID ?? env.CONTRATO_REGISTRO_ID;
const ESCROW = process.env.ESCROW_ID;
const LOTES = Number(process.env.LOTES ?? 12);
if (!REGISTRO || !ESCROW) { console.error("Faltan CONTRATO_REGISTRO_ID y ESCROW_ID (en el entorno)"); process.exit(1); }
if (!Number.isInteger(LOTES) || LOTES < 3 || LOTES > 50) { console.error("LOTES debe estar entre 3 y 50"); process.exit(1); }
const servicio = Keypair.fromSecret(env.SELLADOR_STELLAR_SECRETO);
const RPC = new rpc.Server("https://soroban-testnet.stellar.org");
const HORIZON = "https://horizon-testnet.stellar.org";
const P = Networks.TESTNET;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const CORRIDA = randomBytes(4).toString("hex");
const EXPLORADOR = (h) => `https://stellar.expert/explorer/testnet/tx/${h}`;
const addr = (kp) => new Address(kp.publicKey()).toScVal();
const bytes32 = (hex) => nativeToScVal(Buffer.from(hex, "hex"), { type: "bytes" });
const i128 = (n) => nativeToScVal(BigInt(n), { type: "i128" });
const u32 = (n) => nativeToScVal(n, { type: "u32" });
const sha = (s) => createHash("sha256").update(s).digest("hex");

async function fondear(kp) { const r = await fetch(`https://friendbot.stellar.org/?addr=${kp.publicKey()}`); if (!r.ok) throw new Error("friendbot " + r.status); }
async function esperar(hash) { for (let i = 0; i < 40; i++) { const r = await RPC.getTransaction(hash); if (r.status === "SUCCESS") return r; if (r.status === "FAILED") throw new Error("falló en la red"); await dormir(1500); } throw new Error("sin confirmar"); }

/** Llama a un contrato. Devuelve {ok, valor, error, fee, hash, ledger}. Los errores del contrato salen como "#N". */
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
    return { ok: true, valor: r.returnValue ? scValToNative(r.returnValue) : undefined, fee: Number(r.resultXdr.toXdrObject().feeCharged), hash: envio.hash, ledger: r.ledger };
  } catch (e) { return { ok: false, error: String(e.message).slice(0, 120) }; }
}
async function clasica(kp, ops) {
  const cuenta = await (await fetch(`${HORIZON}/accounts/${kp.publicKey()}`)).json();
  const { Account } = await import("@stellar/stellar-sdk");
  let tx = new TransactionBuilder(new Account(kp.publicKey(), cuenta.sequence), { fee: "1000", networkPassphrase: P });
  for (const o of ops) tx = tx.addOperation(o);
  const t = tx.setTimeout(60).build(); t.sign(kp);
  const r = await fetch(`${HORIZON}/transactions`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "tx=" + encodeURIComponent(t.toXDR()) });
  if (!r.ok) throw new Error("horizon " + (await r.text()).slice(0, 200));
}
const ledger = async () => (await RPC.getLatestLedger()).sequence;
const saldo = async (token, kp) => Number((await invocar(servicio, token, "balance", [addr(kp)])).valor ?? -1);

const evidencia = { corrida: CORRIDA, fecha: new Date().toISOString(), red: "stellar:testnet", contratos: { registro: REGISTRO, escrow: ESCROW }, aviso: "Datos de prueba generados por el guion: no son datos reales de ninguna empresa. Testnet, sin dinero real.", criterios: {}, lotes: [], escrow: {} };
let fallos = 0;
const marca = (ok, texto) => { console.log(`${ok ? "✔" : "✖"} ${texto}`); if (!ok) fallos++; return ok; };

// ---------- Cuentas ----------
console.log("Creando cuentas de prueba…");
const cargador = Keypair.random(), aprobador = Keypair.random();
await Promise.all([cargador, aprobador].map(fondear));
evidencia.cuentas = { servicio: servicio.publicKey(), cargador: cargador.publicKey(), aprobador: aprobador.publicKey() };

// ---------- Criterios 1 y 2: registrar lotes y emitir comprobantes ----------
console.log(`\n1-2) Registrar ${LOTES} lotes y emitir comprobantes`);
const manifiestosDe = (n) => Array.from({ length: 3 }, (_, i) => ({
  documento: { remito: `CE-${CORRIDA}-${n}-${i}`, producto: "Yerba mate 1 kg", unidad: "caja", cantidadPedida: 10 + i, cantidadRecibida: 10 + i, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-03", cargadoPor: "operador-01", confirmadoPor: "aprobador-01", evidenciaHash: sha(`${CORRIDA}:${n}:${i}`) },
  reglasVersion: "reglas-demo-0.2", reglasIds: ["ALC-COM-01", "ALC-LEG-01", "ALC-ATR-01", "ALC-COH-01", "ALC-CTE-01", "ALC-ORI-01", "ALC-EXA-01"], veredicto: "verde",
}));
const lotes = [];
for (let n = 1; n <= LOTES; n++) {
  const t0 = Date.now();
  const { memo, raiz, comprobantes } = armarLote(manifiestosDe(n));
  const r = await invocar(servicio, REGISTRO, "registrar", [bytes32(memo), addr(cargador), addr(aprobador)], [cargador, aprobador]);
  const ok = !!r.ok;
  console.log(`${ok ? "✔" : "✖"} lote ${n}/${LOTES}: ${ok ? `registrado en el ledger ${r.ledger}, comisión ${r.fee} stroops, ${((Date.now() - t0) / 1000).toFixed(1)} s` : "error " + r.error}`);
  if (!ok) { fallos++; continue; }
  comprobantes.forEach((c) => { c.txHash = r.hash; });
  lotes.push({ n, memo, raiz, comprobantes, tx: r.hash, ledger: r.ledger, fee: r.fee, explorador: EXPLORADOR(r.hash) });
}
const emitidos = lotes.reduce((a, l) => a + l.comprobantes.length, 0);
evidencia.criterios.lotesRegistrados = { objetivo: "10 a 20", logrado: lotes.length, ok: lotes.length >= Math.min(10, LOTES) };
evidencia.criterios.comprobantesEmitidos = { logrado: emitidos, ok: emitidos >= lotes.length };
evidencia.lotes = lotes.map(({ comprobantes, ...l }) => ({ ...l, comprobantes: comprobantes.length }));
marca(evidencia.criterios.lotesRegistrados.ok, `Lotes registrados: ${lotes.length}`);
marca(evidencia.criterios.comprobantesEmitidos.ok, `Comprobantes emitidos: ${emitidos}`);
mkdirSync("docs/evidencia", { recursive: true });
writeFileSync(`docs/evidencia/lotes-${CORRIDA}.json`, JSON.stringify(lotes.map((l) => ({ memo: l.memo, tx: l.tx, comprobantes: l.comprobantes })), null, 1));

// ---------- Criterio 3: verificación por un tercero ----------
console.log("\n3) Verificación por un tercero (solo el paquete independiente + un nodo público; sin el servidor de GALCOA)");
const tercero = new rpc.Server("https://soroban-testnet.stellar.org");
async function leerContrato(fn, huellaHex) {
  const tx = new TransactionBuilder(await tercero.getAccount(servicio.publicKey()), { fee: BASE_FEE, networkPassphrase: P }).addOperation(new Contract(REGISTRO).call(fn, bytes32(huellaHex))).setTimeout(60).build();
  const sim = await tercero.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) return { error: String(sim.error).slice(0, 100) };
  return { valor: sim.result ? scValToNative(sim.result.retval) : null };
}
const verificadosPorTercero = [];
for (const l of lotes.slice(0, Math.min(5, lotes.length))) {
  const c = l.comprobantes[0];
  const local = verificarComprobante(c);
  const memoOk = local.coherente && local.memoEsperado === l.memo;
  const existe = await leerContrato("existe", l.memo);
  const detalle = await leerContrato("obtener", l.memo);
  const tx = await tercero.getTransaction(c.txHash);
  const ok = memoOk && existe.valor === true && tx.status === "SUCCESS" && detalle.valor && detalle.valor.cargador !== detalle.valor.aprobador;
  marca(!!ok, `Lote ${l.n}: comprobante coherente, memo esperado coincide, el contrato lo tiene vigente, dos cuentas distintas, transacción confirmada`);
  verificadosPorTercero.push({ lote: l.n, ok: !!ok, tx: c.txHash });
}
const alterado = structuredClone(lotes[0].comprobantes[0]);
alterado.manifiesto.documento.cantidadRecibida += 1;
marca(verificarComprobante(alterado).coherente === false, "Un comprobante alterado (cantidad recibida cambiada) NO verifica");
const desconocida = await leerContrato("existe", sha("no-existe-" + CORRIDA));
marca(desconocida.valor === false, "Una huella que nunca se registró figura como inexistente");
evidencia.criterios.verificacionPorTercero = { objetivo: "al menos 3 sin el servidor de GALCOA", logrado: verificadosPorTercero.filter((v) => v.ok).length, detalle: verificadosPorTercero, ok: verificadosPorTercero.filter((v) => v.ok).length >= 3 };
marca(evidencia.criterios.verificacionPorTercero.ok, `Verificados por un tercero: ${evidencia.criterios.verificacionPorTercero.logrado}`);

// ---------- Criterio 4: escrow de punta a punta ----------
console.log("\n4) Dos flujos de escrow de punta a punta (asset de prueba)");
const emisor = Keypair.random(), pagador = Keypair.random(), benef = Keypair.random();
await Promise.all([emisor, pagador, benef].map(fondear));
const ACTIVO = new Asset("GALCOAT", emisor.publicKey());
await clasica(pagador, [Operation.changeTrust({ asset: ACTIVO })]);
await clasica(benef, [Operation.changeTrust({ asset: ACTIVO })]);
await clasica(emisor, [Operation.payment({ destination: pagador.publicKey(), asset: ACTIVO, amount: "1000" })]);
try {
  const tx = new TransactionBuilder(await RPC.getAccount(emisor.publicKey()), { fee: BASE_FEE, networkPassphrase: P }).addOperation(Operation.createStellarAssetContract({ asset: ACTIVO })).setTimeout(60).build();
  const sim = await RPC.simulateTransaction(tx); const f = rpc.assembleTransaction(tx, sim).build(); f.sign(emisor);
  const e = await RPC.sendTransaction(f); await esperar(e.hash);
} catch { /* ya existía */ }
const TOKEN = ACTIVO.contractId(P);
const depositar = (idTrato, huellaHex, vence) => invocar(pagador, ESCROW, "depositar", [bytes32(sha(idTrato)), addr(pagador), addr(benef), new Address(TOKEN).toScVal(), i128(100_0000000), bytes32(huellaHex), u32(vence)]);
const liberar = (idTrato) => invocar(servicio, ESCROW, "liberar", [bytes32(sha(idTrato)), addr(pagador)]);
const reembolsar = (idTrato) => invocar(servicio, ESCROW, "reembolsar", [bytes32(sha(idTrato)), addr(pagador)]);
const flujos = [];

// Flujo 1: el pago se libera porque el lote ya está verificado en el registro.
const L1 = lotes[0];
const t1 = `trato-1-${CORRIDA}`;
let r = await depositar(t1, L1.memo, (await ledger()) + 5000);
const dep1 = marca(!!r.ok, `Flujo 1: el pagador deposita 100 de prueba atados al lote 1${r.ok ? "" : " (error " + r.error + ")"}`);
const txDep1 = r.hash;
r = await liberar(t1);
const lib1 = marca(!!r.ok, `Flujo 1: se libera el pago porque el lote está verificado${r.ok ? "" : " (error " + r.error + ")"}`);
const pagado1 = (await saldo(TOKEN, benef)) === 100_0000000;
marca(pagado1, "Flujo 1: el beneficiario cobró 100");
flujos.push({ flujo: 1, descripcion: "Pago liberado por lote verificado", ok: dep1 && lib1 && pagado1, txDeposito: txDep1, txLiberacion: r.hash });

// Flujo 2: el lote se revoca; no se paga; al vencer el plazo el dinero vuelve al pagador.
const L2 = lotes[1];
const t2 = `trato-2-${CORRIDA}`;
const vence2 = (await ledger()) + 8;
r = await depositar(t2, L2.memo, vence2);
const dep2 = marca(!!r.ok, `Flujo 2: el pagador deposita 100 de prueba atados al lote 2${r.ok ? "" : " (error " + r.error + ")"}`);
r = await invocar(servicio, REGISTRO, "revocar", [bytes32(L2.memo), bytes32(sha("motivo-" + CORRIDA)), addr(aprobador)], [aprobador]);
const rev2 = marca(!!r.ok, `Flujo 2: el aprobador revoca el lote${r.ok ? "" : " (error " + r.error + ")"}`);
const txRev = r.hash;
r = await liberar(t2);
const negado = marca(!r.ok && r.error === "3", `Flujo 2: no se paga un lote revocado (error #3, NoVerificada): ${r.error}`);
while ((await ledger()) <= vence2) await dormir(3000);
r = await reembolsar(t2);
const reemb = marca(!!r.ok, `Flujo 2: vencido el plazo, el dinero vuelve al pagador${r.ok ? "" : " (error " + r.error + ")"}`);
const txReemb = r.hash;
const saldoFinal = await saldo(TOKEN, pagador);
marca(saldoFinal === 900_0000000, "Flujo 2: el pagador queda con 900 (100 se pagaron en el flujo 1)");
flujos.push({ flujo: 2, descripcion: "Lote revocado: sin pago y reembolso al vencer", ok: dep2 && rev2 && negado && reemb && saldoFinal === 900_0000000, txRevocacion: txRev, txReembolso: txReemb });
const h = await invocar(servicio, ESCROW, "historial", [bytes32(sha(t1)), addr(pagador)]);
evidencia.escrow = { asset: `GALCOAT (${emisor.publicKey()})`, tokenContrato: TOKEN, flujos, historialFlujo1: h.ok ? h.valor.map((e) => e.accion?.tag ?? String(e.accion)) : null };
evidencia.criterios.escrowDePuntaAPunta = { objetivo: "1 a 2 flujos", logrado: flujos.filter((f) => f.ok).length, ok: flujos.filter((f) => f.ok).length >= 1 };

// ---------- Resumen ----------
const comisiones = lotes.map((l) => l.fee).filter(Boolean);
evidencia.costos = { registroPorLoteStroops: comisiones.length ? Math.round(comisiones.reduce((a, b) => a + b, 0) / comisiones.length) : null, nota: "Promedio medido en testnet; no equivale a mainnet." };
evidencia.fallos = fallos;
writeFileSync(`docs/evidencia/EVIDENCIA-${CORRIDA}.json`, JSON.stringify(evidencia, null, 2));
const md = [
  `# Evidencia de criterios de éxito (corrida ${CORRIDA})`,
  ``,
  `Fecha: ${evidencia.fecha}. Red: testnet. ${evidencia.aviso}`,
  ``,
  `- Contrato de registro: \`${REGISTRO}\``,
  `- Contrato de escrow: \`${ESCROW}\``,
  ``,
  `| Criterio | Objetivo | Resultado |`,
  `|---|---|---|`,
  `| Lotes registrados | ${evidencia.criterios.lotesRegistrados.objetivo} | ${evidencia.criterios.lotesRegistrados.logrado} ${evidencia.criterios.lotesRegistrados.ok ? "✔" : "✖"} |`,
  `| Comprobantes emitidos (v2) | uno por documento | ${evidencia.criterios.comprobantesEmitidos.logrado} ${evidencia.criterios.comprobantesEmitidos.ok ? "✔" : "✖"} |`,
  `| Verificados por un tercero, sin el servidor | al menos 3 | ${evidencia.criterios.verificacionPorTercero.logrado} ${evidencia.criterios.verificacionPorTercero.ok ? "✔" : "✖"} |`,
  `| Escrow de punta a punta | 1 a 2 flujos | ${evidencia.criterios.escrowDePuntaAPunta.logrado} ${evidencia.criterios.escrowDePuntaAPunta.ok ? "✔" : "✖"} |`,
  ``,
  `Comisión promedio de registrar un lote (testnet): ${evidencia.costos.registroPorLoteStroops} stroops.`,
  ``,
  `## Lotes registrados`,
  ...lotes.map((l) => `- Lote ${l.n}: ledger ${l.ledger}, [transacción](${l.explorador}), huella \`${l.memo.slice(0, 16)}…\``),
  ``,
  `## Flujos de escrow`,
  ...flujos.map((f) => `- Flujo ${f.flujo} (${f.descripcion}): ${f.ok ? "✔" : "✖"} ` + Object.entries(f).filter(([k]) => k.startsWith("tx")).map(([k, v]) => `[${k}](${EXPLORADOR(v)})`).join(", ")),
  ``,
  `## Límites`,
  `- Los lotes son de prueba, generados por el guion; no son datos de ninguna empresa.`,
  `- El tercero es el paquete independiente más un nodo público; lo verificó el mismo equipo, no una persona ajena.`,
  `- Costos de testnet; no equivalen a mainnet. La testnet se reinicia: guardar este archivo y capturas del explorador.`,
  ``,
].join("\n");
writeFileSync(`docs/evidencia/EVIDENCIA-${CORRIDA}.md`, md);
console.log(fallos ? `\n${fallos} verificación(es) fallaron` : "\nTodos los criterios se cumplieron.");
console.log(`Evidencia: docs/evidencia/EVIDENCIA-${CORRIDA}.md`);
process.exit(fallos ? 1 : 0);
