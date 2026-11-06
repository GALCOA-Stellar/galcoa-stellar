import { NextResponse } from "next/server";
import { previsualizarLote } from "@/lib/lote";
import { ipDe, leerJson, limitar } from "@/lib/guardas";

export const runtime = "nodejs";

/** "Qué se sella": no toca la red ni gasta nada, por eso no pide código de acceso (sí tiene límite de pedidos). */
export async function POST(req: Request) {
  if (!limitar(ipDe(req), 30)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  try {
    const cuerpo = (await leerJson(req)) as { documentos?: unknown };
    return NextResponse.json(previsualizarLote(cuerpo.documentos as unknown[]));
  } catch (e) {
    const permitido = ["Mandá al menos un documento", "Máximo", "Se espera JSON", "Cuerpo demasiado grande", "Pedido de otro sitio"];
    const msg = e instanceof Error && permitido.some((p) => e.message.startsWith(p)) ? e.message : "No se pudo revisar el lote";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
