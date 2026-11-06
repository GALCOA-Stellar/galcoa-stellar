import { NextResponse } from "next/server";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { contratoId } from "@/lib/contrato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Salud del servicio, para un vigilante externo (ver .github/workflows/vigilancia.yml).
 * No expone secretos ni datos: solo si la app responde, si puede escribir sus registros y qué está configurado.
 */
export async function GET() {
  const carpeta = process.env.GALCOA_DATOS || join(process.cwd(), ".datos");
  let almacen = false;
  try { await mkdir(carpeta, { recursive: true }); const t = join(carpeta, ".salud"); await writeFile(t, String(Date.now())); await unlink(t); almacen = true; } catch { /* almacen queda en false */ }
  const configurado = { sello2de2: !!process.env.CUENTA_SELLADORA_2DE2, contrato: !!contratoId(), cuentas: !!process.env.CUENTAS_AUTORIZADAS };
  const ok = almacen;
  return NextResponse.json({ ok, almacen, configurado, hora: new Date().toISOString() }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
