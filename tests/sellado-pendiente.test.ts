import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { anotarSiQuedoPendiente, revisarPendiente, VENTANA_MS } from "../src/lib/aplicacion/pendiente";
import { esDeLaSesion, operacionPorMemo, registrarOperacion } from "../src/lib/datos/historial";
import { leerPendiente } from "../src/lib/datos/pendientes";
import { ConfirmacionPendiente } from "../src/lib/stellar/stellar";

/** Auditoría externa 07/11/2026, hallazgos 1, 2, 3 y 5: la red tarda, el reintento no sella dos veces. */
beforeAll(() => { process.env.GALCOA_DATOS = mkdtempSync(join(tmpdir(), "galcoa-p-")); });
const prueba = { ledger: 9, cierreLedger: null, envelopeXdr: "x", resultXdr: null };

describe("sellado que la red tarda en confirmar", () => {
  it("anota el hash del intento en vez de soltar el bloqueo", async () => {
    const memo = "1".repeat(64);
    expect(await anotarSiQuedoPendiente(new ConfirmacionPendiente("a".repeat(64)), memo, "una-firma", 1000)).toBe(true);
    expect(await leerPendiente(memo)).toMatchObject({ txHash: "a".repeat(64), vigenteHasta: 1000 + VENTANA_MS["una-firma"] });
    expect(await anotarSiQuedoPendiente(new Error("otro error"), "2".repeat(64), "2de2")).toBe(false);
  });

  it("si el hash anterior ya entró, el reintento lo reutiliza y no envía otra transacción", async () => {
    const memo = "3".repeat(64);
    await anotarSiQuedoPendiente(new ConfirmacionPendiente("b".repeat(64)), memo, "una-firma", 0);
    const r = await revisarPendiente(memo, 10, async () => ({ estado: "exito", ledger: 9, prueba }));
    expect(r).toMatchObject({ tipo: "exito", tx: { txHash: "b".repeat(64), ledger: 9 } });
    expect(await leerPendiente(memo)).toBeNull();
  });

  it("si todavía puede entrar, se espera (no se arma otra transacción)", async () => {
    const memo = "4".repeat(64);
    await anotarSiQuedoPendiente(new ConfirmacionPendiente("c".repeat(64)), memo, "una-firma", 0);
    expect((await revisarPendiente(memo, 1000, async () => ({ estado: "no-encontrada" }))).tipo).toBe("espera");
    expect((await revisarPendiente(memo, 1000, async () => ({ estado: "indisponible" }))).tipo).toBe("espera");
  });

  it("solo cuando ya no puede entrar o falló se permite un intento nuevo", async () => {
    const memo = "5".repeat(64);
    await anotarSiQuedoPendiente(new ConfirmacionPendiente("d".repeat(64)), memo, "una-firma", 0);
    expect((await revisarPendiente(memo, VENTANA_MS["una-firma"] + 1, async () => ({ estado: "no-encontrada" }))).tipo).toBe("ninguno");
    await anotarSiQuedoPendiente(new ConfirmacionPendiente("e".repeat(64)), memo, "una-firma", 0);
    expect((await revisarPendiente(memo, 10, async () => ({ estado: "fallo" }))).tipo).toBe("ninguno");
  });

  it("sin intento previo no hay nada pendiente", async () => {
    expect((await revisarPendiente("6".repeat(64))).tipo).toBe("ninguno");
  });
});

describe("¿ya se selló?: consulta directa por índice", () => {
  it("encuentra la operación por su huella sin recorrer todas", async () => {
    const memo = "7".repeat(64);
    await registrarOperacion({ txHash: "f".repeat(64), ledger: 1, memo, cantidadHojas: 1, firmadoPor: "G1", modo: "una-firma", archivo: null });
    expect((await operacionPorMemo(memo))?.txHash).toBe("f".repeat(64));
    expect(await operacionPorMemo("8".repeat(64))).toBeNull();
  });
});

describe("historial por dueño", () => {
  it("solo ve o borra quien participó", () => {
    const op = { firmadoPor: ["GA", "GB"], personas: ["ana"] };
    expect(esDeLaSesion(op, { cuenta: "GA", identidad: "x" })).toBe(true);
    expect(esDeLaSesion(op, { cuenta: "GZ", identidad: "ana" })).toBe(true);
    expect(esDeLaSesion(op, { cuenta: "GZ", identidad: "luis" })).toBe(false);
  });
});
