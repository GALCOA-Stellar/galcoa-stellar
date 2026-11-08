import { Keypair } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analizarFoto, analizarVoz, huellaDe, veredictoDe } from "../src/lib/aplicacion/evidencia";
import { desafioDeVoz } from "../src/lib/dominio/voz";
import { emitirDesafioEvidencia, evidenciaRespaldada, hashSep53 } from "../src/lib/stellar/firma";

const bytes = (t: string) => new TextEncoder().encode(t);
const d = desafioDeVoz(new Uint8Array([0, 5, 14, 4, 0, 7]));
const sinIA = { skill: "foto" as const, version: "x", indicios: [] };
const vozLimpia = { skill: "voz" as const, version: "x", indicios: [], inteligibilidad: 0.95 };
const firmada = { cuentaAutorizada: true, firmaValida: true };

describe("analizarFoto", () => {
  it("sin perito (informe null) nunca queda verde: queda declarada", () => {
    const r = analizarFoto({ bytes: bytes("x"), informe: null, fechaEntrega: "2026-11-05", fechaRegistro: "2026-11-05" });
    expect(r.veredicto).not.toBe("verde");
    expect(r.reglas.some((x) => x.id === "ALC-MED-01" && !x.ok)).toBe(true);
  });
  it("la huella es el SHA-256 del archivo y cambia con un solo byte", () => {
    expect(huellaDe(bytes("a"))).toMatch(/^[0-9a-f]{64}$/);
    expect(huellaDe(bytes("a"))).not.toBe(huellaDe(bytes("b")));
  });
  it("foto con marca de IA y el perito que ve cifras tocadas queda en rojo", () => {
    const informe = { skill: "foto" as const, version: "x", indicios: [{ tipo: "foto_edicion", gravedad: "media" as const, detalle: "cantidad retocada", afectaCifras: true }] };
    const r = analizarFoto({ bytes: bytes("trainedAlgorithmicMedia"), informe, fechaEntrega: "2026-11-05", fechaRegistro: "2026-11-05" });
    expect(r.veredicto).toBe("rojo");
  });
  it("el aviso aclara que no prueba autenticidad", () => {
    expect(analizarFoto({ bytes: bytes("x"), informe: sinIA, fechaEntrega: "2026-11-05", fechaRegistro: "2026-11-05" }).aviso).toMatch(/No prueba/);
  });
});

describe("analizarVoz", () => {
  const base = { bytes: bytes("audio"), informe: vozLimpia, transcripcion: "almendra faro olivo 4 0 7", desafio: d, emitidoMs: 0, recibidoMs: 1000 };
  it("frase correcta, voz limpia y firma de cuenta autorizada: verde", () => {
    expect(analizarVoz({ ...base, atribucion: firmada }).veredicto).toBe("verde");
  });
  it("sin firma queda en rojo aunque todo lo demás esté bien", () => {
    expect(analizarVoz({ ...base, atribucion: { cuentaAutorizada: true, firmaValida: false } }).veredicto).toBe("rojo");
  });
  it("frase equivocada o fuera de tiempo: rojo", () => {
    expect(analizarVoz({ ...base, transcripcion: "llegaron las cajas", atribucion: firmada }).veredicto).toBe("rojo");
    expect(analizarVoz({ ...base, recibidoMs: 10 * 60_000, atribucion: firmada }).veredicto).toBe("rojo");
  });
  it("si el perito cayó (informe null) no se da por buena la frase: rojo", () => {
    expect(analizarVoz({ ...base, informe: null, transcripcion: "", atribucion: firmada }).veredicto).toBe("rojo");
  });
});

describe("veredictoDe", () => {
  it("rojo si falla una crítica, amarillo si solo una advertencia, verde si todo pasa", () => {
    const r = (ok: boolean, gravedad: "critica" | "advertencia") => ({ id: "X", atributo: "a", ok, gravedad, detalle: "" });
    expect(veredictoDe([r(true, "critica"), r(false, "critica")])).toBe("rojo");
    expect(veredictoDe([r(true, "critica"), r(false, "advertencia")])).toBe("amarillo");
    expect(veredictoDe([r(true, "critica")])).toBe("verde");
  });
});

describe("firma de respaldo de evidencia", () => {
  const par = Keypair.random();
  const otra = Keypair.random();
  const huella = "ab".repeat(32);
  const entorno = { ...process.env };
  beforeEach(() => { process.env.DESAFIO_SECRETO = "secreto-de-prueba"; process.env.CUENTAS_AUTORIZADAS = par.publicKey(); });
  afterEach(() => { process.env = { ...entorno }; });
  const firmar = (kp: Keypair, mensaje: string) => Buffer.from(kp.sign(hashSep53(mensaje))).toString("base64");

  it("una cuenta autorizada que firma la huella correcta queda como respaldo válido", () => {
    const m = emitirDesafioEvidencia(par.publicKey(), huella);
    const r = evidenciaRespaldada({ cuenta: par.publicKey(), ...m, firma: firmar(par, m.mensaje) }, huella);
    expect(r).toMatchObject({ cuentaAutorizada: true, firmaValida: true });
  });
  it("la firma de otro archivo no sirve", () => {
    const m = emitirDesafioEvidencia(par.publicKey(), huella);
    expect(evidenciaRespaldada({ cuenta: par.publicKey(), ...m, firma: firmar(par, m.mensaje) }, "cd".repeat(32)).firmaValida).toBe(false);
  });
  it("una cuenta que no está en la lista no cuenta, aunque la firma sea válida", () => {
    const m = emitirDesafioEvidencia(otra.publicKey(), huella);
    const r = evidenciaRespaldada({ cuenta: otra.publicKey(), ...m, firma: firmar(otra, m.mensaje) }, huella);
    expect(r.cuentaAutorizada).toBe(false);
  });
  it("un mensaje que no emitió este servidor (marca falsa) se rechaza", () => {
    const m = emitirDesafioEvidencia(par.publicKey(), huella);
    expect(evidenciaRespaldada({ cuenta: par.publicKey(), mensaje: m.mensaje, marca: "0".repeat(64), firma: firmar(par, m.mensaje) }, huella).firmaValida).toBe(false);
  });
  it("el mensaje vencido y la firma rota se rechazan", () => {
    const m = emitirDesafioEvidencia(par.publicKey(), huella, Date.now() - 10 * 60_000);
    expect(evidenciaRespaldada({ cuenta: par.publicKey(), ...m, firma: firmar(par, m.mensaje) }, huella).firmaValida).toBe(false);
    const n = emitirDesafioEvidencia(par.publicKey(), huella);
    expect(evidenciaRespaldada({ cuenta: par.publicKey(), ...n, firma: firmar(otra, n.mensaje) }, huella).firmaValida).toBe(false);
  });
  it("la firma de un respaldo de evidencia no sirve para sellar un lote", async () => {
    const { verificarAcceso } = await import("../src/lib/stellar/firma");
    const m = emitirDesafioEvidencia(par.publicKey(), huella);
    expect(verificarAcceso({ cuenta: par.publicKey(), ...m, firma: firmar(par, m.mensaje) }, huella).ok).toBe(false);
  });
});
