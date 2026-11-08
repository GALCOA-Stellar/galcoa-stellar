import { describe, expect, it } from "vitest";
import { horizonProboAusencia, motivoSinRed } from "../src/lib/stellar/stellar";

describe("una ausencia no es una caída", () => {
  it("solo un 404 de Horizon prueba que la transacción no existe", () => {
    expect(horizonProboAusencia(404)).toBe(true);
    for (const s of [429, 500, 502, 503, 504, 0]) expect(horizonProboAusencia(s)).toBe(false);
  });

  it("si no se pudo consultar la red, el mensaje no dice que el lote no figura", () => {
    const m = motivoSinRed(true, "Prueba guardada coherente");
    expect(m).toContain("No pudimos consultar la red");
    expect(m).toContain("no significa que el lote no exista");
    expect(m).not.toContain("Todavía no figura");
  });

  it("si la red respondió y no está, el mensaje sí dice que todavía no figura", () => {
    expect(motivoSinRed(false, "x")).toContain("Todavía no figura en la red");
  });
});
