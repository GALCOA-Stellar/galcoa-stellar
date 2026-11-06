import { NextResponse } from "next/server";
import { previsualizarLote } from "@/lib/lote";
import { registrarConClavesDeDemo } from "@/lib/contrato";
import { demoActivo } from "@/lib/demo";
import { ipDe, leerJson, limitar } from "@/lib/guardas";

export const runtime = "nodejs";
export const maxDuration = 60;

/** MODO DEMOSTRACIÓN: registra la huella de un lote en el contrato. Con billeteras reales cada persona firmará su autorización (pendiente). */
export async function POST(req: Request) {
  if (!demoActivo()) return NextResponse.json({ error: "El registro en el contrato desde la pantalla solo está en modo demostración" }, { status: 404 });
  if (!limitar(ipDe(req), 5)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
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
