import { describe, expect, it } from "vitest";
import { resumenComisiones } from "../src/lib/datos/historial";
import { comisionCobrada } from "../src/lib/stellar/stellar";

describe("contador de comisiones", () => {
  it("suma solo lo anotado y dice cuántos no tienen dato", () => {
    const r = resumenComisiones([{ comisionStroops: "100" }, { comisionStroops: "250" }, {}]);
    expect(r).toEqual({ sellos: 2, sinDato: 1, totalStroops: "350", totalXlm: "0.0000350" });
  });
  it("pasa de stroops a XLM sin errores de redondeo", () => {
    expect(resumenComisiones([{ comisionStroops: "10000000" }, { comisionStroops: "1" }]).totalXlm).toBe("1.0000001");
    expect(resumenComisiones([]).totalXlm).toBe("0.0000000");
  });
  it("ignora valores que no son números", () => {
    expect(resumenComisiones([{ comisionStroops: "abc" }]).sellos).toBe(0);
  });
  it("lee la comisión cobrada del resultado de la red", () => {
    // TransactionResult en XDR: int64 comisión + código 0 (éxito) + lista de resultados vacía + extensión v0
    const b = Buffer.alloc(20);
    b.writeBigInt64BE(1234n, 0);
    expect(comisionCobrada(b.toString("base64"))).toBe("1234");
    expect(comisionCobrada(null)).toBeNull();
    expect(comisionCobrada("basura")).toBeNull();
  });
});
