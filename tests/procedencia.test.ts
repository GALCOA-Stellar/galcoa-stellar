import { describe, expect, it } from "vitest";
import { faltasDeProcedencia, limpiarCitas, normalizarCita, respalda } from "../src/lib/dominio/procedencia";
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
  it("una cita real que no respalda el número propuesto queda señalada (18 citando \"llegaron 8 cajas\")", () => {
    const msg = "Remito 18: llegaron 8 cajas de aceite, habíamos pedido 10.";
    const f = faltasDeProcedencia(msg, [{ remito: "18", cantidadRecibida: 18 }], [{ remito: "Remito 18", cantidadRecibida: "llegaron 8 cajas" }]);
    expect(f).toEqual([{ indice: 0, campo: "cantidadRecibida", motivo: "cita-no-respalda" }]);
  });
  it("una cita mínima que no contiene el texto propuesto queda señalada (producto inventado citando \"a\")", () => {
    const f = faltasDeProcedencia(MENSAJE, [{ producto: "vino tinto" }], [{ producto: "a" }]);
    expect(f).toEqual([{ indice: 0, campo: "producto", motivo: "cita-no-respalda" }]);
  });
  it("respaldan: cantidades en palabras o con separador de miles, plural/singular, mayúsculas y fechas relativas", () => {
    expect(respalda("cantidadRecibida", 8, "llegaron ocho cajas")).toBe(true);
    expect(respalda("cantidadPedida", 1200, "pedimos 1.200 unidades")).toBe(true);
    expect(respalda("unidad", "caja", "8 cajas")).toBe(true);
    expect(respalda("producto", "aceite 900 ml", "8 cajas de Aceite 900 ml")).toBe(true);
    expect(respalda("remito", "A-12", "Remito A-12")).toBe(true);
    expect(respalda("fechaEntrega", "2026-11-05", "ayer")).toBe(true);
    expect(respalda("producto", "aceite de oliva", "8 cajas de aceite")).toBe(false);
    expect(respalda("cantidadRecibida", 80, "llegaron 8 cajas")).toBe(false);
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
  it("una cita real que no respalda la cantidad baja el veredicto a rojo", async () => {
    const r = await procesarMensaje(cfg({ ...buenas, cantidadRecibida: "pedidas 10" }), MENSAJE, "ana", "2026-11-06");
    expect(r.hallazgos?.some((h) => h.campo === "cantidadRecibida" && h.severidad === "critica" && h.mensaje.includes("no respalda"))).toBe(true);
    expect(r.vistas[0].evaluacion.veredicto).toBe("rojo");
  });
  it("una observación que no calza con su cita queda en amarillo, no en rojo", async () => {
    const cfgObs: ConfigAgentes = {
      registrador: async () => JSON.stringify({ entregas: [{ ...entrega, observacion: "faltaron dos cajas", citas: { ...buenas, observacion: "pedidas 10" } }] }),
      verificador: async () => JSON.stringify({ hallazgos: [] }),
      independientes: true,
      modelos: { registrador: "a", verificador: "b" },
    };
    const r = await procesarMensaje(cfgObs, MENSAJE, "ana", "2026-11-06");
    const h = r.hallazgos?.filter((x) => x.mensaje.startsWith("ALC-PRO-01")) ?? [];
    expect(h).toEqual([expect.objectContaining({ campo: "observacion", severidad: "advertencia" })]);
  });
  it("si el verificador se cae y además hay avisos de procedencia, la caída no queda escondida", async () => {
    const caido: ConfigAgentes = { ...cfg({}), verificador: async () => { throw new Error("caído"); } };
    const r = await procesarMensaje(caido, MENSAJE, "ana", "2026-11-06");
    expect(r.verificadorCaido).toBe(true);
    expect(r.hallazgos?.some((h) => h.campo === "verificador" && h.mensaje.includes("No se pudo verificar"))).toBe(true);
    expect(r.vistas[0].evaluacion.veredicto).not.toBe("verde");
  });
  it("sin citas, el dato no queda verde", async () => {
    const r = await procesarMensaje(cfg({}), MENSAJE, "ana", "2026-11-06");
    expect(r.hallazgos?.some((h) => h.severidad === "advertencia" && h.mensaje.startsWith("ALC-PRO-01"))).toBe(true);
    expect(r.vistas[0].evaluacion.veredicto).not.toBe("verde");
  });
});
