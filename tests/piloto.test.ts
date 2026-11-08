import { describe, expect, it } from "vitest";
import { evaluar } from "../src/lib/dominio/rules";
import { previsualizarLote } from "../src/lib/aplicacion/lote";

// Set de 50 remitos con errores sembrados (separado de los ejemplos con los que se ajustaron las reglas).
const H = "cd".repeat(32);
const limpio = (n: number) => ({ unidad: "caja", fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "operador-02", confirmadoPor: "receptor-02", evidenciaHash: n.toString(16).padStart(64, "0"), remito: `P-${n}`, producto: "Gaseosa 2 l", cantidadPedida: 40, cantidadRecibida: 40 });
const sembrados: Record<number, { esperado: "rojo" | "amarillo"; cambio: object }> = {
  3: { esperado: "rojo", cambio: { confirmadoPor: "operador-02" } },                 // quien carga confirma
  8: { esperado: "rojo", cambio: { cantidadRecibida: 35 } },                           // cantidad distinta sin explicación
  12: { esperado: "amarillo", cambio: { fechaRegistro: "2026-11-20" } },               // carga tardía: se sella marcada
  17: { esperado: "rojo", cambio: { confirmadoPor: "" } },                             // falta quien confirma
  21: { esperado: "amarillo", cambio: { evidenciaHash: undefined } },                  // falta el original
  26: { esperado: "rojo", cambio: { cantidadRecibida: 39, observacion: undefined } },  // diferencia sin observación
  33: { esperado: "rojo", cambio: { cargadoPor: "" } },                                // falta quien cargó
  40: { esperado: "rojo", cambio: { cantidadPedida: -5 } },                            // cantidad imposible
  46: { esperado: "amarillo", cambio: { cantidadRecibida: 38, observacion: "2 cajas dañadas en el flete" } }, // diferencia explicada
};

describe("D5 piloto: 50 remitos con errores sembrados", () => {
  const docs = Array.from({ length: 50 }, (_, i) => ({ ...limpio(i + 1), ...(sembrados[i + 1]?.cambio ?? {}) }));
  it("ningún remito limpio sale en rojo (especificidad)", () => {
    docs.forEach((d, i) => { if (!sembrados[i + 1]) expect(evaluar(d).veredicto, `P-${i + 1}`).not.toBe("rojo"); });
  });
  it("cada error sembrado se detecta con el color esperado (sensibilidad)", () => {
    const fallas: string[] = [];
    Object.entries(sembrados).forEach(([n, s]) => { const v = evaluar(docs[Number(n) - 1]).veredicto; if (v !== s.esperado) fallas.push(`P-${n}: esperado ${s.esperado}, salió ${v}`); });
    expect(fallas).toEqual([]);
  });
  it("el lote sella solo lo que no es rojo", () => {
    const v = previsualizarLote(docs);
    const rojos = Object.values(sembrados).filter((s) => s.esperado === "rojo").length;
    expect(v.afuera).toBe(rojos);
    expect(v.sellan).toBe(50 - rojos);
  });
});
