import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { cosmosPayActivo, crearCobro, ErrorDeFirma, leerWebhook } from "../src/lib/stellar/cosmospay";

const DESTINO = `G${"A".repeat(55)}`;
const firmar = (cuerpo: string, secreto: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secreto).update(`${t}.${cuerpo}`).digest("hex")}`;

describe("Cosmos Pay: cobros (experimental, apagado sin clave)", () => {
  it("sin clave está apagado y no crea nada", async () => {
    expect(cosmosPayActivo({})).toBe(false);
    await expect(crearCobro({ destino: DESTINO, monto: "5" }, {})).rejects.toThrow("no está configurado");
  });
  it("crea un cobro SEP-7 con el cliente y recorta el mensaje a 80 caracteres; validar exige un hash válido", async () => {
    const createPay = vi.fn(async () => ({ uri: "web+stellar:pay?x=1", qr: "data:image/png;base64,AA", validate: async (h: string) => ({ valid: h.startsWith("a"), status: "settled" }) }));
    const cobro = await crearCobro({ destino: DESTINO, monto: "12.5", mensaje: `Pedido ${"x".repeat(100)}` }, { COSMOS_PAY_API_KEY: "clave-de-prueba" }, () => ({ paymentIntents: { createPay } }) as never);
    expect(createPay).toHaveBeenCalledWith({ destination: DESTINO, amount: "12.5", msg: `Pedido ${"x".repeat(100)}`.slice(0, 80) });
    expect(cobro.uri).toContain("web+stellar:pay");
    expect(await cobro.validar("a".repeat(64))).toEqual({ valido: true, estado: "settled" });
    await expect(cobro.validar("no-es-hash")).rejects.toThrow("hash");
  });
  it("rechaza destinos y montos mal formados antes de llamar al servicio", async () => {
    const env = { COSMOS_PAY_API_KEY: "k" };
    const nunca = () => { throw new Error("no debía llamarse"); };
    await expect(crearCobro({ destino: "GABC", monto: "5" }, env, nunca as never)).rejects.toThrow("destino");
    await expect(crearCobro({ destino: DESTINO, monto: "0" }, env, nunca as never)).rejects.toThrow("monto");
    await expect(crearCobro({ destino: DESTINO, monto: "1.12345678" }, env, nunca as never)).rejects.toThrow("monto");
  });
});

describe("Cosmos Pay: webhooks firmados", () => {
  const cuerpo = JSON.stringify({ type: "PAYMENT_INTENT_SUCCEEDED", data: { id: "pi_1" } });
  it("acepta una firma buena y devuelve el evento", () => {
    expect(leerWebhook(cuerpo, firmar(cuerpo, "whsec_x"), "whsec_x")).toMatchObject({ type: "PAYMENT_INTENT_SUCCEEDED" });
  });
  it("rechaza firma ajena, cuerpo alterado, falta de datos y repeticiones viejas", () => {
    expect(() => leerWebhook(cuerpo, firmar(cuerpo, "otro"), "whsec_x")).toThrow(ErrorDeFirma);
    expect(() => leerWebhook(`${cuerpo} `, firmar(cuerpo, "whsec_x"), "whsec_x")).toThrow(ErrorDeFirma);
    expect(() => leerWebhook(cuerpo, null, "whsec_x")).toThrow("Falta la firma");
    expect(() => leerWebhook(cuerpo, firmar(cuerpo, "whsec_x"), undefined)).toThrow("secreto");
    const vieja = firmar(cuerpo, "whsec_x", Math.floor(Date.now() / 1000) - 3600);
    expect(() => leerWebhook(cuerpo, vieja, "whsec_x")).toThrow(ErrorDeFirma);
  });
});
