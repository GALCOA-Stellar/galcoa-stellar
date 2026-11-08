import { describe, expect, it } from "vitest";
import { pedidoConfirmacion, pedidoPrevisualizar, pedidoRegistrar, pedidoRonda } from "../src/lib/dominio/esquemas";
import { ErrorDeForma, leerCuerpo } from "../src/lib/servidor/guardas";

const pedido = (cuerpo: unknown) => new Request("http://localhost/api/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
const mensajeDe = async (cuerpo: unknown, esquema: Parameters<typeof leerCuerpo>[1]) => {
  try { await leerCuerpo(pedido(cuerpo), esquema); return null; } catch (e) { return e instanceof ErrorDeForma ? e.message : `otro: ${String(e)}`; }
};

describe("forma de los pedidos (Zod)", () => {
  it("acepta un pedido de carga bien formado y descarta una huella mal escrita sin frenar", async () => {
    const r = await leerCuerpo(pedido({ mensaje: "llegaron 5 cajas", cargadoPor: "ana", evidenciaHash: "xyz", sobra: 1 }), pedidoRegistrar);
    expect(r).toEqual({ mensaje: "llegaron 5 cajas", cargadoPor: "ana", evidenciaHash: undefined });
  });
  it("rechaza con mensajes en castellano lo que falta o está mal", async () => {
    expect(await mensajeDe({ cargadoPor: "ana" }, pedidoRegistrar)).toBe("Escribí qué entrega querés cargar");
    expect(await mensajeDe({ mensaje: "   ", cargadoPor: "ana" }, pedidoRegistrar)).toBe("Escribí qué entrega querés cargar");
    expect(await mensajeDe({ mensaje: "x".repeat(1501), cargadoPor: "ana" }, pedidoRegistrar)).toMatch(/demasiado largo/);
    expect(await mensajeDe({ mensaje: "hola", cargadoPor: "Ana Pérez!" }, pedidoRegistrar)).toMatch(/Falta quién carga/);
  });
  it("los lotes tienen que ser una lista y los documentos, objetos", async () => {
    expect(await mensajeDe({ documentos: "no" }, pedidoPrevisualizar)).toBe("Mandá al menos un documento");
    expect(await mensajeDe({}, pedidoPrevisualizar)).toBe("Mandá al menos un documento");
    expect(await mensajeDe({ documento: [1] }, pedidoConfirmacion)).toBe("Los datos del documento no son válidos");
    expect(await mensajeDe({ documento: {}, roles: "proveedor" }, pedidoRonda)).toBe("Elegí quiénes confirman");
  });
  it("un mensaje por defecto de Zod (en inglés) nunca llega a la persona", async () => {
    expect(await mensajeDe("texto suelto", pedidoRonda)).toBe("El pedido no tiene el formato esperado");
  });
  it("sigue rechazando pedidos de otro sitio y de tipo equivocado antes de mirar la forma", async () => {
    const otro = new Request("http://localhost/api/x", { method: "POST", headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" }, body: "{}" });
    await expect(leerCuerpo(otro, pedidoPrevisualizar)).rejects.toThrow("Pedido de otro sitio");
    const texto = new Request("http://localhost/api/x", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    await expect(leerCuerpo(texto, pedidoPrevisualizar)).rejects.toThrow("Se espera JSON");
  });
});

describe("mensajePublico", () => {
  it("muestra el mensaje de un error público, el de un prefijo permitido y oculta todo lo demás", async () => {
    const { ErrorPublico, mensajePublico } = await import("../src/lib/servidor/guardas");
    expect(mensajePublico(new ErrorPublico("Se espera JSON"), [], "genérico")).toBe("Se espera JSON");
    expect(mensajePublico(new Error("Máximo 50 documentos"), ["Máximo"], "genérico")).toBe("Máximo 50 documentos");
    expect(mensajePublico(new Error("ECONNREFUSED 10.0.0.1:5432 clave=abc"), ["Máximo"], "genérico")).toBe("genérico");
    expect(mensajePublico("texto", ["Máximo"], "genérico")).toBe("genérico");
  });
});
