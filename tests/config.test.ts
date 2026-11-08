import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verificarComprobante } from "../src/lib/aplicacion/lote";
import { ESCROW_ID, LOTE_EJEMPLO, REGISTRO_ID, SERVICIO_ID } from "../src/lib/config/contratos";

const leer = (f: string) => readFileSync(f, "utf8");

describe("identificadores canónicos de Testnet", () => {
  it("tienen la forma de una dirección de Stellar", () => {
    expect(REGISTRO_ID).toMatch(/^C[A-Z2-7]{55}$/);
    expect(ESCROW_ID).toMatch(/^C[A-Z2-7]{55}$/);
    expect(SERVICIO_ID).toMatch(/^G[A-Z2-7]{55}$/);
    expect(LOTE_EJEMPLO).toMatch(/^[0-9a-f]{64}$/);
  });
  it.each(["README.md", "README.en.md", "docs/arquitectura/DESPLIEGUE.md", "docs/demo/GUIA-DEMO-LAB.md"])(
    "%s nombra los mismos identificadores que el código",
    (archivo) => {
      const t = leer(archivo);
      expect(t).toContain(REGISTRO_ID);
      expect(t).toContain(ESCROW_ID);
    },
  );
  it("el comprobante de ejemplo corresponde al lote de ejemplo", () => {
    const v = verificarComprobante(JSON.parse(leer("public/spec/ejemplo-comprobante.json")));
    expect(v.coherente).toBe(true);
    expect(v.memoEsperado).toBe(LOTE_EJEMPLO);
  });
});
