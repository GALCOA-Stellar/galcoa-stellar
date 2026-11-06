// Defensas básicas para las rutas. En un servidor sin estado (Vercel) el límite de pedidos es "mejor esfuerzo".
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
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new Error("Pedido de otro sitio");
  const origen = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origen && host) { try { if (new URL(origen).host !== host) throw new Error("Pedido de otro sitio"); } catch { throw new Error("Pedido de otro sitio"); } }
}

export async function leerJson(req: Request, maxBytes = 100_000): Promise<unknown> {
  verificarOrigen(req);
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) throw new Error("Se espera JSON");
  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > maxBytes) throw new Error("Cuerpo demasiado grande"); // se rechaza sin leerlo
  const texto = await req.text();
  if (Buffer.byteLength(texto, "utf8") > maxBytes) throw new Error("Cuerpo demasiado grande");
  return JSON.parse(texto);
}
