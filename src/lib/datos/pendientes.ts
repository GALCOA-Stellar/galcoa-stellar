import "server-only";
import { borrar, guardar, leer } from "./almacen";

/**
 * Transacciones enviadas a la red que todavía no se confirmaron. Se guarda el hash ANTES de esperar, para que un reintento
 * pregunte por ese hash en vez de armar otra transacción (que sellaría dos veces y pagaría dos comisiones).
 */
export type Pendiente = { memo: string; txHash: string; vigenteHasta: number; modo: "2de2" | "una-firma" };

const COLECCION = "pendientes";
const clave = (memo: string) => memo.slice(0, 32);

export const guardarPendiente = (p: Pendiente) => guardar(COLECCION, clave(p.memo), p);
export const leerPendiente = (memo: string) => leer<Pendiente>(COLECCION, clave(memo));
export const borrarPendiente = (memo: string) => borrar(COLECCION, clave(memo));
