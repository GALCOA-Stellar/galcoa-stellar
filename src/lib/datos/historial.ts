import { guardar, leer, listar, nuevoId } from "./almacen";
import { demoActivo } from "../servidor/demo";
import { leerSesion } from "../stellar/firma";
import { registrarError } from "../servidor/registro";

/**
 * Historial de operaciones selladas. Guarda el archivo del lote (que es la prueba que la persona también se descarga)
 * para poder volver a verlo y bajar las constancias. No guarda claves. A Stellar sigue yendo solo la huella.
 */
export type Operacion = {
  id: string; fecha: string; txHash: string; ledger: number; memo: string; cantidadHojas: number;
  firmadoPor: string | string[]; personas?: string[]; modo: "2de2" | "una-firma"; archivo: unknown;
  /** Comisión cobrada por la red por este sello, en stroops (texto). Falta en operaciones anteriores al contador. */
  comisionStroops?: string;
};

/** Contador de comisiones: cuántos sellos tienen la comisión anotada y cuánto sumaron. Solo cuenta lo que se anotó, sin estimar el resto. */
export function resumenComisiones(ops: { comisionStroops?: string }[]): { sellos: number; sinDato: number; totalStroops: string; totalXlm: string } {
  let total = 0n, con = 0;
  for (const o of ops) if (o.comisionStroops && /^\d+$/.test(o.comisionStroops)) { total += BigInt(o.comisionStroops); con++; }
  const xlm = `${total / 10_000_000n}.${(total % 10_000_000n).toString().padStart(7, "0")}`;
  return { sellos: con, sinDato: ops.length - con, totalStroops: total.toString(), totalXlm: xlm };
}
export type ResumenOperacion = Omit<Operacion, "archivo">;

const COLECCION = "operaciones";
const IDX_MEMO = "memos";
const IDX_TX = "porhash";

/** Nunca rompe el sellado: si no se puede guardar, solo avisa en el registro del servidor. */
export async function registrarOperacion(o: Omit<Operacion, "id" | "fecha">, ahora = Date.now()): Promise<string | null> {
  try {
    const op: Operacion = { id: nuevoId(), fecha: new Date(ahora).toISOString(), ...o };
    await guardar(COLECCION, op.id, op);
    // Índices por huella y por hash de transacción: la consulta "¿ya se selló?" no recorre todas las operaciones.
    await guardar(IDX_MEMO, op.memo.slice(0, 32), { id: op.id });
    await guardar(IDX_TX, op.txHash.slice(0, 32), { id: op.id });
    return op.id;
  } catch (e) {
    registrarError("historial", e);
    return null;
  }
}

/** Quién puede ver el historial: una sesión válida o, solo en desarrollo, el modo demostración. */
export const puedeVerHistorial = (req: Request): boolean => demoActivo() || leerSesion(req.headers.get("x-pase")) !== null;

/** Solo las operaciones en las que participó esta sesión (por su cuenta o su identidad interna). */
/** ¿Participó esta sesión en la operación? (por su cuenta o su identidad interna) */
export const esDeLaSesion = (o: { firmadoPor: string | string[]; personas?: string[] }, sesion: { cuenta: string; identidad: string }): boolean =>
  [o.firmadoPor].flat().includes(sesion.cuenta) || (o.personas ?? []).includes(sesion.identidad);

export async function listarOperacionesDe(sesion: { cuenta: string; identidad: string }): Promise<ResumenOperacion[]> {
  const mias = (o: ResumenOperacion) => [o.firmadoPor].flat().includes(sesion.cuenta) || (o.personas ?? []).includes(sesion.identidad);
  return (await listarOperaciones()).filter(mias);
}

export async function listarOperaciones(): Promise<ResumenOperacion[]> {
  const todas = await listar<Operacion>(COLECCION, 500);
  return todas.map(({ archivo: _a, ...resumen }) => { void _a; return resumen; }).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
/** ¿Este comprobante lo selló y guardó este servidor? (Evita constancias con la marca de GALCOA+ armadas a mano.) */
export async function comprobanteRegistrado(txHash: string, manifestHash: string): Promise<boolean> {
  const tiene = (o: Operacion | undefined | null) => !!o && o.txHash === txHash && ((o.archivo as { comprobantes?: { manifestHash?: string }[] } | null)?.comprobantes ?? []).some((c) => c.manifestHash === manifestHash);
  if (!/^[0-9a-f]{32}/.test(txHash)) return false;
  const idx = await leer<{ id: string }>(IDX_TX, txHash.slice(0, 32));
  if (idx && tiene(await leer<Operacion>(COLECCION, idx.id))) return true;
  return (await listar<Operacion>(COLECCION, 500)).some((o) => tiene(o)); // operaciones anteriores a los índices
}
/** ¿Ya se selló un lote con esta huella? Evita sellar dos veces (y pagar dos comisiones) si alguien reintenta. */
export async function operacionPorMemo(memo: string): Promise<ResumenOperacion | null> {
  const idx = /^[0-9a-f]{32}/.test(memo) ? await leer<{ id: string }>(IDX_MEMO, memo.slice(0, 32)) : null;
  const directa = idx ? await leer<Operacion>(COLECCION, idx.id) : null;
  const o = directa?.memo === memo ? directa : (await listar<Operacion>(COLECCION, 5000)).find((x) => x.memo === memo); // el recorrido solo cubre lo anterior a los índices
  if (!o) return null;
  const { archivo: _a, ...resumen } = o; void _a;
  return resumen;
}
export const leerOperacion = (id: string) => leer<Operacion>(COLECCION, id);
