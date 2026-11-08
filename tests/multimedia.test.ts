import { describe, expect, it } from "vitest";
import { evaluarInformeFoto, evaluarInformeVoz, validarInforme } from "../src/lib/dominio/multimedia";

type Ind = { tipo: string; gravedad: "baja" | "media" | "alta"; detalle: string; afectaCifras?: boolean };
const foto = (indicios: Ind[]) => ({ skill: "foto" as const, version: "x", indicios });
const voz = (indicios: Ind[], inteligibilidad?: number) => ({ skill: "voz" as const, version: "x", indicios, inteligibilidad });
const ok = { cuentaAutorizada: true, firmaValida: true };

describe("peritos de foto (ALC-MED-01)", () => {
  it("sin informe del perito: declarado, nunca verificado", () => {
    expect(evaluarInformeFoto(null)[0]).toMatchObject({ ok: false, gravedad: "advertencia" });
  });
  it("sin indicios: ok, y el texto aclara que no prueba autenticidad", () => {
    const [x] = evaluarInformeFoto(foto([]));
    expect(x.ok).toBe(true);
    expect(x.detalle).toMatch(/no es una prueba/);
  });
  it("edición media sin cifras: amarillo; tocando cifras: rojo; generada: rojo", () => {
    expect(evaluarInformeFoto(foto([{ tipo: "foto_edicion", gravedad: "media", detalle: "bordes raros" }]))[0]).toMatchObject({ ok: false, gravedad: "advertencia" });
    expect(evaluarInformeFoto(foto([{ tipo: "foto_edicion", gravedad: "media", detalle: "cantidad retocada", afectaCifras: true }]))[0]).toMatchObject({ ok: false, gravedad: "critica" });
    expect(evaluarInformeFoto(foto([{ tipo: "foto_generada", gravedad: "alta", detalle: "generada" }]))[0].gravedad).toBe("critica");
  });
  it("un indicio de voz no cuenta como indicio de foto", () => {
    expect(evaluarInformeFoto(foto([{ tipo: "voz_robotica", gravedad: "alta", detalle: "x" }]))[0].ok).toBe(true);
  });
});

describe("peritos de voz (ALC-VOZ-02, 03 y 04)", () => {
  it("voz limpia, entendible y firmada por cuenta autorizada: todo ok", () => {
    expect(evaluarInformeVoz(voz([], 0.95), ok).every((x) => x.ok)).toBe(true);
  });
  it("sin firma de cuenta autorizada: rojo aunque la voz suene bien", () => {
    const rs = evaluarInformeVoz(voz([], 0.95), { cuentaAutorizada: true, firmaValida: false });
    expect(rs.find((x) => x.id === "ALC-VOZ-04")).toMatchObject({ ok: false, gravedad: "critica" });
    expect(evaluarInformeVoz(voz([], 0.95), { cuentaAutorizada: false, firmaValida: true }).some((x) => x.id === "ALC-VOZ-04" && !x.ok)).toBe(true);
  });
  it("voz robótica fuerte: rojo; media: amarillo", () => {
    expect(evaluarInformeVoz(voz([{ tipo: "voz_sintetica", gravedad: "alta", detalle: "robótica" }], 0.9), ok).find((x) => x.id === "ALC-VOZ-03")?.gravedad).toBe("critica");
    expect(evaluarInformeVoz(voz([{ tipo: "voz_sintetica", gravedad: "media", detalle: "monótona" }], 0.9), ok).find((x) => x.id === "ALC-VOZ-03")).toMatchObject({ ok: false, gravedad: "advertencia" });
  });
  it("mensaje que no se entiende: rojo; a medias: amarillo; sin medir: amarillo", () => {
    expect(evaluarInformeVoz(voz([], 0.4), ok).find((x) => x.id === "ALC-VOZ-02")?.gravedad).toBe("critica");
    expect(evaluarInformeVoz(voz([], 0.7), ok).find((x) => x.id === "ALC-VOZ-02")).toMatchObject({ ok: false, gravedad: "advertencia" });
    expect(evaluarInformeVoz(voz([]), ok).find((x) => x.id === "ALC-VOZ-02")?.ok).toBe(false);
  });
  it("sin informe del perito: la voz queda declarada", () => {
    expect(evaluarInformeVoz(null, ok).find((x) => x.id === "ALC-VOZ-03")).toMatchObject({ ok: false, gravedad: "advertencia" });
  });
});

describe("validación del informe crudo del modelo", () => {
  it("descarta basura y recorta; no inventa nada", () => {
    expect(validarInforme("hola", "foto")).toBeNull();
    expect(validarInforme({ indicios: "x" }, "foto")).toBeNull();
    const v = validarInforme({ indicios: [{ tipo: "foto_edicion", gravedad: "alta", detalle: " retoque ", afectaCifras: true }, { tipo: "otro", gravedad: "alta", detalle: "x" }, { tipo: "foto_x", gravedad: "enorme", detalle: "x" }], inteligibilidad: 7 }, "foto");
    expect(v?.indicios).toEqual([{ tipo: "foto_edicion", gravedad: "alta", detalle: "retoque", afectaCifras: true }]);
    expect(v?.inteligibilidad).toBeUndefined();
  });
  it("un informe vacío no sube nada: solo da ok informativo", () => {
    expect(validarInforme({ indicios: [] }, "voz")?.indicios).toEqual([]);
  });
});
