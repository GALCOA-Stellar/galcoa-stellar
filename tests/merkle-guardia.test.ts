import { describe, expect, it } from "vitest";
import { verificarCamino } from "../src/lib/dominio/merkle";

describe("verificarCamino con entradas raras (auditoría 07/11)", () => {
  const h = "a".repeat(64);
  it("un camino null o que no es lista no tira excepción: da falso", () => {
    expect(verificarCamino(h, null as never, h)).toBe(false);
    expect(verificarCamino(h, "x" as never, h)).toBe(false);
    expect(verificarCamino(h, [null] as never, h)).toBe(false);
  });
});
