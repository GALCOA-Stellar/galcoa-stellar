import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { huellaManifiestoV2, memoDelLoteV2, codificarEntrega } from "../src/lib/dominio/codificacion";
import { construir } from "../src/lib/dominio/merkle";
import { verificarComprobante, sellarLote, memoDelLoteV1, manifestHashV1, type Comprobante } from "../src/lib/aplicacion/lote";
import { canonical } from "../src/lib/dominio/canonical";
import { sha256Hex } from "../src/lib/dominio/canonical";

const V = JSON.parse(readFileSync("docs/vectores/comprobante-v2.json", "utf8"));
const base = { remito: "R-1", producto: "Yerba", unidad: "caja", cantidadPedida: 1, cantidadRecibida: 1, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-03", cargadoPor: "a", confirmadoPor: "b" };

describe("codificación v2 (vectores generados por una implementación independiente en Python)", () => {
  for (const nombre of V.manifiestos.map((m: { nombre: string }) => m.nombre) as string[]) it(`vector ${nombre}`, () => {
    const v = V.manifiestos.find((m: { nombre: string }) => m.nombre === nombre);
    expect(huellaManifiestoV2(v.manifiesto)).toBe(v.manifestHash);
  });
  it("raíz y memo del lote coinciden con los vectores", () => {
    const hs = V.lote.orden.map((n: string) => V.manifiestos.find((m: { nombre: string }) => m.nombre === n).manifestHash);
    const { raiz } = construir(hs);
    expect(raiz).toBe(V.lote.raiz);
    expect(memoDelLoteV2(raiz, hs.length)).toBe(V.lote.memo);
  });
  it("el paquete independiente da lo mismo que la app", async () => {
    // @ts-expect-error paquete JS sin tipos
    const pkg = await import("../packages/galcoa-comprobante/index.js");
    for (const v of V.manifiestos) expect(pkg.huellaDe(v.manifiesto)).toBe(v.manifestHash);
    expect(pkg.memoDelLote(V.lote.raiz, V.lote.cantidadHojas)).toBe(V.lote.memo);
  });
  it("dos textos que se ven iguales (NFC) dan la misma huella", () => {
    const a = V.manifiestos.find((m: { nombre: string }) => m.nombre === "nfc_precompuesto");
    const b = V.manifiestos.find((m: { nombre: string }) => m.nombre === "nfc_descompuesto");
    expect(huellaManifiestoV2(a.manifiesto)).toBe(huellaManifiestoV2(b.manifiesto));
  });
  it("campo ausente y texto vacío son cosas distintas", () => {
    expect(codificarEntrega(base).equals(codificarEntrega({ ...base, observacion: "" }))).toBe(false);
  });
  it("rechaza campos desconocidos (no se puede agregar datos sin cambiar la huella)", () => {
    expect(() => codificarEntrega({ ...base, extra: "x" })).toThrow(/desconocido/);
  });
  it("rechaza enteros fuera de rango y huellas mal formadas", () => {
    expect(() => codificarEntrega({ ...base, cantidadPedida: -1 })).toThrow();
    expect(() => codificarEntrega({ ...base, cantidadPedida: 1.5 })).toThrow();
    expect(() => codificarEntrega({ ...base, evidenciaHash: "AB".repeat(32) })).toThrow();
  });
  it("rechaza texto con caracteres inválidos", () => {
    expect(() => codificarEntrega({ ...base, remito: "\ud800" })).toThrow();
  });
  it("el memo cambia si cambia la cantidad de hojas o la raíz", () => {
    expect(memoDelLoteV2("11".repeat(32), 1)).not.toBe(memoDelLoteV2("11".repeat(32), 2));
    expect(memoDelLoteV2("11".repeat(32), 1)).not.toBe(memoDelLoteV2("22".repeat(32), 1));
  });
});

describe("comprobante v2 y compatibilidad con v1", () => {
  it("lo que se sella hoy sale como v2 y se verifica", async () => {
    const r = await sellarLote([{ ...base, remito: "R-77" }], async () => ({ txHash: "a".repeat(64), ledger: 1 }));
    const c = r.comprobantes[0];
    expect(c.schemaVersion).toBe("galcoa.stellar.comprobante.v2");
    expect(verificarComprobante(c).coherente).toBe(true);
  });
  it("un comprobante v2 con un campo agregado ya no es coherente", async () => {
    const r = await sellarLote([{ ...base, remito: "R-78" }], async () => ({ txHash: "a".repeat(64), ledger: 1 }));
    const c = structuredClone(r.comprobantes[0]) as Comprobante;
    (c.manifiesto.documento as Record<string, unknown>).extra = "x";
    expect(verificarComprobante(c).coherente).toBe(false);
  });
  it("un comprobante v1 ya emitido sigue verificando", () => {
    const manifiesto = { documento: { remito: "R-1", cantidad: 3 }, reglasVersion: "x", reglasIds: ["A"], veredicto: "verde" as const };
    const h = manifestHashV1(manifiesto);
    const { raiz } = construir([h]);
    const c = { schemaVersion: "galcoa.stellar.comprobante.v1", red: "stellar:testnet", txHash: "a".repeat(64), manifiesto, manifestHash: h, indice: 0, cantidadHojas: 1, camino: [], raiz } as unknown as Comprobante;
    const v = verificarComprobante(c);
    expect(v.coherente).toBe(true);
    expect(v.memoEsperado).toBe(sha256Hex(canonical({ cantidadHojas: 1, raiz, schemaVersion: "galcoa.batch.v1" })));
    expect(v.memoEsperado).toBe(memoDelLoteV1(raiz, 1));
  });
});
