import { describe, expect, it } from "vitest";
import { confirmarPropuestas, huellaAdjuntable, procesarMensaje } from "../src/lib/agentes/flujo";
import type { ConfigAgentes, Proveedor } from "../src/lib/agentes/proveedor";

const HOY = "2026-11-06";
const H = "ab".repeat(32);
const una = { remito: "R-1", producto: "Aceite", unidad: "cajas", cantidadPedida: 10, cantidadRecibida: 10, fechaEntrega: "2026-11-05" };
const otra = { ...una, remito: "R-2" };
const fijo = (o: unknown): Proveedor => async () => JSON.stringify(o);
const cfg = (entregas: unknown[]): ConfigAgentes => ({ registrador: fijo({ entregas }), verificador: fijo({ hallazgos: [] }), independientes: true, modelos: { registrador: "a", verificador: "b" } });
const original = (v: { evaluacion: { reglas: { id: string; ok: boolean }[] } }) => v.evaluacion.reglas.find((r) => r.id === "ALC-ORI-01");

describe("huella de la evidencia en el flujo de agentes", () => {
  it("solo se adjunta una huella válida y cuando el mensaje cuenta una sola entrega", () => {
    expect(huellaAdjuntable(H, 1)).toBe(H);
    expect(huellaAdjuntable(H, 2)).toBeUndefined();
    expect(huellaAdjuntable("xyz", 1)).toBeUndefined();
    expect(huellaAdjuntable(undefined, 1)).toBeUndefined();
    expect(huellaAdjuntable(H.toUpperCase(), 1)).toBeUndefined();
  });
  it("con huella, la regla de original (ALC-ORI-01) pasa y la entrega queda verde", async () => {
    const r = await procesarMensaje(cfg([una]), "R-1 llegaron 10 cajas de aceite", "ana", HOY, H);
    expect(original(r.vistas[0])?.ok).toBe(true);
  });
  it("sin huella, queda declarada (amarillo por falta de original)", async () => {
    const r = await procesarMensaje(cfg([una]), "R-1 llegaron 10 cajas de aceite", "ana", HOY);
    expect(original(r.vistas[0])?.ok).toBe(false);
    expect(r.vistas[0].evaluacion.veredicto).not.toBe("rojo");
  });
  it("con dos entregas la huella no se reparte entre ellas: ninguna la recibe", async () => {
    const r = await procesarMensaje(cfg([una, otra]), "R-1 y R-2, 10 cajas cada uno", "ana", HOY, H);
    expect(r.vistas.every((v) => original(v)?.ok === false)).toBe(true);
  });
  it("la confirmación mantiene la huella y los documentos listos para sellar la llevan", async () => {
    const r = await procesarMensaje(cfg([una]), "R-1 llegaron 10 cajas", "ana", HOY, H);
    const c = confirmarPropuestas(r.propuestas, r.hallazgos, "ana", "luis", HOY, H);
    expect(c.documentos).toHaveLength(1);
    expect((c.documentos[0] as { evidenciaHash?: string }).evidenciaHash).toBe(H);
  });
  it("una huella inventada por el modelo no cuenta: solo vale la que pone el servidor", async () => {
    const r = await procesarMensaje(cfg([{ ...una, evidenciaHash: H }]), "R-1", "ana", HOY);
    expect(original(r.vistas[0])?.ok).toBe(false);
  });
});
