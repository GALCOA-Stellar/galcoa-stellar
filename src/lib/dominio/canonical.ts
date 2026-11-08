import { createHash } from "node:crypto";

/** Canonización simplificada: claves en orden alfabético, sin espacios. Suficiente para objetos planos y anidados del demo. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(o[k]))
      .join(",") +
    "}"
  );
}

export const sha256 = (...bufs: Buffer[]): Buffer => createHash("sha256").update(Buffer.concat(bufs)).digest();
export const sha256Hex = (s: string): string => sha256(Buffer.from(s, "utf8")).toString("hex");
