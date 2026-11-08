/**
 * Registro único del servidor: una línea JSON por evento, sin objetos de error completos
 * (que podrían arrastrar datos de personas). Solo el mensaje, recortado.
 */
const MAX = 300;

function mensaje(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, MAX);
  if (typeof e === "string") return e.slice(0, MAX);
  try { return JSON.stringify(e)?.slice(0, MAX) ?? "error sin detalle"; } catch { return "error sin detalle"; }
}

/** Registra un error con el nombre de la operación donde ocurrió. */
export function registrarError(operacion: string, error: unknown): void {
  console.error(JSON.stringify({ nivel: "error", operacion, mensaje: mensaje(error) }));
}

/** Registra un paso normal de un flujo (por ejemplo, un registro enviado a la red). Solo datos que ya son públicos. */
export function registrarEvento(datos: Record<string, unknown>): void {
  console.log(JSON.stringify({ nivel: "info", ...datos }));
}
