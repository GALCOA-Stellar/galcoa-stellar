import { describe, expect, it } from "vitest";
import { marcarTexto, marcaDeTextoValida } from "../src/lib/stellar/firma";
import { prepararRegistro } from "../src/lib/stellar/contrato";

describe("marca de los datos que el servidor entrega para firmar", () => {
  it("acepta el texto tal cual lo emitió el servidor", () => {
    const t = JSON.stringify({ memo: "ab".repeat(32), cargador: "G1", aprobador: "G2" });
    expect(marcaDeTextoValida(t, marcarTexto(t))).toBe(true);
  });
  it("rechaza si cambian una sola letra del texto", () => {
    const t = JSON.stringify({ memo: "ab".repeat(32), cargador: "G1", aprobador: "G2" });
    expect(marcaDeTextoValida(t.replace("G2", "G3"), marcarTexto(t))).toBe(false);
  });
  it("rechaza marcas vacías, ajenas o de otro tipo", () => {
    expect(marcaDeTextoValida("x", "")).toBe(false);
    expect(marcaDeTextoValida("x", undefined)).toBe(false);
    expect(marcaDeTextoValida("x", "0".repeat(64))).toBe(false);
  });
});

describe("registro con dos personas", () => {
  it("no prepara el registro si las dos cuentas son la misma", async () => {
    process.env.CONTRATO_REGISTRO_ID = "CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV";
    const g = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
    await expect(prepararRegistro("ab".repeat(32), g, g)).rejects.toThrow("Hacen falta dos cuentas distintas");
  });
});

describe("el verificador no inventa un 'no figura'", () => {
  const C = "CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV";
  const sim = (x: object) => x as never;
  it("un registro vencido y archivado se muestra como archivado, no como inexistente", async () => {
    const { interpretarSimulacion } = await import("../src/lib/stellar/contrato");
    const r = interpretarSimulacion(sim({ restorePreamble: { minResourceFee: "1", transactionData: {} }, latestLedger: 1, id: "x", events: [] }), C);
    expect(r?.estado).toBe("archivado");
    expect(r?.registrado).toBe(true);
  });
  it("solo el error #3 del contrato significa 'no figura'", async () => {
    const { interpretarSimulacion } = await import("../src/lib/stellar/contrato");
    expect(interpretarSimulacion(sim({ error: "HostError: Error(Contract, #3)", latestLedger: 1, id: "x", events: [] }), C)?.estado).toBe("no-figura");
  });
  it("cualquier otro fallo es 'no se pudo consultar' (null), nunca 'no figura'", async () => {
    const { interpretarSimulacion } = await import("../src/lib/stellar/contrato");
    expect(interpretarSimulacion(sim({ error: "timeout del RPC", latestLedger: 1, id: "x", events: [] }), C)).toBeNull();
    expect(interpretarSimulacion(sim({ error: "Error(Contract, #5)", latestLedger: 1, id: "x", events: [] }), C)).toBeNull();
  });
  it("lee un lote vigente y uno revocado con su historia", async () => {
    const { interpretarSimulacion } = await import("../src/lib/stellar/contrato");
    const { nativeToScVal, Address, xdr } = await import("@stellar/stellar-sdk");
    const g = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H", h = "GDWGPDBGBDTMIAG2URZWZDWTJ6JTNBDIV42GO4IUN5B65VWYAAA67DTH";
    const reg = (estado: string, rev: string | null) => xdr.ScVal.scvMap([
      ["aprobador", new Address(h).toScVal()], ["cargador", new Address(g).toScVal()], ["estado", xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(estado)])],
      ["ledger", nativeToScVal(10, { type: "u32" })], ["ledger_revocacion", nativeToScVal(rev ? 20 : 0, { type: "u32" })],
      ["motivo_hash", nativeToScVal(Buffer.alloc(32, rev ? 3 : 0), { type: "bytes" })], ["revocado_por", rev ? new Address(rev).toScVal() : xdr.ScVal.scvVoid()],
    ].map(([k, v]) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k as string), val: v as never })));
    const vigente = interpretarSimulacion(sim({ result: { retval: reg("Vigente", null) }, latestLedger: 1, id: "x", events: [] }), C);
    expect(vigente?.estado).toBe("vigente");
    const rev = interpretarSimulacion(sim({ result: { retval: reg("Revocado", h) }, latestLedger: 1, id: "x", events: [] }), C);
    expect(rev?.estado).toBe("revocado");
    expect(rev?.revocadoPor).toBe(h);
    expect(rev?.ledgerRevocacion).toBe(20);
    expect(rev?.motivoHash).toBe("03".repeat(32));
  });
});
