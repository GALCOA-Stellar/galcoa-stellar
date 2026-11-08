import { NextResponse } from "next/server";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { contratoId } from "@/lib/stellar/contrato";
import { carpetaDeDatos } from "@/lib/datos/almacen";
import { remotoActivo } from "@/lib/datos/almacen-remoto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Salud del servicio, para un vigilante externo (ver .github/workflows/vigilancia.yml).
 * No expone secretos ni datos: solo si la app responde, si puede escribir sus registros y qué está configurado.
 */
export async function GET() {
  const carpeta = carpetaDeDatos();
  let almacen = false;
  try { await mkdir(carpeta, { recursive: true }); const t = join(carpeta, ".salud"); await writeFile(t, String(Date.now())); await unlink(t); almacen = true; } catch { /* almacen queda en false */ }
  const configurado = { sello2de2: !!process.env.CUENTA_SELLADORA_2DE2, contrato: !!contratoId(), cuentas: !!process.env.CUENTAS_AUTORIZADAS };
  // Sin base compartida, en Vercel cada instancia tiene su propio disco temporal: los bloqueos de un solo uso no se comparten. Se informa a la vista.
  const tipoAlmacen = remotoActivo() ? "supabase" : "disco";
  const ok = almacen;
  return NextResponse.json({ ok, almacen, tipoAlmacen, advertencia: tipoAlmacen === "disco" && process.env.VERCEL ? "Almacén en disco temporal: no compartido entre instancias" : null, configurado, hora: new Date().toISOString() }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
