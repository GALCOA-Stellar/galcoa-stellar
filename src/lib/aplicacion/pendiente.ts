import { borrarPendiente, guardarPendiente, leerPendiente } from "../datos/pendientes";
import { liberar } from "../datos/almacen";
import { estadoDeTx, ConfirmacionPendiente } from "../stellar/stellar";
import type { Prueba } from "./lote";

type Consultar = typeof estadoDeTx;
export type Reanudacion = { tipo: "ninguno" } | { tipo: "espera" } | { tipo: "exito"; tx: { txHash: string; ledger: number; prueba: Prueba } };

/** Margen para que una transacción enviada sin respuesta todavía pueda entrar a la red (60 s en una firma, 10 min en 2 de 2). */
export const VENTANA_MS = { "una-firma": 90_000, "2de2": 11 * 60_000 } as const;

/**
 * Antes de enviar un sello, mirar si un intento anterior quedó sin confirmar. Si ese hash ya entró, se reutiliza (no se envía otra);
 * si todavía puede entrar, se espera; solo cuando falló o ya no puede entrar se permite armar una transacción nueva.
 */
export async function revisarPendiente(memo: string, ahora = Date.now(), consultar: Consultar = estadoDeTx): Promise<Reanudacion> {
  const p = await leerPendiente(memo);
  if (!p) return { tipo: "ninguno" };
  const e = await consultar(p.txHash);
  if (e.estado === "exito") { await borrarPendiente(memo); return { tipo: "exito", tx: { txHash: p.txHash, ledger: e.ledger, prueba: e.prueba } }; }
  if (e.estado === "fallo" || (e.estado === "no-encontrada" && ahora > p.vigenteHasta)) {
    await borrarPendiente(memo);
    await liberar("sellos", memo.slice(0, 32), "enviando");
    return { tipo: "ninguno" };
  }
  return { tipo: "espera" };
}

/** Si el error es "se envió pero no se confirmó", guarda el hash y devuelve true (no se suelta el bloqueo). */
export async function anotarSiQuedoPendiente(e: unknown, memo: string, modo: "2de2" | "una-firma", ahora = Date.now()): Promise<boolean> {
  if (!(e instanceof ConfirmacionPendiente)) return false;
  await guardarPendiente({ memo, txHash: e.txHash, vigenteHasta: ahora + VENTANA_MS[modo], modo });
  return true;
}
