import { createHash } from "node:crypto";
import { reclamar } from "./almacen";

/**
 * Cupo diario de sellos por cuenta autorizada. El servicio paga las comisiones, así que una cuenta (o una clave robada)
 * no puede gastarlas sin límite. Cada sello ocupa una "casilla" del día (archivo de reclamo exclusivo): es atómico,
 * dos pedidos a la vez no pueden quedarse con la misma casilla. Es una defensa de PROTOTIPO; para producción conviene
 * una base de datos y un tope global además del tope por cuenta.
 * CUPO_DIARIO: cantidad de sellos por cuenta y por día UTC (por defecto 20; "0" lo apaga, solo para desarrollo).
 */
export const CUPO_POR_DEFECTO = 20;

export function cupoDiario(): number {
  const v = process.env.CUPO_DIARIO;
  if (v === undefined || v.trim() === "") return CUPO_POR_DEFECTO;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 1000) return CUPO_POR_DEFECTO;
  // "0" apaga el tope solo fuera de producción: allá una variable mal puesta no puede dejar el gasto sin límite.
  return n === 0 && process.env.NODE_ENV === "production" ? CUPO_POR_DEFECTO : n;
}

const diaUtc = (ahora: number) => new Date(ahora).toISOString().slice(0, 10);

/** Ocupa una casilla del día para la cuenta. Devuelve `ok: false` si ya usó todas las de hoy. */
export async function usarCupo(cuenta: string, ahora = Date.now()): Promise<{ ok: boolean; usados: number; max: number }> {
  const max = cupoDiario();
  if (max === 0) return { ok: true, usados: 0, max };
  for (let k = 0; k < max; k++) {
    const id = createHash("sha256").update(`${cuenta}|${diaUtc(ahora)}|${k}`).digest("hex").slice(0, 32);
    if (await reclamar("cupos", id, "usado")) return { ok: true, usados: k + 1, max };
  }
  return { ok: false, usados: max, max };
}
