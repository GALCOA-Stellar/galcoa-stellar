import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aEntrada, evaluarFormulario } from "../extension/src/estado-campos";

const HUELLA = "a".repeat(64);
const bueno = {
  remito: "R-1", producto: "Caja", unidad: "caja", cantidadPedida: "10", cantidadRecibida: "10",
  fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-03", cargadoPor: "persona-1", confirmadoPor: "persona-2",
  evidenciaHash: HUELLA, observacion: "",
};

describe("extensión (esqueleto): estado de cada campo según el motor de reglas", () => {
  it("un formulario correcto queda todo en verde", () => {
    const { evaluacion, campos } = evaluarFormulario(bueno);
    expect(evaluacion.veredicto).toBe("verde");
    expect(Object.values(campos).every((c) => c.estado === "verde")).toBe(true);
  });

  it("si quien carga y quien confirma son la misma persona, esos dos campos quedan en rojo", () => {
    const { evaluacion, campos } = evaluarFormulario({ ...bueno, confirmadoPor: "persona-1" });
    expect(evaluacion.veredicto).toBe("rojo");
    expect(campos.cargadoPor.estado).toBe("rojo");
    expect(campos.confirmadoPor.estado).toBe("rojo");
    expect(campos.remito.estado).toBe("verde");
  });

  it("una diferencia de cantidad sin observación es roja; con observación pasa a amarilla", () => {
    const sin = evaluarFormulario({ ...bueno, cantidadRecibida: "8" });
    expect(sin.campos.cantidadRecibida.estado).toBe("rojo");
    const con = evaluarFormulario({ ...bueno, cantidadRecibida: "8", observacion: "faltaron dos cajas" });
    expect(con.campos.cantidadRecibida.estado).toBe("amarillo");
    expect(con.evaluacion.veredicto).toBe("amarillo");
  });

  it("sin huella del original el campo queda amarillo (declarado), no verde", () => {
    const { campos, evaluacion } = evaluarFormulario({ ...bueno, evidenciaHash: "" });
    expect(campos.evidenciaHash.estado).toBe("amarillo");
    expect(evaluacion.veredicto).toBe("amarillo");
  });

  it("un dato obligatorio vacío se marca en rojo en ese campo", () => {
    const { campos, evaluacion } = evaluarFormulario({ ...bueno, remito: "  " });
    expect(evaluacion.veredicto).toBe("rojo");
    expect(campos.remito.estado).toBe("rojo");
    expect(campos.remito.motivos[0]).toContain("ALC-COM-01");
  });

  it("una fecha mal escrita pone el formulario en rojo y el motivo cita la regla", () => {
    const { evaluacion, campos } = evaluarFormulario({ ...bueno, fechaEntrega: "02/11/2026" });
    expect(evaluacion.veredicto).toBe("rojo");
    expect(campos.fechaEntrega.motivos.join(" ")).toContain("ALC-LEG-01");
  });

  it("solo devuelve estado para los campos que existen en la página", () => {
    const { campos } = evaluarFormulario({ remito: "R-1", producto: "Caja", unidad: "caja" });
    expect(Object.keys(campos).sort()).toEqual(["producto", "remito", "unidad"]);
  });

  it("las cantidades se convierten a número y lo demás queda como texto", () => {
    expect(aEntrada({ cantidadPedida: " 12 ", remito: " R-1 ", observacion: "" })).toEqual({ cantidadPedida: 12, remito: "R-1" });
  });
});

describe("extensión (esqueleto): lo que declara y lo que no puede hacer", () => {
  const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));

  it("es Manifest V3, sin permisos ni acceso a sitios más allá de localhost", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toBeUndefined();
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toHaveLength(1);
    for (const m of manifest.content_scripts[0].matches as string[]) expect(m).toMatch(/^http:\/\/(localhost|127\.0\.0\.1)\//);
  });

  it("se presenta como esqueleto en construcción, no como producto terminado", () => {
    expect(`${manifest.name} ${manifest.description}`).toMatch(/construcci/i);
  });

  it("el código de la extensión no hace pedidos de red", () => {
    for (const f of ["../extension/src/contenido.ts", "../extension/src/estado-campos.ts"]) {
      const src = readFileSync(new URL(f, import.meta.url), "utf8");
      expect(src).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
    }
  });
});
