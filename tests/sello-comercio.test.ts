import { describe, expect, it } from "vitest";
import { emitirSello } from "../src/lib/datos/sello-comercio";
import { previsualizarLote } from "../src/lib/aplicacion/lote";

const doc = { remito: "R-5", producto: "Sal 500 g", unidad: "caja", cantidadPedida: 10, cantidadRecibida: 10, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "operador-01", confirmadoPor: "receptor-01", evidenciaHash: "ab".repeat(32) };
const veredicto = (d: unknown) => previsualizarLote([d]).documentos[0].veredicto;

describe("sello de la confirmación del comercio", () => {
  const sello = emitirSello("a1b2c3d4".padEnd(32, "0"), doc)!;
  it("un sello emitido por el servidor para estos datos sirve (documento verde)", () => {
    expect(veredicto({ ...doc, confirmadoPor: sello })).toBe("verde");
  });
  it("escribir 'comercio-...' a mano no sirve (rojo)", () => {
    expect(veredicto({ ...doc, confirmadoPor: "comercio-12345678" })).toBe("rojo");
    expect(veredicto({ ...doc, confirmadoPor: "comercio-12345678-" + "0".repeat(32) })).toBe("rojo");
  });
  it("cambiar un dato después de la confirmación invalida el sello (rojo)", () => {
    expect(veredicto({ ...doc, confirmadoPor: sello, cantidadRecibida: 9, observacion: "x" })).toBe("rojo");
    expect(veredicto({ ...doc, confirmadoPor: sello, producto: "Otro" })).toBe("rojo");
  });
  it("cambiar datos internos que el comercio no vio no invalida el sello", () => {
    expect(veredicto({ ...doc, confirmadoPor: sello, cargadoPor: "operador-09" })).toBe("verde");
  });
  it("un sello de otro documento no sirve", () => {
    const otro = emitirSello("a1b2c3d4".padEnd(32, "0"), { ...doc, remito: "R-6" })!;
    expect(veredicto({ ...doc, confirmadoPor: otro })).toBe("rojo");
  });
});
