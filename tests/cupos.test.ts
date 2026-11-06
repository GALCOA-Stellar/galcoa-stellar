import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cupoDiario, usarCupo } from "../src/lib/cupos";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "galcoa-cupos-"));
  vi.stubEnv("GALCOA_DATOS", dir);
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("cupo diario de sellos por cuenta", () => {
  it("por defecto son 20 y un valor inválido vuelve al defecto", () => {
    expect(cupoDiario()).toBe(20);
    vi.stubEnv("CUPO_DIARIO", "abc");
    expect(cupoDiario()).toBe(20);
    vi.stubEnv("CUPO_DIARIO", "5");
    expect(cupoDiario()).toBe(5);
  });
  it("deja usar el cupo y después frena a esa cuenta, sin tocar a las demás", async () => {
    vi.stubEnv("CUPO_DIARIO", "3");
    const dia = Date.UTC(2026, 10, 6, 12);
    for (let i = 1; i <= 3; i++) expect((await usarCupo("GAAA", dia)).usados).toBe(i);
    expect((await usarCupo("GAAA", dia)).ok).toBe(false);
    expect((await usarCupo("GBBB", dia)).ok).toBe(true);
  });
  it("al día siguiente el cupo se renueva", async () => {
    vi.stubEnv("CUPO_DIARIO", "1");
    expect((await usarCupo("GAAA", Date.UTC(2026, 10, 6, 23))).ok).toBe(true);
    expect((await usarCupo("GAAA", Date.UTC(2026, 10, 6, 23, 59))).ok).toBe(false);
    expect((await usarCupo("GAAA", Date.UTC(2026, 10, 7, 0, 1))).ok).toBe(true);
  });
  it("pedidos simultáneos no se llevan la misma casilla", async () => {
    vi.stubEnv("CUPO_DIARIO", "4");
    const dia = Date.UTC(2026, 10, 6);
    const r = await Promise.all(Array.from({ length: 10 }, () => usarCupo("GCCC", dia)));
    expect(r.filter((x) => x.ok).length).toBe(4);
  });
  it("con CUPO_DIARIO=0 no hay límite", async () => {
    vi.stubEnv("CUPO_DIARIO", "0");
    expect((await usarCupo("GAAA")).ok).toBe(true);
  });
});
