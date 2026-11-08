import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conCache, vaciarCache } from "../src/lib/servidor/cache-corto";

beforeEach(() => { vi.useFakeTimers(); vaciarCache(); });
afterEach(() => vi.useRealTimers());

describe("lectura con memoria corta", () => {
  it("dentro del plazo no vuelve a leer", async () => {
    const leer = vi.fn(async () => "a");
    expect(await conCache("k", 30_000, 300_000, leer)).toBe("a");
    vi.advanceTimersByTime(10_000);
    expect(await conCache("k", 30_000, 300_000, leer)).toBe("a");
    expect(leer).toHaveBeenCalledTimes(1);
  });

  it("vencido el plazo entrega lo guardado al instante y actualiza por detrás", async () => {
    let n = 0;
    const leer = vi.fn(async () => `v${++n}`);
    await conCache("k", 30_000, 300_000, leer);
    vi.advanceTimersByTime(31_000);
    expect(await conCache("k", 30_000, 300_000, leer)).toBe("v1"); // no espera
    await vi.advanceTimersByTimeAsync(1);
    expect(await conCache("k", 30_000, 300_000, leer)).toBe("v2");
  });

  it("pasada la edad máxima espera una lectura nueva", async () => {
    let n = 0;
    const leer = vi.fn(async () => `v${++n}`);
    await conCache("k", 30_000, 300_000, leer);
    vi.advanceTimersByTime(301_000);
    expect(await conCache("k", 30_000, 300_000, leer)).toBe("v2");
  });

  it("no guarda un fallo (null) y pedidos simultáneos comparten una sola lectura", async () => {
    const mala = vi.fn(async () => null);
    expect(await conCache("m", 30_000, 300_000, mala)).toBeNull();
    expect(await conCache("m", 30_000, 300_000, mala)).toBeNull();
    expect(mala).toHaveBeenCalledTimes(2);
    const lenta = vi.fn(async () => "x");
    await Promise.all([conCache("s", 30_000, 300_000, lenta), conCache("s", 30_000, 300_000, lenta)]);
    expect(lenta).toHaveBeenCalledTimes(1);
  });
});
