/**
 * Prueba diferencial (auditoría del 07/11/2026): la codificación, el árbol de Merkle, los caminos, el memo y la verificación
 * están implementados en la app (src/lib/dominio) y en el paquete independiente (packages/galcoa-comprobante).
 * Esta prueba les pasa miles de casos de borde con semilla fija y exige que den lo mismo (o que los dos rechacen).
 * Si alguien toca una sola de las dos implementaciones, falla acá.
 */
import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { huellaManifiestoV2, memoDelLoteV2 } from "../src/lib/dominio/codificacion";
import { construir, camino, verificarCamino } from "../src/lib/dominio/merkle";
import { verificarComprobante } from "../src/lib/aplicacion/lote";
// @ts-expect-error paquete JS sin tipos
import * as pkg from "../packages/galcoa-comprobante/index.js";

let s = 12345;
const rnd = () => {
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return s / 0x7fffffff;
};
const elegir = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const textos = ["R-1", "", " ", "Yerba Mate", "Café", "Cafe\u0301", "ñandú", "😀", "\uD83D", "\uDE00x", "a".repeat(65536), "a".repeat(65537), "ア", "\u0000", "línea\nnueva", `${"x".repeat(21846)}€`];
const valores = (): unknown => elegir<unknown>([elegir(textos), elegir(textos), 0, -0, 1, -1, 2 ** 53 - 1, 2 ** 53, 1.5, Number.NaN, Infinity, null, undefined, true, "0".repeat(64), "A".repeat(64), "g".repeat(64), [], {}, "10"]);
const CAMPOS = ["remito", "producto", "unidad", "cantidadPedida", "cantidadRecibida", "fechaEntrega", "fechaRegistro", "cargadoPor", "confirmadoPor", "evidenciaHash", "observacion"];
const valido = () => ({ remito: "R-1", producto: "Yerba", unidad: "caja", cantidadPedida: 10, cantidadRecibida: 10, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-02", cargadoPor: "a", confirmadoPor: "b" });
function documento(): unknown {
  const d: Record<string, unknown> = valido();
  const cambios = Math.floor(rnd() * 3);
  for (let i = 0; i < cambios; i++) { const c = elegir(CAMPOS); const v = valores(); if (v === undefined && rnd() < 0.5) delete d[c]; else d[c] = v; }
  if (rnd() < 0.05) d[elegir(["extra", "__proto__", "Remito", "constructor"])] = "x";
  if (rnd() < 0.03) return elegir<unknown>([null, [], "texto", 5]);
  return d;
}
function manifiesto(): unknown {
  const m: Record<string, unknown> = { documento: documento(), reglasVersion: rnd() < 0.9 ? "reglas-demo-0.2" : valores(), reglasIds: rnd() < 0.85 ? ["ALC-1", "ALC-2"] : elegir<unknown>([[], ["Café"], [1], "x", null, Array(257).fill("a"), Array(256).fill("a")]), veredicto: rnd() < 0.9 ? elegir(["verde", "amarillo"]) : valores() };
  if (rnd() < 0.03) m.extra = 1;
  return m;
}
const intentar = (f: () => string) => { try { return f(); } catch { return "ERROR"; } };

it("diferencial: app vs paquete, 20.000 manifiestos", () => {
  const difs: string[] = []; let validos = 0;
  for (let i = 0; i < 20000; i++) {
    const m = manifiesto();
    const a = intentar(() => huellaManifiestoV2(m as never)), b = intentar(() => pkg.huellaDe(m));
    if (a !== "ERROR") validos++;
    if (a !== b && difs.length < 8) difs.push(`${a.slice(0, 8)} vs ${b.slice(0, 8)} :: ${JSON.stringify(m).slice(0, 220)}`);
  }
  expect(validos).toBeGreaterThan(1000); // que la prueba ejercite casos válidos, no solo rechazos
  expect(difs).toEqual([]);
});
it("diferencial: Merkle, caminos y memo para lotes de 1 a 80", () => {
  let difs = 0;
  for (let n = 1; n <= 80; n++) {
    const hs = Array.from({ length: n }, (_, i) => createHash("sha256").update(`${n}-${i}`).digest("hex"));
    const a = construir(hs), b = pkg.construirArbol(hs);
    if (a.raiz !== b.raiz || memoDelLoteV2(a.raiz, n) !== pkg.memoDelLote(b.raiz, n)) difs++;
    for (let i = 0; i < n; i++) {
      const ca = camino(a.niveles, i), cb = pkg.caminoDe(b.niveles, i);
      if (JSON.stringify(ca) !== JSON.stringify(cb) || !verificarCamino(hs[i], cb, a.raiz) || !pkg.verificarCamino(hs[i], ca, b.raiz)) difs++;
    }
  }
  expect(difs).toBe(0);
});
it("diferencial: verificación de comprobantes alterados", () => {
  const ms = [1, 2, 3].map((k) => ({ documento: { ...valido(), remito: `R-${k}` }, reglasVersion: "x", reglasIds: ["A"], veredicto: "verde" }));
  const { comprobantes } = pkg.armarLote(ms);
  type Mutable = { cantidadHojas: unknown; indice: unknown; camino: { lado: string; hash: string }[] | null; raiz: string; manifestHash: string; schemaVersion: string; manifiesto: { documento: Record<string, unknown>; extra?: unknown } };
  const mutaciones: ((c: Mutable) => void)[] = [
    (c) => { c.cantidadHojas = 4; }, (c) => { c.cantidadHojas = "3"; }, (c) => { c.cantidadHojas = 3.0000001; }, (c) => { c.cantidadHojas = 0; },
    (c) => { c.indice = 9; }, (c) => { c.camino = []; }, (c) => { c.camino = [...(c.camino ?? []), ...(c.camino ?? []).slice(0, 1)]; }, (c) => { c.camino = null; },
    (c) => { c.raiz = c.raiz.toUpperCase(); }, (c) => { c.manifestHash = c.manifestHash.toUpperCase(); }, (c) => { c.manifiesto.documento.remito = "R-9"; },
    (c) => { c.schemaVersion = "galcoa.stellar.comprobante.v1"; }, (c) => { c.manifiesto.extra = 1; }, (c) => { if (c.camino?.[0]) c.camino[0].lado = "l"; },
  ];
  const difs: string[] = [];
  mutaciones.forEach((mut, i) => {
    const c = JSON.parse(JSON.stringify(comprobantes[0])); mut(c);
    const a = verificarComprobante(c), b = pkg.verificarComprobante(c);
    const ra = a.coherente ? a.memoEsperado : "NO", rb = b.coherente ? b.memoEsperado : "NO";
    if (ra !== rb) difs.push(`mutación ${i}: app=${ra.slice(0, 8)} paquete=${rb.slice(0, 8)}`);
  });
  expect(difs).toEqual([]);
});
