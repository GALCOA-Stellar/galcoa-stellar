// Prueba de punta a punta del sello 2 de 2 en TESTNET: levanta la app, crea cuentas descartables, arma la transacción,
// la firma "como lo haría cada billetera" y comprueba que con una firma NO sella y con dos SÍ.
import { Horizon, Keypair, Networks, Operation, TransactionBuilder, BASE_FEE } from "@stellar/stellar-sdk";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PUERTO = 4181, BASE = `http://localhost:${PUERTO}`;
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const fondear = async (kp) => { const r = await fetch("https://friendbot.stellar.org/?addr=" + kp.publicKey()); if (!r.ok) throw new Error("friendbot " + r.status); };

const selladora = Keypair.random(), cargador = Keypair.random(), aprobador = Keypair.random();
await fondear(selladora); await fondear(cargador); await fondear(aprobador); // el cargador paga el registro en el contrato
import { readFileSync } from "node:fs";
// El ID vigente vive solo en src/lib/config/contratos.ts: se lee de ahí.
const CONTRATO = process.env.CONTRATO_REGISTRO_ID ?? readFileSync(new URL("../src/lib/config/contratos.ts", import.meta.url), "utf8").match(/REGISTRO_ID\s*=\s*"(C[A-Z0-9]{55})"/)[1];
let tx = new TransactionBuilder(await horizon.loadAccount(selladora.publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: cargador.publicKey(), weight: 1 } }))
  .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: aprobador.publicKey(), weight: 1 } }))
  .addOperation(Operation.setOptions({ masterWeight: 0, lowThreshold: 1, medThreshold: 2, highThreshold: 2 }))
  .setTimeout(60).build();
tx.sign(selladora); await horizon.submitTransaction(tx);
console.log("1. Cuenta de sellado 2 de 2:", selladora.publicKey());

try { await fetch(BASE); console.error("El puerto " + PUERTO + " ya está en uso (¿quedó un servidor de otra corrida?). Cerralo y repetí."); process.exit(1); } catch {}
const servidor = spawn("npx", ["next", "dev", "-p", String(PUERTO)], {
  shell: true, stdio: ["ignore", "ignore", process.env.DEPURAR ? "inherit" : "ignore"],
  env: { ...process.env, GALCOA_DATOS: mkdtempSync(join(tmpdir(), "galcoa-e2e-")), CUENTA_SELLADORA_2DE2: selladora.publicKey(), CONTRATO_REGISTRO_ID: CONTRATO, MODO_DEMO: "1", DEMO_SECRETO_CARGADOR: cargador.secret(), DEMO_SECRETO_APROBADOR: aprobador.secret(), CUENTAS_AUTORIZADAS: `${cargador.publicKey()}=operador-01,${aprobador.publicKey()}=aprobador-01` },
});
const post = async (ruta, cuerpo) => { const r = await fetch(BASE + ruta, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify(cuerpo) }); return { status: r.status, j: await r.json() }; };
const SOLO = process.env.SOLO_CONTRATO === "1"; // modo rápido: salta el sello 2 de 2 y prueba solo el registro con billeteras
const CORRIDA = Date.now().toString(36); // el contrato rechaza huellas repetidas: cada corrida usa remitos nuevos
const H = "ab".repeat(32);
const docs = Array.from({ length: 3 }, (_, i) => ({ unidad: "caja", fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "operador-01", confirmadoPor: "receptor-01", evidenciaHash: H, remito: `E2E-${i}`, producto: "Aceite", cantidadPedida: 10, cantidadRecibida: 10 }));
try {
  for (let i = 0; i < 90; i++) { try { await fetch(BASE); break; } catch { await new Promise((r) => setTimeout(r, 1000)); } }
  if (!SOLO) {
  const p = await post("/api/sello-2de2/preparar", { documentos: docs });
  if (p.status !== 200) throw new Error("preparar: " + JSON.stringify(p));
  console.log("2. Preparada. Huella del lote:", p.j.memo);
  const firmar = (xdr, ...ks) => { const t = TransactionBuilder.fromXDR(xdr, Networks.TESTNET); ks.forEach((k) => t.sign(k)); return t.toXDR(); };

  const una = await post("/api/sello-2de2/enviar", { documentos: docs, xdr: firmar(p.j.xdr, cargador) });
  console.log("3. Con UNA firma:", una.status, una.j.error);
  const unaSola = await post("/api/sello-2de2/enviar", { documentos: docs, xdr: firmar(p.j.xdr, aprobador) });
  console.log("   Solo el aprobador:", unaSola.status, unaSola.j.error);
  const dos = await post("/api/sello-2de2/enviar", { documentos: docs, xdr: firmar(firmar(p.j.xdr, cargador), aprobador) });
  console.log("4. Con DOS firmas:", dos.status, dos.j.sellado ? `sellado en ledger ${dos.j.sellado.ledger}` : dos.j.error);
  if (dos.j.sellado) {
    console.log("   tx:", dos.j.sellado.txHash, "\n   comisión pagada por el servicio:", dos.j.comisionPagadaPor ?? "(la cuenta de sellado)");
    console.log("   ", dos.j.explorador);
    const v = await post("/api/verificar", dos.j.archivo.comprobantes[0]);
    console.log("5. Verificación del primer comprobante:", v.status, JSON.stringify(v.j).slice(0, 200));
  }
  if (dos.j.sellado) { // un reintento del mismo lote no debe sellar ni pagar dos veces
    const p4 = await post("/api/sello-2de2/preparar", { documentos: docs });
    const re = await post("/api/sello-2de2/enviar", { documentos: docs, xdr: firmar(firmar(p4.j.xdr, cargador), aprobador) });
    console.log("4b. Reintento del mismo lote:", re.status, re.j.error ?? "", re.j.yaSellado?.txHash === dos.j.sellado.txHash ? "(devuelve la transacción original)" : "(¡no devolvió la original!)");
  }
  await new Promise((r) => setTimeout(r, 62_000)); // el límite de pedidos por minuto
  // Modo demostración: firma el sobre con las claves de prueba del servidor
  const p2 = await post("/api/sello-2de2/preparar", { documentos: docs.map((d) => ({ ...d, remito: d.remito + "-demo-" + CORRIDA })) });
  const f1 = await post("/api/demo/firmar", { xdr: p2.j.xdr, rol: "cargador" });
  const f2 = await post("/api/demo/firmar", { xdr: f1.j.xdr, rol: "aprobador" });
  const d2 = await post("/api/sello-2de2/enviar", { documentos: docs.map((d) => ({ ...d, remito: d.remito + "-demo-" + CORRIDA })), xdr: f2.j.xdr });
  console.log("6. Modo demostración con dos firmas:", d2.status, d2.j.sellado ? "sellado en ledger " + d2.j.sellado.ledger : d2.j.error);
  if (d2.j.sellado) {
    const docs2 = docs.map((d) => ({ ...d, remito: d.remito + "-demo-" + CORRIDA }));
    const reg = await post("/api/contrato/registrar", { documentos: docs2 });
    console.log("7. Registro en el contrato:", reg.status, reg.j.txHash ? `ledger ${reg.j.ledger}, comisión ${reg.j.comisionStroops} stroops` : reg.j.error);
    const v = await post("/api/verificar", d2.j.archivo.comprobantes[0]);
    console.log("8. Verificador con contrato:", v.status, JSON.stringify(v.j.contrato));
  }

  }

  // Registro en el contrato con firmas "de billetera": cada persona firma el hash del texto que le muestra el servidor
  if (!SOLO) await new Promise((r) => setTimeout(r, 62_000));
  const docs3 = docs.map((d) => ({ ...d, remito: d.remito + "-billetera-" + CORRIDA }));
  const pr = await post("/api/contrato/preparar", { documentos: docs3, cargador: cargador.publicKey(), aprobador: aprobador.publicKey() });
  if (pr.status !== 200) console.log("9. Preparar registro con billeteras:", pr.status, pr.j.error);
  else {
    const llave = { [cargador.publicKey()]: cargador, [aprobador.publicKey()]: aprobador };
    const firmasW = pr.j.porFirmar.map((x) => ({ cuenta: x.cuenta, firma: Buffer.from(llave[x.cuenta].sign(createHash("sha256").update(Buffer.from(x.preimage, "base64")).digest())).toString("base64") }));
    const sinUna = await post("/api/contrato/enviar", { documentos: docs3, datos: pr.j.datos, marca: pr.j.marca, firmas: firmasW.slice(0, 1) });
    console.log("9. Con UNA firma de billetera:", sinUna.status, sinUna.j.error);
    const conDos = await post("/api/contrato/enviar", { documentos: docs3, datos: pr.j.datos, marca: pr.j.marca, firmas: firmasW });
    console.log("10. Con las DOS firmas de billetera:", conDos.status, conDos.j.txHash ? `registrado en ledger ${conDos.j.ledger}, comisión ${conDos.j.comisionStroops} stroops` : conDos.j.error);
  }
} finally {
  servidor.kill();
  // en Windows el servidor queda como proceso hijo: se cierra por puerto
  spawn("powershell", ["-NoProfile", "-Command", `Get-NetTCPConnection -LocalPort ${PUERTO} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`], { stdio: "ignore" });
}
