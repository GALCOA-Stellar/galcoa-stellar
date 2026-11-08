import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { previsualizarLote } from "@/lib/aplicacion/lote";
import { cuentaAutorizada, emitirDesafio } from "@/lib/stellar/firma";
import { ipDe, leerJson } from "@/lib/servidor/guardas";

export const runtime = "nodejs";

/** Emite el mensaje que una cuenta autorizada debe firmar para confirmar ESTE lote (la huella la calcula el servidor). */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 20); if (lim) return lim; }
  try {
    const cuerpo = (await leerJson(req)) as { cuenta?: unknown; documentos?: unknown };
    if (typeof cuerpo.cuenta !== "string") return NextResponse.json({ error: "Falta la cuenta" }, { status: 400 });
    if (!cuentaAutorizada(cuerpo.cuenta)) return NextResponse.json({ error: "Esa cuenta no está autorizada para confirmar sellos" }, { status: 403 });
    const vista = previsualizarLote(cuerpo.documentos as unknown[]);
    if (!vista.memo) return NextResponse.json({ error: "Ningún documento pasó la verificación: no hay nada para sellar" }, { status: 400 });
    return NextResponse.json({ ...emitirDesafio(cuerpo.cuenta, vista.memo), memo: vista.memo });
  } catch (e) {
    const permitido = ["Mandá al menos un documento", "Máximo", "Se espera JSON", "Cuerpo demasiado grande", "Pedido de otro sitio", "Cuenta inválida", "Falta configurar"];
    const msg = e instanceof Error && permitido.some((p) => e.message.startsWith(p)) ? e.message : "No se pudo emitir el mensaje a firmar";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
