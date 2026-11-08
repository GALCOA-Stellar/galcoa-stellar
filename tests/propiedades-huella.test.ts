import { describe, expect, it } from "vitest";
import { canonical, sha256Hex } from "../src/lib/dominio/canonical";
import { camino, construir, verificarCamino } from "../src/lib/dominio/merkle";

/**
 * Pruebas de propiedades de la huella: muchos casos al azar con semilla fija (se repiten igual en cada corrida).
 * Los contratos no calculan la huella (solo la guardan), así que lo que hay que blindar es este cálculo en TypeScript.
 */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
const entero = (r: () => number, max: number) => Math.floor(r() * max);
const hex = (r: () => number) => Array.from({ length: 64 }, () => "0123456789abcdef"[entero(r, 16)]).join("");

function objetoAlAzar(r: () => number, prof = 0): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  const n = 1 + entero(r, 6);
  for (let i = 0; i < n; i++) {
    const k = `k${entero(r, 1000)}`;
    const t = entero(r, prof < 2 ? 5 : 4);
    o[k] = t === 0 ? entero(r, 1e6) : t === 1 ? `texto ${entero(r, 1e6)} ñ "q"` : t === 2 ? r() < 0.5 : t === 3 ? null : objetoAlAzar(r, prof + 1);
  }
  return o;
}
function barajar<T>(r: () => number, o: Record<string, T>): Record<string, T> {
  const claves = Object.keys(o).sort(() => r() - 0.5);
  return Object.fromEntries(claves.map((k) => [k, typeof o[k] === "object" && o[k] !== null && !Array.isArray(o[k]) ? barajar(r, o[k] as Record<string, never>) : o[k]])) as Record<string, T>;
}

describe("canonización: propiedades", () => {
  it("el orden de las claves no cambia el resultado (300 objetos al azar)", () => {
    const r = azar(7);
    for (let i = 0; i < 300; i++) {
      const o = objetoAlAzar(r);
      expect(canonical(barajar(r, o))).toBe(canonical(o));
    }
  });
  it("cambiar un solo valor cambia la huella (300 objetos al azar)", () => {
    const r = azar(11);
    for (let i = 0; i < 300; i++) {
      const o = objetoAlAzar(r);
      const k = Object.keys(o)[0];
      const otro = { ...o, [k]: `${JSON.stringify(o[k])}-distinto` };
      expect(sha256Hex(canonical(otro))).not.toBe(sha256Hex(canonical(o)));
    }
  });
  it("no confunde un número con su texto ni una clave con su valor", () => {
    expect(canonical({ a: 1 })).not.toBe(canonical({ a: "1" }));
    expect(canonical({ a: "b", c: "d" })).not.toBe(canonical({ a: "b,\"c\":\"d" }));
  });
});

describe("árbol de Merkle: propiedades", () => {
  it("toda hoja de lotes de 1 a 40 documentos tiene un camino que llega a la raíz", () => {
    const r = azar(21);
    for (let n = 1; n <= 40; n++) {
      const hojas = Array.from({ length: n }, () => hex(r));
      const { niveles, raiz } = construir(hojas);
      for (const [i, h] of hojas.entries()) expect(verificarCamino(h, camino(niveles, i), raiz)).toBe(true);
    }
  });
  it("un dato alterado, un camino de otra hoja o una raíz distinta no verifican", () => {
    const r = azar(31);
    for (let n = 2; n <= 24; n++) {
      const hojas = Array.from({ length: n }, () => hex(r));
      const { niveles, raiz } = construir(hojas);
      const i = entero(r, n);
      const j = (i + 1 + entero(r, n - 1)) % n;
      expect(verificarCamino(hex(r), camino(niveles, i), raiz)).toBe(false);
      expect(verificarCamino(hojas[i], camino(niveles, j), raiz)).toBe(false);
      expect(verificarCamino(hojas[i], camino(niveles, i), hex(r))).toBe(false);
    }
  });
  it("cambiar o reordenar una hoja cambia la raíz", () => {
    const r = azar(41);
    for (let n = 2; n <= 24; n++) {
      const hojas = Array.from({ length: n }, () => hex(r));
      const base = construir(hojas).raiz;
      const cambiada = hojas.slice(); cambiada[entero(r, n)] = hex(r);
      expect(construir(cambiada).raiz).not.toBe(base);
      const invertida = hojas.slice().reverse();
      expect(construir(invertida).raiz).not.toBe(base);
    }
  });
  it("hojas y nodos tienen prefijos distintos: la raíz de una hoja no es la hoja misma", () => {
    const h = "ab".repeat(32);
    expect(construir([h]).raiz).not.toBe(h);
  });
});
