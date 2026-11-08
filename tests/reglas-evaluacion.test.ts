import { describe, expect, it } from "vitest";
import { medir } from "../evals/reglas/medir";
import { CASOS } from "../evals/reglas/casos";
// @ts-expect-error módulo JavaScript sin tipos
import { revisar } from "../evals/reglas/huella.mjs";

describe("examen de las reglas (errores sembrados)", () => {
  it("tiene casos de los dos conjuntos y de los tres veredictos", () => {
    expect(new Set(CASOS.map((c) => c.conjunto))).toEqual(new Set(["ajuste", "reserva"]));
    expect(new Set(CASOS.map((c) => c.esperado))).toEqual(new Set(["verde", "amarillo", "rojo"]));
    expect(CASOS.filter((c) => c.conjunto === "reserva").length).toBeGreaterThanOrEqual(10);
  });

  it("no hay falsas alarmas ni errores que se escapen, ni en el ajuste ni en la reserva", () => {
    for (const conjunto of ["ajuste", "reserva"] as const) {
      const m = medir(conjunto);
      console.log(`[${conjunto}] casos ${m.total} · sensibilidad ${(m.sensibilidad * 100).toFixed(0)} % · especificidad ${(m.especificidad * 100).toFixed(0)} %`);
      expect(m.fallos, JSON.stringify(m.fallos, null, 1)).toEqual([]);
      expect(m.sensibilidad).toBe(1);
      expect(m.especificidad).toBe(1);
    }
  });

  it("la huella del examen está aprobada: si cambiaron las reglas o los casos, hay que re-aprobar con un motivo", () => {
    const r = revisar();
    const ayuda = `Cambió ${r.cambiaron?.join(", ")}. Revisá que el cambio sea intencional y aprobalo con:\n  npm run aprobar-reglas -- --por="tu nombre" --motivo="por qué cambió"`;
    expect(r.estado, ayuda).toBe("aprobada");
  });
});
