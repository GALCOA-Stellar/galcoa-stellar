import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ipDe, limitar } from "./guardas";
import { cabeceraClave, remotoActivo } from "../datos/almacen-remoto";

/**
 * Límite de pedidos en dos capas:
 * 1) en memoria, como siempre (rápido, "mejor esfuerzo" en un servidor sin estado);
 * 2) si hay base de datos configurada, un contador durable compartido entre instancias.
 * De la IP solo se guarda un resumen (hash), nunca la dirección. Si el contador durable falla, por defecto se FALLA CERRADO:
 * se responde 503 en vez de dejar pasar. Con GALCOA_LIMITE_FALLA=abierto se sigue solo con la capa en memoria.
 */
const VENTANA_S = 60;
const MENSAJE = "Demasiados pedidos. Probá en un minuto.";

export const resumenDeOrigen = (ip: string, ruta: string) => createHash("sha256").update(`${ip}|${ruta}`).digest("hex").slice(0, 32);

/** Cuenta un pedido en la base. Devuelve true si todavía está dentro del límite. Lanza si la base no responde. */
export async function contarDurable(clave: string, max: number, ahoraMs = Date.now()): Promise<boolean> {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const llave = process.env.SUPABASE_SERVICE_KEY ?? "";
  const r = await fetch(`${base}/rest/v1/rpc/galcoa_limite`, {
    method: "POST",
    headers: { ...cabeceraClave(llave), "content-type": "application/json" },
    body: JSON.stringify({ p_clave: clave, p_ventana: Math.floor(ahoraMs / 1000 / VENTANA_S) }),
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) throw new Error(`Contador de pedidos: ${r.status}`);
  const n = Number(await r.json());
  if (!Number.isFinite(n)) throw new Error("Contador de pedidos: respuesta inválida");
  return n <= max;
}

/** Devuelve null si el pedido puede seguir, o la respuesta de rechazo (429 si pasó el límite, 503 si falla cerrado). */
export async function limitarPedido(req: Request, max = 8): Promise<NextResponse | null> {
  const ip = ipDe(req);
  if (!limitar(ip, max)) return NextResponse.json({ error: MENSAJE }, { status: 429 });
  if (!remotoActivo()) return null;
  try {
    const ruta = new URL(req.url).pathname.replace(/[0-9a-f]{32}|[A-Za-z0-9_-]{43}/g, ":id");
    if (!(await contarDurable(resumenDeOrigen(ip, ruta), max))) return NextResponse.json({ error: MENSAJE }, { status: 429 });
    return null;
  } catch (e) {
    if (process.env.GALCOA_LIMITE_FALLA === "abierto") return null;
    console.error("limite:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "El control de pedidos no responde. Probá en un minuto." }, { status: 503, headers: { "retry-after": "60" } });
  }
}
