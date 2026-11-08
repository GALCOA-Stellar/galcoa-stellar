import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { previsualizarLote } from "@/lib/aplicacion/lote";
import { ErrorDeForma, leerCuerpo } from "@/lib/servidor/guardas";
import { pedidoPrevisualizar } from "@/lib/dominio/esquemas";

export const runtime = "nodejs";

/** "Qué se sella": no toca la red ni gasta nada, por eso no pide código de acceso (sí tiene límite de pedidos). */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 30); if (lim) return lim; }
  try {
    const cuerpo = await leerCuerpo(req, pedidoPrevisualizar);
    return NextResponse.json(previsualizarLote(cuerpo.documentos));
  } catch (e) {
    const permitido = ["Mandá al menos un documento", "Máximo", "Se espera JSON", "Cuerpo demasiado grande", "Pedido de otro sitio"];
    const msg = e instanceof ErrorDeForma ? e.message : e instanceof Error && permitido.some((p) => e.message.startsWith(p)) ? e.message : "No se pudo revisar el lote";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
