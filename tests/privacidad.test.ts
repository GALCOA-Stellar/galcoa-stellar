import { beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listar, liberar, reclamar } from "../src/lib/almacen";
import { crear, responder } from "../src/lib/confirmacion";
import { operacionPorMemo, registrarOperacion } from "../src/lib/historial";
import { borrarDatosDe, limpiarVencidos, operacionesDe } from "../src/lib/privacidad";

const base = { txHash: "a".repeat(64), ledger: 1, memo: "b".repeat(64), cantidadHojas: 1, firmadoPor: ["G1", "G2"], modo: "2de2" as const };
const DIA = 86_400_000;
let carpeta = "";
beforeEach(() => { carpeta = mkdtempSync(join(tmpdir(), "galcoa-p-")); process.env.GALCOA_DATOS = carpeta; delete process.env.DIAS_CONSERVACION; });

describe("Ley 25.326: acceso y supresión", () => {
  it("cada persona ve y borra solo lo suyo", async () => {
    await registrarOperacion({ ...base, memo: "1".repeat(64), personas: ["operador-01", "aprobador-01"], archivo: { cargaron: ["operador-01"] } });
    await registrarOperacion({ ...base, memo: "2".repeat(64), personas: ["operador-02", "aprobador-01"], archivo: { cargaron: ["operador-02"] } });
    await registrarOperacion({ ...base, memo: "3".repeat(64), personas: ["otro-01", "otro-02"], archivo: { cargaron: ["operador-01"] } }); // la cargó operador-01
    expect(await operacionesDe("operador-01")).toHaveLength(2); // firmó una y cargó otra
    expect(await borrarDatosDe("operador-01")).toBe(2);
    expect(await operacionesDe("operador-01")).toHaveLength(0);
    expect(await operacionesDe("operador-02")).toHaveLength(1); // lo de otra persona no se toca
  });
  it("deja constancia del borrado sin guardar el identificador de la persona", async () => {
    await registrarOperacion({ ...base, personas: ["operador-01"], archivo: { cargaron: ["operador-01"] } });
    await borrarDatosDe("operador-01");
    const [rastro] = await listar<Record<string, unknown>>("borrados");
    expect(rastro.operacionesBorradas).toBe(1);
    expect(JSON.stringify(rastro)).not.toContain("operador-01");
    expect(String(rastro.identidadHash)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("plazo de conservación", () => {
  it("borra lo que cumplió su plazo y conserva lo reciente", async () => {
    const ahora = Date.parse("2026-11-06T00:00:00Z");
    await registrarOperacion({ ...base, memo: "4".repeat(64), archivo: {} }, ahora - 400 * DIA); // más de 12 meses
    await registrarOperacion({ ...base, memo: "5".repeat(64), archivo: {} }, ahora - 10 * DIA);
    const r = await limpiarVencidos(ahora);
    expect(r.operaciones).toBe(1);
    expect(await operacionPorMemo("5".repeat(64))).not.toBeNull();
    expect(await operacionPorMemo("4".repeat(64))).toBeNull();
  });
  it("el plazo se puede configurar", async () => {
    process.env.DIAS_CONSERVACION = "5";
    const ahora = Date.parse("2026-11-06T00:00:00Z");
    await registrarOperacion({ ...base, memo: "6".repeat(64), archivo: {} }, ahora - 6 * DIA);
    expect((await limpiarVencidos(ahora)).operaciones).toBe(1);
  });
  it("las confirmaciones se borran 30 días después de vencer el enlace, no antes", async () => {
    const c = await crear({ remito: "R-1", producto: "X", unidad: "caja", cantidadPedida: 1, cantidadRecibida: 1, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "a-1", confirmadoPor: "b-1" }, Date.parse("2026-11-06T00:00:00Z"));
    await responder(c.id, "confirmada", "nota", Date.parse("2026-11-06T01:00:00Z"));
    const vence = Date.parse(c.vence);
    expect((await limpiarVencidos(vence + 29 * DIA)).confirmaciones).toBe(0);
    expect((await limpiarVencidos(vence + 31 * DIA)).confirmaciones).toBe(1);
    expect(readdirSync(join(carpeta, "confirmaciones"))).toEqual([]); // tampoco quedan archivos de reclamo
  });
});

describe("un reintento no sella dos veces", () => {
  it("encuentra una operación ya sellada por su huella", async () => {
    expect(await operacionPorMemo("7".repeat(64))).toBeNull();
    await registrarOperacion({ ...base, memo: "7".repeat(64), archivo: { secreto: "x" } });
    const previa = await operacionPorMemo("7".repeat(64));
    expect(previa?.txHash).toBe(base.txHash);
    expect(JSON.stringify(previa)).not.toContain("secreto"); // no devuelve el contenido
  });
  it("solo un envío a la vez por lote; si falla, se libera y se puede reintentar", async () => {
    const id = "8".repeat(32);
    expect(await reclamar("sellos", id, "enviando", 60_000)).toBe(true);
    expect(await reclamar("sellos", id, "enviando", 60_000)).toBe(false);
    await liberar("sellos", id, "enviando");
    expect(await reclamar("sellos", id, "enviando", 60_000)).toBe(true);
  });
  it("un bloqueo viejo (el proceso murió) no deja el lote trabado para siempre", async () => {
    const id = "9".repeat(32);
    await reclamar("sellos", id, "enviando");
    const archivo = join(carpeta, "sellos", `${id}.json.enviando.lock`);
    const hace20min = new Date(Date.now() - 20 * 60_000);
    utimesSync(archivo, hace20min, hace20min);
    expect(readFileSync(archivo, "utf8")).toBe("");
    expect(await reclamar("sellos", id, "enviando", 10 * 60_000)).toBe(true);
  });
  it("muchos envíos simultáneos del mismo lote: pasa uno solo", async () => {
    const id = "c".repeat(32);
    const r = await Promise.all(Array.from({ length: 10 }, () => reclamar("sellos", id, "enviando", 60_000)));
    expect(r.filter(Boolean)).toHaveLength(1);
  });
});
