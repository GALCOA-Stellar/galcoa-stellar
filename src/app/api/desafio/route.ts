import { NextResponse } from "next/server";
import { previsualizarLote } from "@/lib/lote";
import { cuentaAutorizada, emitirDesafio } from "@/lib/firma";
import { ipDe, leerJson, limitar } from "@/lib/guardas";

export const runtime = "nodejs";

/** Emite el mensaje que una cuenta autorizada debe firmar para confirmar ESTE lote (la huella la calcula el servidor). */
export async function POST(req: Request) {
  if (!limitar(ipDe(req), 20)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
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
