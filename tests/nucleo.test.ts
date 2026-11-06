import { afterEach, describe, expect, it, vi } from "vitest";
import { construir, camino, verificarCamino } from "../src/lib/merkle";
import { evaluar } from "../src/lib/rules";
import { cargadoresDelLote, sellarLote, verificarComprobante, memoDelLote, previsualizarLote, armarArchivo, type Comprobante } from "../src/lib/lote";
import { cuentasAutorizadas, emitirDesafio, identidadDe, hashSep53, verificarAcceso, verificarFirmaSep53 } from "../src/lib/firma";
import { memoDeHorizon, verificarPruebaLocal } from "../src/lib/stellar";
import { Account, Asset, Keypair, Memo, Networks, Operation, TransactionBuilder, BASE_FEE } from "@stellar/stellar-sdk";
import { sha256Hex } from "../src/lib/canonical";

const hashes = (n: number) => Array.from({ length: n }, (_, i) => sha256Hex(`doc-${i}`));
const H = "ab".repeat(32);
const base = { unidad: "caja", fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "operador-01", confirmadoPor: "receptor-01", evidenciaHash: H };
const verde = (n: number) => ({ ...base, remito: `R-${n}`, producto: "Aceite", cantidadPedida: 10, cantidadRecibida: 10 });
const rojo = { ...base, remito: "R-X", producto: "Arroz", cantidadPedida: 10, cantidadRecibida: 8 };
const ids = (e: unknown, ok: boolean) => evaluar(e).reglas.filter((r) => r.ok === ok).map((r) => r.id);

describe("árbol de Merkle", () => {
  for (const n of [1, 2, 3, 4, 5, 7, 8]) {
    it(`todos los documentos de un lote de ${n} se verifican`, () => {
      const hs = hashes(n);
      const { niveles, raiz } = construir(hs);
      hs.forEach((h, i) => expect(verificarCamino(h, camino(niveles, i), raiz)).toBe(true));
    });
  }
  it("un documento alterado no verifica", () => {
    const { niveles, raiz } = construir(hashes(5));
    expect(verificarCamino(sha256Hex("otro"), camino(niveles, 2), raiz)).toBe(false);
  });
  it("una raíz alterada no verifica", () => {
    const hs = hashes(4);
    const { niveles } = construir(hs);
    expect(verificarCamino(hs[0], camino(niveles, 0), sha256Hex("raiz falsa"))).toBe(false);
  });
});

describe("reglas por atributo ALCOA+", () => {
  it("documento completo, atribuible, a tiempo, con original y exacto es verde", () => expect(evaluar(verde(1)).veredicto).toBe("verde"));
  it("Atribuible: quien carga no puede confirmar (cuatro ojos) → rojo", () => {
    const e = evaluar({ ...verde(1), confirmadoPor: "operador-01" });
    expect(e.veredicto).toBe("rojo");
    expect(ids(e.documento, false)).toBeDefined();
    expect(e.reglas.find((r) => r.id === "ALC-ATR-01")?.ok).toBe(false);
  });
  it("Completo: faltan campos → rojo", () => expect(evaluar({ remito: "a" }).reglas[0]).toMatchObject({ id: "ALC-COM-01", ok: false }));
  it("Legible: fecha imaginaria, cantidades no enteras o negativas → rojo", () => {
    expect(evaluar({ ...verde(1), fechaEntrega: "2026-02-31" }).veredicto).toBe("rojo");
    expect(evaluar({ ...verde(1), cantidadRecibida: 1.5 }).veredicto).toBe("rojo");
    expect(evaluar({ ...verde(1), cantidadRecibida: -1 }).veredicto).toBe("rojo");
    expect(evaluar({ ...verde(1), evidenciaHash: "xyz" }).veredicto).toBe("rojo");
    expect(evaluar({ ...verde(1), cargadoPor: "Juan Pérez" }).veredicto).toBe("rojo");
  });
  it("Consistente: registro anterior a la entrega → rojo", () =>
    expect(evaluar({ ...verde(1), fechaRegistro: "2026-11-01" }).veredicto).toBe("rojo"));
  it("Contemporáneo: carga tardía → amarillo", () => {
    const e = evaluar({ ...verde(1), fechaRegistro: "2026-11-08" });
    expect(e.veredicto).toBe("amarillo");
    expect(e.reglas.find((r) => r.id === "ALC-CTE-01")?.ok).toBe(false);
  });
  it("Original: sin huella del original → amarillo", () => expect(evaluar({ ...verde(1), evidenciaHash: undefined }).veredicto).toBe("amarillo"));
  it("Exacto: diferencia con observación → amarillo; sin observación → rojo", () => {
    expect(evaluar({ ...rojo, observacion: "dañadas" }).veredicto).toBe("amarillo");
    expect(evaluar(rojo).veredicto).toBe("rojo");
  });
  it("basura es rojo", () => {
    for (const x of [null, "hola", 5, [], {}]) expect(evaluar(x).veredicto).toBe("rojo");
  });
  it("es determinista: misma entrada, mismo resultado", () => expect(evaluar(rojo)).toEqual(evaluar(rojo)));
});

describe("sellado por lotes", () => {
  it("un lote con solo rojos NUNCA llama a la red", async () => {
    const enviar = vi.fn();
    const r = await sellarLote([rojo, null, { x: 1 }], enviar);
    expect(enviar).not.toHaveBeenCalled();
    expect(r.sellado).toBeNull();
  });
  it("el rojo queda afuera del lote y los demás entran en una sola transacción", async () => {
    const enviar = vi.fn().mockResolvedValue({ txHash: "a".repeat(64), ledger: 1 });
    const r = await sellarLote([verde(1), rojo, verde(2), { ...rojo, observacion: "dañadas" }], enviar);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(r.sellado?.cantidadHojas).toBe(3);
    expect(r.resultados.map((x) => x.enLote)).toEqual([true, false, true, true]);
    expect(enviar).toHaveBeenCalledWith(memoDelLote(r.sellado!.raiz, 3));
    r.comprobantes.forEach((c) => expect(verificarComprobante(c).coherente).toBe(true));
  });
  it("un comprobante con el contenido alterado se detecta", async () => {
    const enviar = vi.fn().mockResolvedValue({ txHash: "b".repeat(64), ledger: 2 });
    const r = await sellarLote([verde(1), verde(2)], enviar);
    const c: Comprobante = JSON.parse(JSON.stringify(r.comprobantes[0]));
    (c.manifiesto.documento as { cantidadRecibida: number }).cantidadRecibida = 999;
    expect(verificarComprobante(c).coherente).toBe(false);
  });
  it("rechaza lotes vacíos y demasiado grandes", async () => {
    const enviar = vi.fn();
    await expect(sellarLote([], enviar)).rejects.toThrow();
    await expect(sellarLote(Array.from({ length: 51 }, (_, i) => verde(i)), enviar)).rejects.toThrow();
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe("lectura de la red (respaldo Horizon)", () => {
  const memoB64 = Buffer.from("ab".repeat(32), "hex").toString("base64");
  it("interpreta una transacción exitosa con memo de tipo hash", () => {
    expect(memoDeHorizon({ successful: true, memo_type: "hash", memo: memoB64, ledger: 7 })).toEqual({ memoHex: "ab".repeat(32), ledger: 7 });
  });
  it("rechaza fallidas, otros tipos de memo y basura", () => {
    expect(memoDeHorizon({ successful: false, memo_type: "hash", memo: memoB64, ledger: 7 })).toBeNull();
    expect(memoDeHorizon({ successful: true, memo_type: "text", memo: "hola", ledger: 7 })).toBeNull();
    expect(memoDeHorizon({ successful: true, memo_type: "hash", memo: "corto", ledger: 7 })).toBeNull();
    expect(memoDeHorizon(null)).toBeNull();
    expect(memoDeHorizon("x")).toBeNull();
  });
});

describe("acceso por firma de cuenta (SEP-53)", () => {
  const kp = Keypair.random();
  const otra = Keypair.random();
  const memo = "cd".repeat(32);
  const firmar = (k: Keypair, mensaje: string) => Buffer.from(k.sign(hashSep53(mensaje))).toString("base64");
  const preparar = (cuentas: string | undefined) => { vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("DESAFIO_SECRETO", "secreto-de-prueba"); vi.stubEnv("CUENTAS_AUTORIZADAS", cuentas ?? ""); };
  afterEach(() => vi.unstubAllEnvs());

  it("la firma sigue el formato SEP-53 (prefijo + SHA-256) y detecta cambios", () => {
    const m = "hola";
    const f = firmar(kp, m);
    expect(verificarFirmaSep53(kp.publicKey(), m, f)).toBe(true);
    expect(verificarFirmaSep53(kp.publicKey(), "hola!", f)).toBe(false);
    expect(verificarFirmaSep53(otra.publicKey(), m, f)).toBe(false);
    expect(verificarFirmaSep53(kp.publicKey(), m, "no-es-base64-valido")).toBe(false);
  });
  it("una cuenta autorizada con firma válida pasa", () => {
    preparar(kp.publicKey());
    const d = emitirDesafio(kp.publicKey(), memo);
    expect(verificarAcceso({ cuenta: kp.publicKey(), ...d, firma: firmar(kp, d.mensaje) }, memo)).toEqual({ ok: true, cuenta: kp.publicKey() });
  });
  it("en producción sin lista de cuentas nadie puede sellar", () => {
    preparar(undefined);
    const d = emitirDesafio(kp.publicKey(), memo);
    expect(verificarAcceso({ cuenta: kp.publicKey(), ...d, firma: firmar(kp, d.mensaje) }, memo).ok).toBe(false);
  });
  it("una cuenta que no está en la lista no pasa, aunque firme bien", () => {
    preparar(kp.publicKey());
    const d = emitirDesafio(otra.publicKey(), memo);
    expect(verificarAcceso({ cuenta: otra.publicKey(), ...d, firma: firmar(otra, d.mensaje) }, memo).ok).toBe(false);
  });
  it("la firma de un lote no sirve para otro lote", () => {
    preparar(kp.publicKey());
    const d = emitirDesafio(kp.publicKey(), memo);
    expect(verificarAcceso({ cuenta: kp.publicKey(), ...d, firma: firmar(kp, d.mensaje) }, "ef".repeat(32)).ok).toBe(false);
  });
  it("un mensaje inventado (sin marca del servidor) no pasa", () => {
    preparar(kp.publicKey());
    const d = emitirDesafio(kp.publicKey(), memo);
    const falso = d.mensaje.replace(memo, "ef".repeat(32));
    expect(verificarAcceso({ cuenta: kp.publicKey(), mensaje: falso, marca: d.marca, firma: firmar(kp, falso) }, "ef".repeat(32)).ok).toBe(false);
  });
  it("una firma de otra cuenta sobre el mensaje no pasa", () => {
    preparar(kp.publicKey());
    const d = emitirDesafio(kp.publicKey(), memo);
    expect(verificarAcceso({ cuenta: kp.publicKey(), ...d, firma: firmar(otra, d.mensaje) }, memo).ok).toBe(false);
  });
  it("el mensaje vence y no se puede reutilizar", () => {
    preparar(kp.publicKey());
    const d = emitirDesafio(kp.publicKey(), memo, 1_000_000);
    const acceso = { cuenta: kp.publicKey(), ...d, firma: firmar(kp, d.mensaje) };
    expect(verificarAcceso(acceso, memo, 1_000_000 + 6 * 60_000).ok).toBe(false);
    expect(verificarAcceso(acceso, memo, 1_000_000 + 1_000).ok).toBe(true);
    expect(verificarAcceso(acceso, memo, 1_000_000 + 2_000).ok).toBe(false);
  });
  it("sin firma o sin nada para sellar no pasa", () => {
    preparar(kp.publicKey());
    expect(verificarAcceso(undefined, memo).ok).toBe(false);
    const d = emitirDesafio(kp.publicKey(), memo);
    expect(verificarAcceso({ cuenta: kp.publicKey(), ...d, firma: firmar(kp, d.mensaje) }, null).ok).toBe(false);
  });
});

describe("qué se sella (vista previa sin red)", () => {
  it("anticipa exactamente la raíz y el memo que después se sellan, sin llamar a la red", async () => {
    const lote = [verde(1), rojo, verde(2), { ...rojo, observacion: "dañadas" }];
    const vista = previsualizarLote(lote);
    expect(vista.sellan).toBe(3);
    expect(vista.afuera).toBe(1);
    expect(vista.documentos.map((d) => d.enLote)).toEqual([true, false, true, true]);
    expect(vista.documentos[1].avisos.length).toBeGreaterThan(0);
    const enviar = vi.fn().mockResolvedValue({ txHash: "c".repeat(64), ledger: 3 });
    const r = await sellarLote(lote, enviar);
    expect(r.sellado?.raiz).toBe(vista.raiz);
    expect(r.sellado?.memo).toBe(vista.memo);
  });
  it("si todo es rojo no hay raíz ni memo", () => {
    const vista = previsualizarLote([rojo, null]);
    expect(vista.sellan).toBe(0);
    expect(vista.raiz).toBeNull();
    expect(vista.memo).toBeNull();
  });
  it("rechaza lotes vacíos o demasiado grandes", () => {
    expect(() => previsualizarLote([])).toThrow();
    expect(() => previsualizarLote(Array.from({ length: 51 }, (_, i) => verde(i)))).toThrow();
  });
});

describe("archivo del lote y prueba guardada", () => {
  const armarTx = (memoHex: string) => {
    const kp = Keypair.random();
    const tx = new TransactionBuilder(new Account(kp.publicKey(), "1"), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({ destination: kp.publicKey(), asset: Asset.native(), amount: "0.0000001" }))
      .addMemo(Memo.hash(memoHex))
      .setTimeout(60)
      .build();
    tx.sign(kp);
    return { envelopeXdr: tx.toXDR(), txHash: Buffer.from(tx.hash()).toString("hex") };
  };
  const sellarConPrueba = async () => {
    const lote = [verde(1), verde(2)];
    const vista = previsualizarLote(lote);
    const { envelopeXdr, txHash } = armarTx(vista.memo as string);
    const enviar = vi.fn().mockResolvedValue({ txHash, ledger: 9, prueba: { ledger: 9, cierreLedger: "2026-11-05T12:00:00.000Z", envelopeXdr, resultXdr: null } });
    return sellarLote(lote, enviar);
  };
  it("el comprobante lleva la prueba y se verifica sin red", async () => {
    const r = await sellarConPrueba();
    const c = r.comprobantes[0];
    expect(c.prueba?.cierreLedger).toBe("2026-11-05T12:00:00.000Z");
    expect(verificarComprobante(c).coherente).toBe(true);
    expect(verificarPruebaLocal(c, verificarComprobante(c).memoEsperado).ok).toBe(true);
  });
  it("una prueba con otro memo o con otro hash de transacción se rechaza", async () => {
    const r = await sellarConPrueba();
    const c: Comprobante = JSON.parse(JSON.stringify(r.comprobantes[0]));
    const esperado = verificarComprobante(c).memoEsperado;
    expect(verificarPruebaLocal({ ...c, txHash: "d".repeat(64) }, esperado).ok).toBe(false);
    expect(verificarPruebaLocal(c, sha256Hex("otro memo")).ok).toBe(false);
    expect(verificarPruebaLocal({ ...c, prueba: undefined }, esperado).ok).toBe(false);
  });
  it("el archivo del lote junta el sellado con todos los comprobantes", async () => {
    const r = await sellarConPrueba();
    const a = armarArchivo(r.sellado!, r.comprobantes);
    expect(a.schemaVersion).toBe("galcoa.stellar.archivo.v1");
    expect(a.comprobantes).toHaveLength(2);
    expect(a.sellado.cierreLedger).toBe("2026-11-05T12:00:00.000Z");
  });
});

describe("RF-02 cuatro ojos completo: quien aprueba no pudo haber cargado", () => {
  const doc = (cargadoPor: string) => ({ remito: "R-1", producto: "Yerba", unidad: "caja", cantidadPedida: 10, cantidadRecibida: 10, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor, confirmadoPor: "receptor-01" });
  afterEach(() => vi.unstubAllEnvs());

  it("lista quién cargó los documentos que entran al lote (los rojos no cuentan)", () => {
    expect(cargadoresDelLote([doc("operador-01"), doc("operador-02"), { remito: "X" }]).sort()).toEqual(["operador-01", "operador-02"]);
  });
  it("la identidad de una cuenta sale de CUENTAS_AUTORIZADAS (G...=id) o es la cuenta misma", () => {
    const g = Keypair.random().publicKey();
    vi.stubEnv("CUENTAS_AUTORIZADAS", g + "=aprobador-01");
    expect(identidadDe(g)).toBe("aprobador-01");
    vi.stubEnv("CUENTAS_AUTORIZADAS", g);
    expect(identidadDe(g)).toBe(g);
  });
  it("la lista de cuentas ignora el sufijo de identidad", () => {
    const g = Keypair.random().publicKey();
    vi.stubEnv("CUENTAS_AUTORIZADAS", g + "=aprobador-01");
    expect(cuentasAutorizadas()).toEqual([g]);
  });
});

describe("RF-26 stellar.toml (SEP-1)", () => {
  it("publica solo cuentas válidas, sin repetir, y nunca una clave secreta", async () => {
    const { armarStellarToml } = await import("../src/lib/toml");
    const kp = Keypair.random();
    const t = armarStellarToml([kp.publicKey(), kp.publicKey(), "no-es-cuenta", kp.secret()]);
    expect(t).toContain(`ACCOUNTS=["${kp.publicKey()}"]`);
    expect(t).toContain('NETWORK_PASSPHRASE="Test SDF Network ; September 2015"');
    expect(t).not.toContain(kp.secret());
  });
  it("deriva la cuenta pública del sellador desde la clave secreta", async () => {
    const { cuentaSelladora } = await import("../src/lib/toml");
    const kp = Keypair.random();
    vi.stubEnv("SELLADOR_STELLAR_SECRETO", kp.secret());
    expect(cuentaSelladora()).toBe(kp.publicKey());
    vi.stubEnv("SELLADOR_STELLAR_SECRETO", "basura");
    expect(cuentaSelladora()).toBeNull();
    vi.unstubAllEnvs();
  });
});

describe("D1 sello 2 de 2: la transacción se revisa antes de enviarla", () => {
  const sel = Keypair.random().publicKey();
  const [a, b, c] = [Keypair.random(), Keypair.random(), Keypair.random()];
  const memo = sha256Hex("lote-2de2");
  const ids: Record<string, string> = { [a.publicKey()]: "cargador-01", [b.publicKey()]: "aprobador-01", [c.publicKey()]: "cargador-01" };
  const entrada = (extra: object = {}) => ({
    cuentaSelladora: sel, memoEsperado: memo, autorizadas: [a, b, c].map((k) => k.publicKey()),
    identidadDe: (x: string) => ids[x] ?? x, cargadores: ["cargador-01"], ...extra,
  });
  const firmada = (...ks: Keypair[]) => {
    const tx = TransactionBuilder.fromXDR(armarTxSello(sel, "100", memo), Networks.TESTNET);
    ks.forEach((k) => tx.sign(k));
    return tx.toXDR();
  };
  let armarTxSello: (c: string, s: string, m: string) => string;
  let evaluarSello: typeof import("../src/lib/multifirma").evaluarSello;
  it("carga", async () => { ({ armarTxSello, evaluarSello } = await import("../src/lib/multifirma")); });

  it("con las firmas de dos personas distintas (una no cargó) se acepta", () => {
    const r = evaluarSello(firmada(a, b), entrada());
    expect(r.ok).toBe(true);
  });
  it("con una sola firma se rechaza", () => {
    const r = evaluarSello(firmada(a), entrada());
    expect(r.ok).toBe(false);
  });
  it("sin firmas se rechaza", () => expect(evaluarSello(firmada(), entrada()).ok).toBe(false));
  it("dos cuentas de la misma persona cuentan como una sola", () => {
    const r = evaluarSello(firmada(a, c), entrada());
    expect(r.ok).toBe(false);
  });
  it("si todas las firmas son de quienes cargaron, falla cuatro ojos", () => {
    const r = evaluarSello(firmada(a, b), entrada({ cargadores: ["cargador-01", "aprobador-01"] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("Cuatro ojos");
  });
  it("una firma de una cuenta no autorizada no suma", () => {
    expect(evaluarSello(firmada(a, Keypair.random()), entrada()).ok).toBe(false);
  });
  it("un memo de otro lote se rechaza aunque tenga las dos firmas", () => {
    expect(evaluarSello(firmada(a, b), entrada({ memoEsperado: sha256Hex("otro") })).ok).toBe(false);
  });
  it("una transacción de otra cuenta se rechaza", () => {
    expect(evaluarSello(firmada(a, b), entrada({ cuentaSelladora: Keypair.random().publicKey() })).ok).toBe(false);
  });
  it("una transacción vencida se rechaza", () => {
    expect(evaluarSello(firmada(a, b), entrada({ ahora: Date.now() + 3_600_000 })).ok).toBe(false);
  });
  it("una transacción que hace otra cosa (pago a un tercero) se rechaza", () => {
    const tx = new TransactionBuilder(new Account(sel, "100"), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({ destination: Keypair.random().publicKey(), asset: Asset.native(), amount: "0.0000001" }))
      .addMemo(Memo.hash(memo)).setTimeout(600).build();
    tx.sign(a); tx.sign(b);
    expect(evaluarSello(tx.toXDR(), entrada()).ok).toBe(false);
  });
  it("basura no rompe nada", () => {
    expect(evaluarSello("no-es-xdr", entrada()).ok).toBe(false);
    expect(evaluarSello(undefined, entrada()).ok).toBe(false);
  });
});

describe("D2 sesión por firma de cuenta", () => {
  it("firmando el mensaje se obtiene un pase con la identidad; sin firma válida no", async () => {
    const { emitirDesafioSesion, abrirSesion, leerSesion, hashSep53 } = await import("../src/lib/firma");
    const kp = Keypair.random();
    vi.stubEnv("CUENTAS_AUTORIZADAS", kp.publicKey() + "=aprobador-01");
    vi.stubEnv("DESAFIO_SECRETO", "x".repeat(32));
    const d = emitirDesafioSesion(kp.publicKey());
    const firma = Buffer.from(kp.sign(hashSep53(d.mensaje))).toString("base64");
    const r = abrirSesion({ cuenta: kp.publicKey(), ...d, firma });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(leerSesion(r.pase)?.identidad).toBe("aprobador-01");
      expect(leerSesion(r.pase + "x")).toBeNull();
      expect(leerSesion(r.pase, Date.now() + 9 * 3_600_000)).toBeNull();
    }
    expect(abrirSesion({ cuenta: kp.publicKey(), ...d, firma: Buffer.alloc(64).toString("base64") }).ok).toBe(false);
    const otra = Keypair.random();
    expect(abrirSesion({ cuenta: otra.publicKey(), ...d, firma }).ok).toBe(false);
    vi.unstubAllEnvs();
  });
  it("un mensaje de sellar no sirve para iniciar sesión", async () => {
    const { emitirDesafio, abrirSesion, hashSep53 } = await import("../src/lib/firma");
    const kp = Keypair.random();
    vi.stubEnv("CUENTAS_AUTORIZADAS", kp.publicKey());
    vi.stubEnv("DESAFIO_SECRETO", "x".repeat(32));
    const d = emitirDesafio(kp.publicKey(), "ab".repeat(32));
    const firma = Buffer.from(kp.sign(hashSep53(d.mensaje))).toString("base64");
    expect(abrirSesion({ cuenta: kp.publicKey(), ...d, firma }).ok).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("D3 paquete galcoa-comprobante: mismos resultados que la app", () => {
  it("memo, raíz y comprobantes coinciden; y la app verifica lo que arma el paquete", async () => {
    // @ts-expect-error paquete JS sin tipos
    const pkg = await import("../packages/galcoa-comprobante/index.js");
    const manifiestos = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ documento: { remito: `R-${n}`, producto: "Yerba", unidad: "caja", cantidadPedida: n, cantidadRecibida: n, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-03", cargadoPor: "op-01", confirmadoPor: "sup-02" }, reglasVersion: "x", reglasIds: ["A"], veredicto: "verde" as const }));
    const { memo, raiz, comprobantes } = pkg.armarLote(manifiestos);
    const { niveles, raiz: raizApp } = construir(manifiestos.map((m) => pkg.huellaDe(m)));
    expect(raiz).toBe(raizApp);
    expect(memo).toBe(memoDelLote(raizApp, manifiestos.length));
    comprobantes.forEach((c: Comprobante, i: number) => {
      expect(c.camino).toEqual(camino(niveles, i));
      expect(verificarComprobante(c).coherente).toBe(true);
    });
  });
});

describe("planilla CSV a documentos", () => {
  it("convierte títulos, números, comillas y celdas vacías", async () => {
    const { csvADocumentos } = await import("../src/lib/csv");
    const d = csvADocumentos('remito,producto,cantidadPedida,cantidadRecibida,observacion\nR-1,"Aceite, 900 ml",10,"9,5",\nR-2,Yerba,5,5,ok\n');
    expect(d).toEqual([
      { remito: "R-1", producto: "Aceite, 900 ml", cantidadPedida: 10, cantidadRecibida: 9.5 },
      { remito: "R-2", producto: "Yerba", cantidadPedida: 5, cantidadRecibida: 5, observacion: "ok" },
    ]);
  });
  it("acepta punto y coma (Excel en español) y rechaza planillas sin remitos o con títulos repetidos", async () => {
    const { csvADocumentos } = await import("../src/lib/csv");
    expect(csvADocumentos("remito;cantidadPedida\r\nR-1;3\r\n")).toEqual([{ remito: "R-1", cantidadPedida: 3 }]);
    expect(() => csvADocumentos("remito,producto")).toThrow();
    expect(() => csvADocumentos("a,a\n1,2")).toThrow();
  });
});

describe("tope de comisión", () => {
  it("sin estadística o con basura usa la base", async () => {
    const { elegirComision } = await import("../src/lib/comision");
    expect(elegirComision(undefined, 10_000)).toBe(100);
    expect(elegirComision({ fee_charged: { p70: "x" } }, 10_000)).toBe(100);
  });
  it("pide algo más que el percentil 70 y nunca pasa el tope", async () => {
    const { elegirComision, subirComision, topeDeComision } = await import("../src/lib/comision");
    expect(elegirComision({ fee_charged: { p70: "1000" } }, 10_000)).toBe(1200);
    expect(elegirComision({ fee_charged: { p70: "900000" } }, 10_000)).toBe(10_000);
    expect(subirComision(6000, 10_000)).toBe(10_000);
    expect(subirComision(100, 10_000)).toBe(200);
    expect(topeDeComision("50")).toBe(10_000); // inválido: por debajo de la base
    expect(topeDeComision("2500")).toBe(2500);
  });
});

describe("guardas: pedidos de otro origen", () => {
  const pedido = (h: Record<string, string>) => new Request("http://localhost:4180/api/x", { method: "POST", headers: { "content-type": "application/json", host: "localhost:4180", ...h }, body: "{}" });
  it("acepta el mismo origen y pedidos sin Origin", async () => {
    const { leerJson } = await import("../src/lib/guardas");
    await expect(leerJson(pedido({ origin: "http://localhost:4180" }))).resolves.toEqual({});
    await expect(leerJson(pedido({}))).resolves.toEqual({});
  });
  it("rechaza otro origen o cross-site", async () => {
    const { leerJson } = await import("../src/lib/guardas");
    await expect(leerJson(pedido({ origin: "https://malo.example" }))).rejects.toThrow("otro sitio");
    await expect(leerJson(pedido({ "sec-fetch-site": "cross-site" }))).rejects.toThrow("otro sitio");
  });
});
