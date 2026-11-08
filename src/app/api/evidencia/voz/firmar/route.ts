import { NextResponse } from "next/server";
import { huellaDe } from "@/lib/aplicacion/evidencia";
import { MIMES_AUDIO } from "@/lib/agentes/perito";
import { limitarPedido } from "@/lib/servidor/limite";
import { verificarOrigen } from "@/lib/servidor/guardas";
import { cuentaAutorizada, emitirDesafioEvidencia } from "@/lib/stellar/firma";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;

/** Pide el mensaje que una cuenta autorizada debe firmar para respaldar ESTE audio (la huella la calcula el servidor). */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 20); if (lim) return lim; }
  try {
    verificarOrigen(req);
    const f = await req.formData();
    const archivo = f.get("archivo");
    const cuenta = f.get("cuenta");
    if (!(archivo instanceof File) || typeof cuenta !== "string") return NextResponse.json({ error: "Falta el audio o la cuenta" }, { status: 400 });
    if (!MIMES_AUDIO.includes(archivo.type) || archivo.size === 0 || archivo.size > MAX_BYTES) return NextResponse.json({ error: "Audio no admitido (formato o tamaño, máximo 4 MB)" }, { status: 415 });
    if (!cuentaAutorizada(cuenta)) return NextResponse.json({ error: "Esa cuenta no está autorizada" }, { status: 403 });
    const huella = huellaDe(new Uint8Array(await archivo.arrayBuffer()));
    return NextResponse.json({ ...emitirDesafioEvidencia(cuenta, huella), huella });
  } catch (e) {
    const ok = e instanceof Error && ["Cuenta inválida", "Pedido de otro sitio", "Falta configurar"].some((p) => e.message.startsWith(p));
    return NextResponse.json({ error: ok ? (e as Error).message : "No se pudo emitir el mensaje a firmar" }, { status: 400 });
  }
}
