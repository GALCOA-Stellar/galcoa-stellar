/**
 * Comisión por operación con tope. La base de Stellar es 100 stroops (0,00001 XLM), pero con la red congestionada
 * la comisión necesaria sube. Se mira la estadística reciente de la red, se pide un poco más que la mediana
 * y NUNCA se supera el tope (COMISION_MAXIMA_STROOPS, por defecto 10.000 stroops = 0,001 XLM por operación).
 */
export const COMISION_BASE = 100;
export const TOPE_POR_DEFECTO = 10_000;

export function topeDeComision(env = process.env.COMISION_MAXIMA_STROOPS): number {
  const n = Number(env);
  return Number.isInteger(n) && n >= COMISION_BASE ? n : TOPE_POR_DEFECTO;
}

/** stats: respuesta de /fee_stats de Horizon. Devuelve stroops por operación, entre la base y el tope. */
export function elegirComision(stats: unknown, tope = topeDeComision()): number {
  const o = (typeof stats === "object" && stats !== null ? stats : {}) as { fee_charged?: { p70?: string }; max_fee?: { p70?: string } };
  const p = Number(o.fee_charged?.p70 ?? o.max_fee?.p70);
  const pedida = Number.isFinite(p) && p > 0 ? Math.ceil(p * 1.2) : COMISION_BASE;
  return Math.min(Math.max(pedida, COMISION_BASE), tope);
}

/** Cada reintento duplica la comisión, sin pasar el tope. */
export const subirComision = (actual: number, tope = topeDeComision()): number => Math.min(actual * 2, tope);

export async function comisionActual(): Promise<number> {
  try {
    const r = await fetch("https://horizon-testnet.stellar.org/fee_stats", { signal: AbortSignal.timeout(5_000) });
    return r.ok ? elegirComision(await r.json()) : COMISION_BASE;
  } catch {
    return COMISION_BASE; // sin estadística: se empieza por la base y se sube solo si la red rechaza
  }
}
