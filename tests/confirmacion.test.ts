import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crear, responder, vistaPublica, VIGENCIA_ENLACE_MS } from "../src/lib/confirmacion";
import { guardar, leer, listar, idValido } from "../src/lib/almacen";

const doc = { remito: "R-7", producto: "Yerba 1 kg", unidad: "caja", cantidadPedida: 10, cantidadRecibida: 10, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "operador-01", confirmadoPor: "receptor-01", evidenciaHash: "ab".repeat(32) };
beforeAll(() => { process.env.GALCOA_DATOS = mkdtempSync(join(tmpdir(), "galcoa-")); });

describe("confirmación del comercio", () => {
  it("el comercio solo ve lo que le toca, nunca datos internos", async () => {
    const c = await crear(doc);
    const v = vistaPublica(c);
    expect(v.documento).toMatchObject({ remito: "R-7", producto: "Yerba 1 kg" });
    expect(JSON.stringify(v)).not.toContain("operador-01");
    expect(JSON.stringify(v)).not.toContain("ab".repeat(32));
  });
  it("se responde una sola vez", async () => {
    const c = await crear(doc);
    expect((await responder(c.id, "confirmada", "todo bien")).estado).toBe("confirmada");
    await expect(responder(c.id, "no_coincide", "")).rejects.toThrow("ya se usó");
  });
  it("si dos respuestas llegan a la vez, solo una gana", async () => {
    const c = await crear(doc);
    const r = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => responder(c.id, i % 2 ? "confirmada" : "no_coincide", "")));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });
  it("rechaza respuestas raras, enlaces vencidos e inexistentes", async () => {
    const c = await crear(doc);
    await expect(responder(c.id, "quizás", "")).rejects.toThrow("Respuesta no válida");
    await expect(responder(c.id, "confirmada", "", Date.now() + VIGENCIA_ENLACE_MS + 1000)).rejects.toThrow("venció");
    await expect(responder("0".repeat(32), "confirmada", "")).rejects.toThrow("no existe");
  });
  it("no crea enlaces para datos inválidos", async () => {
    await expect(crear({ remito: "x" })).rejects.toThrow("no son válidos");
  });
});

describe("almacén", () => {
  it("rechaza ids y colecciones que intenten salir de la carpeta", async () => {
    expect(idValido("../../etc/passwd")).toBe(false);
    await expect(guardar("../x", "0".repeat(32), {})).rejects.toThrow("Registro inválido");
    await expect(guardar("cosas", "../../x", {})).rejects.toThrow("Registro inválido");
  });
  it("guarda, lee y lista", async () => {
    await guardar("cosas", "1".repeat(32), { a: 1 });
    expect(await leer("cosas", "1".repeat(32))).toEqual({ a: 1 });
    expect((await listar("cosas")).length).toBeGreaterThanOrEqual(1);
    expect(await leer("cosas", "2".repeat(32))).toBeNull();
  });
});
