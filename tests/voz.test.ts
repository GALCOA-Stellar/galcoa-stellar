import { describe, expect, it } from "vitest";
import { desafioDeVoz, evaluarVoz, VENTANA_VOZ_MS } from "../src/lib/dominio/voz";

const d = desafioDeVoz(new Uint8Array([0, 5, 14, 4, 0, 7]));

describe("ALC-VOZ-01: desafío de frase", () => {
  it("la frase sale de los bytes al azar y es reproducible", () => {
    expect(d.palabras).toEqual(["almendra", "faro", "olivo"]);
    expect(d.numero).toBe("407");
  });
  it("acepta la frase dicha con números en palabras, acentos y mayúsculas", () => {
    expect(evaluarVoz("Almendra, FARO, olivo. Cuatro cero siete", d, 0, 60_000).ok).toBe(true);
    expect(evaluarVoz("almendra faro olivo 4 0 7 gracias", d, 0, 1000).ok).toBe(true);
  });
  it("un audio que no dice la frase queda en rojo", () => {
    const r = evaluarVoz("llegaron las cajas de aceite", d, 0, 1000);
    expect(r).toMatchObject({ ok: false, gravedad: "critica", id: "ALC-VOZ-01" });
  });
  it("palabras en otro orden o números equivocados fallan", () => {
    expect(evaluarVoz("olivo faro almendra 407", d, 0, 1000).ok).toBe(false);
    expect(evaluarVoz("almendra faro olivo 408", d, 0, 1000).ok).toBe(false);
  });
  it("un audio que llega fuera de la ventana falla aunque diga la frase", () => {
    expect(evaluarVoz("almendra faro olivo 407", d, 0, VENTANA_VOZ_MS + 1).ok).toBe(false);
    expect(evaluarVoz("almendra faro olivo 407", d, 5000, 1000).ok).toBe(false);
  });
});
