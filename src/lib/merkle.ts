import { sha256 } from "./canonical";

export type PasoCamino = { lado: "L" | "R"; hash: string };

const hoja = (h: Buffer) => sha256(Buffer.from([0x00]), h);
const nodo = (l: Buffer, r: Buffer) => sha256(Buffer.from([0x01]), l, r);

/** Árbol de Merkle con prefijos distintos para hojas (0x00) y nodos (0x01). Nivel impar: el último nodo sube sin duplicarse. */
export function construir(manifestHashesHex: string[]) {
  if (manifestHashesHex.length === 0) throw new Error("Un lote no puede estar vacío");
  const niveles: Buffer[][] = [manifestHashesHex.map((h) => hoja(Buffer.from(h, "hex")))];
  while (niveles[niveles.length - 1].length > 1) {
    const actual = niveles[niveles.length - 1];
    const siguiente: Buffer[] = [];
    for (let i = 0; i < actual.length; i += 2) siguiente.push(i + 1 < actual.length ? nodo(actual[i], actual[i + 1]) : actual[i]);
    niveles.push(siguiente);
  }
  return { niveles, raiz: niveles[niveles.length - 1][0].toString("hex") };
}

export function camino(niveles: Buffer[][], indice: number): PasoCamino[] {
  const out: PasoCamino[] = [];
  let idx = indice;
  for (let l = 0; l < niveles.length - 1; l++) {
    const hermano = idx ^ 1;
    if (hermano < niveles[l].length) out.push({ lado: idx % 2 === 0 ? "R" : "L", hash: niveles[l][hermano].toString("hex") });
    idx = Math.floor(idx / 2);
  }
  return out;
}

export function verificarCamino(manifestHashHex: string, path: PasoCamino[], raizHex: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(manifestHashHex) || !/^[0-9a-f]{64}$/.test(raizHex)) return false;
  let actual = hoja(Buffer.from(manifestHashHex, "hex"));
  for (const p of path) {
    if (!/^[0-9a-f]{64}$/.test(p.hash) || (p.lado !== "L" && p.lado !== "R")) return false;
    const h = Buffer.from(p.hash, "hex");
    actual = p.lado === "R" ? nodo(actual, h) : nodo(h, actual);
  }
  return actual.toString("hex") === raizHex;
}
