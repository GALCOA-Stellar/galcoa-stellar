import { guardar, leer, listar, nuevoId } from "./almacen";
import { demoActivo } from "./demo";
import { leerSesion } from "./firma";

/**
 * Historial de operaciones selladas. Guarda el archivo del lote (que es la prueba que la persona también se descarga)
 * para poder volver a verlo y bajar las constancias. No guarda claves. A Stellar sigue yendo solo la huella.
 */
export type Operacion = {
  id: string; fecha: string; txHash: string; ledger: number; memo: string; cantidadHojas: number;
  firmadoPor: string | string[]; personas?: string[]; modo: "2de2" | "una-firma"; archivo: unknown;
};
export type ResumenOperacion = Omit<Operacion, "archivo">;

const COLECCION = "operaciones";

/** Nunca rompe el sellado: si no se puede guardar, solo avisa en el registro del servidor. */
export async function registrarOperacion(o: Omit<Operacion, "id" | "fecha">, ahora = Date.now()): Promise<string | null> {
  try {
    const op: Operacion = { id: nuevoId(), fecha: new Date(ahora).toISOString(), ...o };
    await guardar(COLECCION, op.id, op);
    return op.id;
  } catch (e) {
    console.error("historial:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Quién puede ver el historial: una sesión válida o, solo en desarrollo, el modo demostración. */
export const puedeVerHistorial = (req: Request): boolean => demoActivo() || leerSesion(req.headers.get("x-pase")) !== null;

export async function listarOperaciones(): Promise<ResumenOperacion[]> {
  const todas = await listar<Operacion>(COLECCION, 500);
  return todas.map(({ archivo: _a, ...resumen }) => { void _a; return resumen; }).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
/** ¿Este comprobante lo selló y guardó este servidor? (Evita constancias con la marca de GALCOA+ armadas a mano.) */
export async function comprobanteRegistrado(txHash: string, manifestHash: string): Promise<boolean> {
  const todas = await listar<Operacion>(COLECCION, 500);
  return todas.some((o) => o.txHash === txHash && ((o.archivo as { comprobantes?: { manifestHash?: string }[] } | null)?.comprobantes ?? []).some((c) => c.manifestHash === manifestHash));
}
/** ¿Ya se selló un lote con esta huella? Evita sellar dos veces (y pagar dos comisiones) si alguien reintenta. */
export async function operacionPorMemo(memo: string): Promise<ResumenOperacion | null> {
  const o = (await listar<Operacion>(COLECCION, 5000)).find((x) => x.memo === memo);
  if (!o) return null;
  const { archivo: _a, ...resumen } = o; void _a;
  return resumen;
}
export const leerOperacion = (id: string) => leer<Operacion>(COLECCION, id);
