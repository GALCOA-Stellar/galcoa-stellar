import { Keypair, type Operation } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { armarConfiguracion, armarRotacion, leer, revisarConfiguracion, UMBRALES } from "../src/lib/stellar/rotacion";

const g = () => Keypair.random().publicKey();
const servicio = g();
const [r1, r2] = [g(), g()];
type Opciones = Operation.SetOptions;

describe("cuenta del servicio con respaldo (#55)", () => {
  it("la configuración suma dos respaldos y deja operar con una firma pero rotar con dos", () => {
    const tx = leer(armarConfiguracion(servicio, "1", [r1, r2]));
    expect(tx.source).toBe(servicio);
    expect(tx.signatures).toHaveLength(0); // se arma sin firmar: acá no hay claves
    const ops = tx.operations as Opciones[];
    expect(ops.map((o) => (o.signer as { ed25519PublicKey?: string } | undefined)?.ed25519PublicKey).filter(Boolean)).toEqual([r1, r2]);
    const umbrales = ops[2];
    expect({ masterWeight: umbrales.masterWeight, lowThreshold: umbrales.lowThreshold, medThreshold: umbrales.medThreshold, highThreshold: umbrales.highThreshold }).toEqual(UMBRALES);
  });

  it("rechaza respaldos repetidos, inválidos o que no sean dos", () => {
    expect(() => armarConfiguracion(servicio, "1", [r1, r1])).toThrow(/distintos/);
    expect(() => armarConfiguracion(servicio, "1", [servicio, r1])).toThrow(/distintos/);
    expect(() => armarConfiguracion(servicio, "1", [r1])).toThrow(/dos/);
    expect(() => armarConfiguracion(servicio, "1", [r1, "GNOVALE"])).toThrow(/válida/);
  });

  it("rotar un respaldo: entra el nuevo y sale el viejo en la misma transacción", () => {
    const nuevo = g();
    const ops = leer(armarRotacion(servicio, "1", r1, nuevo)).operations as Opciones[];
    expect(ops).toHaveLength(2);
    expect(ops[0].signer).toMatchObject({ ed25519PublicKey: nuevo, weight: 1 });
    expect(ops[1].signer).toMatchObject({ ed25519PublicKey: r1, weight: 0 });
  });

  it("rotar la clave original de la cuenta le pone peso 0 (no se puede borrar)", () => {
    const nuevo = g();
    const ops = leer(armarRotacion(servicio, "1", servicio, nuevo)).operations as Opciones[];
    expect(ops[1].masterWeight).toBe(0);
    expect(() => armarRotacion(servicio, "1", r1, servicio)).toThrow(/original/);
    expect(() => armarRotacion(servicio, "1", r1, r1)).toThrow(/distinta/);
  });

  const firmante = (key: string, weight = 1) => ({ key, weight, type: "ed25519_public_key" });
  it("revisa la configuración: la buena no tiene problemas", () => {
    expect(revisarConfiguracion({ thresholds: { low_threshold: 1, med_threshold: 1, high_threshold: 2 }, signers: [firmante(r1), firmante(r2), firmante(servicio)] })).toEqual([]);
  });

  it("revisa la configuración: hoy (una sola clave) es un punto único de falla", () => {
    const p = revisarConfiguracion({ thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 }, signers: [firmante(servicio)] });
    expect(p.join(" ")).toMatch(/1 firmante/);
    expect(p.join(" ")).toMatch(/una sola clave alcanza/i);
  });

  it("avisa si la configuración frenaría los sellos automáticos", () => {
    const p = revisarConfiguracion({ thresholds: { low_threshold: 2, med_threshold: 2, high_threshold: 2 }, signers: [firmante(r1), firmante(r2), firmante(servicio)] });
    expect(p.join(" ")).toMatch(/no puede registrar solo/);
  });
});
