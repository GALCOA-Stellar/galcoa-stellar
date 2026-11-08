import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { idValido } from "@/lib/datos/almacen";
import { ipDe } from "@/lib/servidor/guardas";
import { puedeVerHistorial } from "@/lib/datos/historial";
import { resumenDe } from "@/lib/datos/ronda";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** Estado de la ronda para la distribuidora: quién confirmó, quién falta y si todos confirmaron el mismo documento. */
export async function GET(req: Request, { params }: Ctx) {
  { const lim = await limitarPedido(req, 60); if (lim) return lim; }
  if (!puedeVerHistorial(req)) return NextResponse.json({ error: "Ingresá con tu billetera para ver la ronda" }, { status: 401 });
  const { id } = await params;
  const r = idValido(id) ? await resumenDe(id) : null;
  if (!r) return NextResponse.json({ error: "Esa ronda no existe" }, { status: 404 });
  return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
}
