import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limitarPedido, resumenDeOrigen } from "../src/lib/servidor/limite";

let n = 0;
const pedido = (ip: string, ruta = "/api/verificar") => new Request(`https://x.test${ruta}`, { headers: { "x-forwarded-for": ip } });
const ipNueva = () => `10.9.${Math.floor(++n / 250)}.${n % 250}`;

describe("límite de pedidos sin base de datos", () => {
  it("sigue como siempre: deja pasar hasta el máximo y después responde 429", async () => {
    const ip = ipNueva();
    for (let i = 0; i < 3; i++) expect(await limitarPedido(pedido(ip), 3)).toBeNull();
    const r = await limitarPedido(pedido(ip), 3);
    expect(r?.status).toBe(429);
  });
});

describe("límite de pedidos con base de datos", () => {
  beforeEach(() => { process.env.SUPABASE_URL = "https://ejemplo.supabase.co"; process.env.SUPABASE_SERVICE_KEY = "clave-de-prueba"; });
  afterEach(() => { delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY; delete process.env.GALCOA_LIMITE_FALLA; vi.unstubAllGlobals(); });

  it("cuenta en la base y rechaza cuando el total pasa el máximo, sin guardar la IP", async () => {
    let total = 0;
    const cuerpos: string[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => { cuerpos.push(init.body as string); return new Response(JSON.stringify(++total)); });
    const ip = ipNueva();
    expect(await limitarPedido(pedido(ip), 2)).toBeNull();
    expect(await limitarPedido(pedido(ip), 2)).toBeNull();
    expect((await limitarPedido(pedido(ip), 2))?.status).toBe(429);
    expect(cuerpos.join("")).not.toContain(ip);
    expect(JSON.parse(cuerpos[0]).p_clave).toMatch(/^[0-9a-f]{32}$/);
  });
  it("si la base no responde, falla cerrado: 503 y no deja pasar", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }));
    const r = await limitarPedido(pedido(ipNueva()), 5);
    expect(r?.status).toBe(503);
    expect(r?.headers.get("retry-after")).toBe("60");
  });
  it("si la base no contesta a tiempo, también falla cerrado", async () => {
    vi.stubGlobal("fetch", async () => { throw new DOMException("timeout", "TimeoutError"); });
    expect((await limitarPedido(pedido(ipNueva()), 5))?.status).toBe(503);
  });
  it("con GALCOA_LIMITE_FALLA=abierto, una caída de la base no corta el servicio", async () => {
    process.env.GALCOA_LIMITE_FALLA = "abierto";
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }));
    expect(await limitarPedido(pedido(ipNueva()), 5)).toBeNull();
  });
  it("una respuesta rara de la base no se toma como permiso", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify("hola")));
    expect((await limitarPedido(pedido(ipNueva()), 5))?.status).toBe(503);
  });
  it("el resumen cambia con la ruta y no deja ver la IP", () => {
    expect(resumenDeOrigen("1.2.3.4", "/a")).not.toBe(resumenDeOrigen("1.2.3.4", "/b"));
    expect(resumenDeOrigen("1.2.3.4", "/a")).not.toContain("1.2.3.4");
  });
});
