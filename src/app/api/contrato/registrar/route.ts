import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { previsualizarLote } from "@/lib/aplicacion/lote";
import { registrarConClavesDeDemo } from "@/lib/stellar/contrato";
import { demoActivo } from "@/lib/servidor/demo";
import { ipDe, leerJson } from "@/lib/servidor/guardas";

export const runtime = "nodejs";
export const maxDuration = 60;

/** MODO DEMOSTRACIÓN: registra la huella de un lote en el contrato. Con billeteras reales cada persona firmará su autorización (pendiente). */
export async function POST(req: Request) {
  if (!demoActivo()) return NextResponse.json({ error: "El registro en el contrato desde la pantalla solo está en modo demostración" }, { status: 404 });
  { const lim = await limitarPedido(req, 5); if (lim) return lim; }
  try {
    const c = (await leerJson(req)) as { documentos?: unknown };
    const vista = previsualizarLote(c.documentos as unknown[]);
    if (!vista.memo) return NextResponse.json({ error: "No hay nada para registrar" }, { status: 400 });
    const reg = await registrarConClavesDeDemo(vista.memo);
    console.log(JSON.stringify({ flujo: vista.memo, paso: "registro-demo", ...reg })); // la huella es el identificador común del flujo
    return NextResponse.json({ memo: vista.memo, ...reg });
  } catch (e) {
    const permitido = ["El contrato rechazó", "Stellar rechazó", "La red no confirmó", "Mandá al menos", "Máximo", "Falta configurar", "Se espera JSON", "Pedido de otro sitio"];
    return NextResponse.json({ error: e instanceof Error && permitido.some((p) => e.message.startsWith(p)) ? e.message : "No se pudo registrar" }, { status: 400 });
  }
}
