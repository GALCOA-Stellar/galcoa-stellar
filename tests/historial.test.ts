import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { leerOperacion, listarOperaciones, puedeVerHistorial, registrarOperacion } from "../src/lib/datos/historial";

beforeAll(() => { process.env.GALCOA_DATOS = mkdtempSync(join(tmpdir(), "galcoa-h-")); delete process.env.MODO_DEMO; });
const base = { txHash: "a".repeat(64), ledger: 10, memo: "b".repeat(64), cantidadHojas: 3, firmadoPor: ["G1", "G2"], modo: "2de2" as const, archivo: { secreto: "contenido del lote" } };

describe("historial de operaciones", () => {
  it("guarda y devuelve un resumen sin el contenido del archivo", async () => {
    const id = await registrarOperacion(base, Date.parse("2026-11-02T10:00:00Z"));
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    const lista = await listarOperaciones();
    expect(lista.find((o) => o.id === id)).toMatchObject({ ledger: 10, cantidadHojas: 3, fecha: "2026-11-02T10:00:00.000Z" });
    expect(JSON.stringify(lista)).not.toContain("contenido del lote");
    expect((await leerOperacion(id!))?.archivo).toEqual({ secreto: "contenido del lote" });
  });
  it("lista primero lo más reciente", async () => {
    await registrarOperacion({ ...base, ledger: 11 }, Date.parse("2026-11-03T10:00:00Z"));
    expect((await listarOperaciones())[0].ledger).toBe(11);
  });
  it("si no se puede guardar, no rompe el sellado", async () => {
    const archivo = join(mkdtempSync(join(tmpdir(), "galcoa-f-")), "soy-un-archivo");
    writeFileSync(archivo, "x");
    process.env.GALCOA_DATOS = join(archivo, "carpeta"); // no se puede crear una carpeta dentro de un archivo
    expect(await registrarOperacion(base)).toBeNull();
  });
  it("sin sesión ni modo demostración, nadie ve el historial", () => {
    expect(puedeVerHistorial(new Request("http://localhost/api/historial"))).toBe(false);
    expect(puedeVerHistorial(new Request("http://localhost/api/historial", { headers: { "x-pase": "falso.falso" } }))).toBe(false);
  });
});

describe("historial por persona", () => {
  beforeAll(() => { process.env.GALCOA_DATOS = mkdtempSync(join(tmpdir(), "galcoa-hp-")); });
  it("cada sesión ve solo las operaciones en las que participó", async () => {
    const { listarOperacionesDe } = await import("../src/lib/datos/historial");
    const base = { txHash: "t", ledger: 1, memo: "m".repeat(64), cantidadHojas: 1, modo: "2de2" as const, archivo: {} };
    await registrarOperacion({ ...base, memo: "a".repeat(64), firmadoPor: ["GAAA", "GBBB"], personas: ["ana", "luis"] });
    await registrarOperacion({ ...base, memo: "b".repeat(64), firmadoPor: ["GCCC", "GDDD"], personas: ["maria", "gaston"] });
    const deAna = await listarOperacionesDe({ cuenta: "GAAA", identidad: "ana" });
    expect(deAna.some((o) => o.memo === "a".repeat(64))).toBe(true);
    expect(deAna.some((o) => o.memo === "b".repeat(64))).toBe(false);
  });
});
