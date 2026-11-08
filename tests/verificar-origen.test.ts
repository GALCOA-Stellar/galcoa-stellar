import { Account, Asset, Keypair, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error paquete JS sin tipos
import { armarLote } from "../packages/galcoa-comprobante/index.js";

/**
 * Prueba de la auditoría externa del 07/11/2026 (hallazgos 1 y 2), SIN red: un memo igual mandado desde cualquier cuenta,
 * o una "prueba guardada" armada por el propio comprobante, no deben dar "verificado".
 */
const selladora = Keypair.random();
const intruso = Keypair.random();
const manifiesto = {
  reglasVersion: "reglas-demo-0.2", reglasIds: [], veredicto: "verde",
  documento: { remito: "R-0001-99999999", producto: "Inventado", unidad: "kg", cantidadPedida: 1000, cantidadRecibida: 1000, fechaEntrega: "2026-11-07", fechaRegistro: "2026-11-07", cargadoPor: "usuario-01", confirmadoPor: "usuario-02" },
};

const lectura = vi.fn();
vi.mock("../src/lib/stellar/contrato", () => ({ consultarRegistro: vi.fn(async () => null), consultarConsumo: vi.fn(async () => null) }));
vi.mock("../src/lib/servidor/limite", () => ({ limitarPedido: vi.fn(async () => null) }));

function sobre(kp: Keypair, memo: string) {
  const tx = new TransactionBuilder(new Account(kp.publicKey(), "0"), { fee: "100", networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: kp.publicKey(), asset: Asset.native(), amount: "0.0000001" }))
    .addMemo(Memo.hash(memo)).setTimeout(0).build();
  tx.sign(kp);
  return tx;
}

async function verificar(c: unknown) {
  vi.doMock("../src/lib/stellar/stellar", async (orig) => ({ ...(await orig<typeof import("../src/lib/stellar/stellar")>()), leerMemo: lectura }));
  const { POST } = await import("../src/app/api/verificar/route");
  return (await POST(new Request("http://localhost/api/verificar", { method: "POST", headers: { "content-type": "application/json", host: "localhost" }, body: JSON.stringify(c) }))).json();
}

describe("verificador: el origen de la transacción importa", () => {
  beforeEach(() => { vi.resetModules(); lectura.mockReset(); process.env.SELLADOR_STELLAR_SECRETO = selladora.secret(); });
  afterEach(() => { delete process.env.SELLADOR_STELLAR_SECRETO; });

  it("un memo igual mandado desde una cuenta cualquiera NO se verifica", async () => {
    const { memo, comprobantes } = armarLote([manifiesto]);
    lectura.mockResolvedValue({ memoHex: memo, ledger: 5, origen: intruso.publicKey() });
    const r = await verificar({ ...comprobantes[0], txHash: "a".repeat(64) });
    expect(r.verificado).toBe(false);
    expect(r.paso).toBe("origen");
  });

  it("el mismo memo desde la cuenta selladora sí se verifica", async () => {
    const { memo, comprobantes } = armarLote([manifiesto]);
    lectura.mockResolvedValue({ memoHex: memo, ledger: 5, origen: selladora.publicKey() });
    const r = await verificar({ ...comprobantes[0], txHash: "a".repeat(64) });
    expect(r.verificado).toBe(true);
    expect(r.paso).toBe("completo");
  });

  it("prueba guardada armada por un intruso, sin mandarla a la red: no se verifica", async () => {
    const { memo, comprobantes } = armarLote([manifiesto]);
    lectura.mockResolvedValue(null); // la red respondió: no existe
    const tx = sobre(intruso, memo);
    const r = await verificar({ ...comprobantes[0], txHash: Buffer.from(tx.hash()).toString("hex"), prueba: { ledger: 1, cierreLedger: null, envelopeXdr: tx.toXDR(), resultXdr: null } });
    expect(r.verificado).toBe(false);
    expect(r.paso).toBe("origen");
  });

  it("prueba guardada de la cuenta selladora cuando la red no la tiene: coherente, nunca verificado", async () => {
    const { memo, comprobantes } = armarLote([manifiesto]);
    lectura.mockResolvedValue(null);
    const tx = sobre(selladora, memo);
    const r = await verificar({ ...comprobantes[0], txHash: Buffer.from(tx.hash()).toString("hex"), prueba: { ledger: 1, cierreLedger: null, envelopeXdr: tx.toXDR(), resultXdr: null } });
    expect(r.verificado).toBe(false);
    expect(r.coherenteSinRed).toBe(true);
    expect(r.paso).toBe("prueba-guardada");
  });

  it("sobre con la cuenta selladora como origen pero sin su firma: no es coherente", async () => {
    const { memo, comprobantes } = armarLote([manifiesto]);
    lectura.mockResolvedValue(null);
    const tx = sobre(selladora, memo);
    tx.signatures.length = 0; // sobre armado por un intruso: origen ajeno, sin firma
    const r = await verificar({ ...comprobantes[0], txHash: Buffer.from(tx.hash()).toString("hex"), prueba: { ledger: 1, cierreLedger: null, envelopeXdr: tx.toXDR(), resultXdr: null } });
    expect(r.verificado).toBe(false);
    expect(r.coherenteSinRed).not.toBe(true);
  });

  it("sin cuentas selladoras configuradas, nada se verifica (falla cerrado)", async () => {
    delete process.env.SELLADOR_STELLAR_SECRETO;
    const { memo, comprobantes } = armarLote([manifiesto]);
    lectura.mockResolvedValue({ memoHex: memo, ledger: 5, origen: selladora.publicKey() });
    const r = await verificar({ ...comprobantes[0], txHash: "a".repeat(64) });
    expect(r.verificado).toBe(false);
  });
});
