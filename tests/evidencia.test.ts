import { describe, expect, it } from "vitest";
import { sellarLote } from "../src/lib/aplicacion/lote";
import { marcarEvidenciaRepetida } from "../src/lib/dominio/evidencia";
import { evaluar } from "../src/lib/dominio/rules";

const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const base = { producto: "Sal", unidad: "caja", cantidadPedida: 5, cantidadRecibida: 5, fechaEntrega: "2026-11-05", fechaRegistro: "2026-11-05", cargadoPor: "ana", confirmadoPor: "luis" };
const entrega = (remito: string, evidenciaHash?: string) => ({ ...base, remito, ...(evidenciaHash ? { evidenciaHash } : {}) });

describe("ALC-EVI-01: la misma evidencia no respalda dos entregas", () => {
  it("dos remitos con la misma huella quedan en rojo", () => {
    const r = marcarEvidenciaRepetida([evaluar(entrega("R-1", H1)), evaluar(entrega("R-2", H1))]);
    expect(r.map((e) => e.veredicto)).toEqual(["rojo", "rojo"]);
    expect(r[0].reglas.at(-1)?.id).toBe("ALC-EVI-01");
  });
  it("huellas distintas o sin huella no cambian el veredicto", () => {
    const r = marcarEvidenciaRepetida([evaluar(entrega("R-1", H1)), evaluar(entrega("R-2", H2)), evaluar(entrega("R-3"))]);
    expect(r.map((e) => e.veredicto)).toEqual(["verde", "verde", "amarillo"]);
  });
  it("sellarLote no manda a la red la evidencia repetida, pero sí las demás", async () => {
    let memos = 0;
    const enviar = async () => { memos++; return { txHash: "t".repeat(64), ledger: 1 }; };
    const sol = await sellarLote([entrega("R-1", H1), entrega("R-2", H1), entrega("R-3", H2)], enviar);
    expect(sol.resultados.map((x) => x.enLote)).toEqual([false, false, true]);
    expect(memos).toBe(1);
    const solo = await sellarLote([entrega("R-1", H1), entrega("R-2", H1)], enviar);
    expect(solo.sellado).toBeNull();
    expect(memos).toBe(1);
  });
});
