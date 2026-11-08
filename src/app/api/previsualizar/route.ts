import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { previsualizarLote } from "@/lib/aplicacion/lote";
import { leerCuerpo, mensajePublico } from "@/lib/servidor/guardas";
import { pedidoPrevisualizar } from "@/lib/dominio/esquemas";

export const runtime = "nodejs";

/** "Qué se sella": no toca la red ni gasta nada, por eso no pide código de acceso (sí tiene límite de pedidos). */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 30); if (lim) return lim; }
  try {
    const cuerpo = await leerCuerpo(req, pedidoPrevisualizar);
    return NextResponse.json(previsualizarLote(cuerpo.documentos));
  } catch (e) {
        const msg = mensajePublico(e, ["Mandá al menos un documento", "Máximo"], "No se pudo revisar el lote");
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
