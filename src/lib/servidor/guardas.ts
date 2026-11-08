// Defensas básicas para las rutas. En un servidor sin estado (Vercel) el límite de pedidos es "mejor esfuerzo".
import "server-only";
import type { ZodType } from "zod";
const ventana = new Map<string, number[]>();

export function limitar(ip: string, max = 8, ms = 60_000): boolean {
  const ahora = Date.now();
  const marcas = (ventana.get(ip) ?? []).filter((t) => ahora - t < ms);
  if (marcas.length >= max) {
    ventana.set(ip, marcas);
    return false;
  }
  marcas.push(ahora);
  ventana.set(ip, marcas);
  // Tope de memoria: se descartan los más viejos de a uno (borrar todo le regalaría un reinicio de límites a cualquiera).
  while (ventana.size > 5000) { const viejo = ventana.keys().next().value; if (viejo === undefined) break; ventana.delete(viejo); }
  return true;
}

export const ipDe = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

/** Pedido de otro sitio o con tipo erróneo se rechaza; el cuerpo se limita en tamaño. */
export function verificarOrigen(req: Request): void {
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new ErrorPublico("Pedido de otro sitio");
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origen && host) { try { if (new URL(origen).host !== host) throw new ErrorPublico("Pedido de otro sitio"); } catch { throw new ErrorPublico("Pedido de otro sitio"); } }
}

export async function leerJson(req: Request, maxBytes = 100_000): Promise<unknown> {
  verificarOrigen(req);
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) throw new ErrorPublico("Se espera JSON");
  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > maxBytes) throw new ErrorPublico("Cuerpo demasiado grande"); // se rechaza sin leerlo
  const texto = await req.text();
  if (Buffer.byteLength(texto, "utf8") > maxBytes) throw new ErrorPublico("Cuerpo demasiado grande");
  return JSON.parse(texto);
}

/** Error cuyo mensaje es seguro de mostrar a quien hizo el pedido (no revela detalles internos). */
export class ErrorPublico extends Error {}

/** Pedido que no tiene la forma esperada: el mensaje es seguro de mostrar. */
export class ErrorDeForma extends ErrorPublico {}

/**
 * Mensaje para devolver al navegador: el de un `ErrorPublico`, el de un error que empiece con alguno de los prefijos
 * permitidos (errores de reglas que todavía lanzan `Error`), o el mensaje genérico. Nunca se filtra otro texto.
 */
export function mensajePublico(e: unknown, prefijos: readonly string[], porDefecto: string): string {
  if (e instanceof ErrorPublico) return e.message;
  if (e instanceof Error && prefijos.some((p) => e.message.startsWith(p))) return e.message;
  return porDefecto;
}

/** Lee el JSON del pedido y comprueba su forma con un esquema Zod. Lo que sobra se descarta; lo que falta o está mal, se rechaza. */
export async function leerCuerpo<T>(req: Request, esquema: ZodType<T>, maxBytes = 100_000): Promise<T> {
  const r = esquema.safeParse(await leerJson(req, maxBytes));
  if (r.success) return r.data;
  const primero = r.error.issues[0]?.message ?? "";
  // Los mensajes de Zod por defecto están en inglés y pueden nombrar datos: solo se muestran los que escribimos nosotros.
  throw new ErrorDeForma(/^(Invalid|Too |Unrecognized|Expected|Input )/.test(primero) || primero === "" ? "El pedido no tiene el formato esperado" : primero);
}
