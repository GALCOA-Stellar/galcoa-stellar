// Compara el código (WASM) desplegado en Testnet con el compilado de este repositorio.
// Uso: node scripts/comprobar-wasm.mjs [registro.wasm] [escrow.wasm]
// Sin archivos, solo muestra la huella del código desplegado. Con archivos, dice si coinciden.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { rpc, xdr, Address } from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";
// Los identificadores salen de la única fuente: src/lib/config/contratos.ts
const fuente = readFileSync(new URL("../src/lib/config/contratos.ts", import.meta.url), "utf8");
const id = (nombre) => new RegExp(`export const ${nombre} = "(C[A-Z0-9]{55})"`).exec(fuente)?.[1];
const contratos = [
  { nombre: "registro-lotes", id: id("REGISTRO_ID"), archivo: process.argv[2] },
  { nombre: "escrow-entrega", id: id("ESCROW_ID"), archivo: process.argv[3] },
];

const servidor = new rpc.Server(RPC_URL);
let fallo = false;
for (const c of contratos) {
  const clave = xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({ contract: new Address(c.id).toScAddress(), key: xdr.ScVal.scvLedgerKeyContractInstance(), durability: xdr.ContractDataDurability.persistent }));
  const r = await servidor.getLedgerEntries(clave);
  // Esta versión del SDK expone propiedades (no métodos): entrada → val.value → val.instance → executable.
  const dato = r.entries[0]?.val.value;
  const ejecutable = dato?.val.instance.executable;
  const crudo = ejecutable?.wasmHash ?? ejecutable?.value;
  const hash = crudo ? (typeof crudo.toString === "function" && /^[0-9a-f]{64}$/i.test(String(crudo)) ? String(crudo) : Buffer.from(crudo.toXDR ? crudo.toXDR() : crudo).toString("hex")) : undefined;
  if (!hash) { console.log(`${c.nombre} (${c.id}): no se pudo leer el código desplegado`); fallo = true; continue; }
  let linea = `${c.nombre} (${c.id})\n  desplegado: ${hash}`;
  if (c.archivo && existsSync(c.archivo)) {
    const local = createHash("sha256").update(readFileSync(c.archivo)).digest("hex");
    const ok = local === hash;
    linea += `\n  compilado:  ${local}\n  resultado:  ${ok ? "COINCIDE" : "NO COINCIDE"}`;
    if (!ok) fallo = true;
  }
  console.log(linea);
}
process.exit(fallo ? 1 : 0);
