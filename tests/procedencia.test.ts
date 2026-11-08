import { describe, expect, it } from "vitest";
import { faltasDeProcedencia, limpiarCitas, normalizarCita } from "../src/lib/dominio/procedencia";
import { procesarMensaje } from "../src/lib/agentes/flujo";
import type { ConfigAgentes } from "../src/lib/agentes/proveedor";

const MENSAJE = "Remito A-12: llegaron 8 cajas de Aceite 900 ml, pedidas 10. Entrega del 5/11/2026.";

describe("procedencia de cada dato (ALC-PRO-01)", () => {
  it("una cita que está en el mensaje (sin importar tildes, mayúsculas o espacios) respalda el dato", () => {
    expect(normalizarCita("  Aceite   900 ML ")).toBe("aceite 900 ml");
    const f = faltasDeProcedencia(MENSAJE, [{ remito: "A-12", cantidadRecibida: 8 }], [{ remito: "remito  a-12", cantidadRecibida: "llegaron 8 cajas" }]);
    expect(f).toEqual([]);
  });
  it("un dato sin cita queda señalado", () => {
    expect(faltasDeProcedencia(MENSAJE, [{ remito: "A-12" }], [{}])).toEqual([{ indice: 0, campo: "remito", motivo: "sin-cita" }]);
  });
  it("una cita inventada (que no está en el mensaje) queda señalada", () => {
    const f = faltasDeProcedencia(MENSAJE, [{ cantidadRecibida: 80 }], [{ cantidadRecibida: "llegaron 80 cajas" }]);
    expect(f).toEqual([{ indice: 0, campo: "cantidadRecibida", motivo: "cita-inexistente" }]);
  });
  it("las citas que no son texto o son de campos desconocidos se descartan", () => {
    expect(limpiarCitas({ remito: "A-12", cantidadRecibida: 8, otro: "x", producto: "" })).toEqual({ remito: "A-12" });
    expect(limpiarCitas("hola")).toEqual({});
  });
});

describe("el flujo usa la procedencia", () => {
  const entrega = { remito: "A-12", producto: "Aceite 900 ml", unidad: "cajas", cantidadPedida: 10, cantidadRecibida: 8, fechaEntrega: "2026-11-05" };
  const cfg = (citas: Record<string, string>): ConfigAgentes => ({
    registrador: async () => JSON.stringify({ entregas: [{ ...entrega, citas }] }),
    verificador: async () => JSON.stringify({ hallazgos: [] }),
    independientes: true,
    modelos: { registrador: "a", verificador: "b" },
  });
  const buenas = { remito: "Remito A-12", producto: "Aceite 900 ml", unidad: "8 cajas", cantidadPedida: "pedidas 10", cantidadRecibida: "llegaron 8 cajas", fechaEntrega: "Entrega del 5/11/2026" };

  it("con todas las citas verdaderas no hay hallazgos de procedencia", async () => {
    const r = await procesarMensaje(cfg(buenas), MENSAJE, "ana", "2026-11-06");
    expect(r.hallazgos?.some((h) => h.mensaje.startsWith("ALC-PRO-01"))).toBe(false);
  });
  it("una cita falsa baja el veredicto a rojo: el dato no sale del mensaje", async () => {
    const r = await procesarMensaje(cfg({ ...buenas, producto: "Aceite de oliva 5 litros" }), MENSAJE, "ana", "2026-11-06");
    expect(r.hallazgos?.some((h) => h.campo === "producto" && h.severidad === "critica" && h.mensaje.startsWith("ALC-PRO-01"))).toBe(true);
    expect(r.vistas[0].evaluacion.veredicto).toBe("rojo");
  });
  it("sin citas, el dato no queda verde", async () => {
    const r = await procesarMensaje(cfg({}), MENSAJE, "ana", "2026-11-06");
    expect(r.hallazgos?.some((h) => h.severidad === "advertencia" && h.mensaje.startsWith("ALC-PRO-01"))).toBe(true);
    expect(r.vistas[0].evaluacion.veredicto).not.toBe("verde");
  });
});
