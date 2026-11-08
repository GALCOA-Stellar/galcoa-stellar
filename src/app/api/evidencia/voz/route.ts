import { NextResponse } from "next/server";
import { analizarVoz, huellaDe } from "@/lib/aplicacion/evidencia";
import { MIMES_AUDIO, peritarAudio } from "@/lib/agentes/perito";
import type { DesafioVoz } from "@/lib/dominio/voz";
import { limitarPedido } from "@/lib/servidor/limite";
import { verificarOrigen } from "@/lib/servidor/guardas";
import { evidenciaRespaldada, marcaDeTextoValida } from "@/lib/stellar/firma";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

/** Audio de evidencia: frase del desafío, transcripción y perito de voz, y firma de una cuenta autorizada. El archivo no se guarda. */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 10); if (lim) return lim; }
  try {
    verificarOrigen(req);
    const declarado = Number(req.headers.get("content-length"));
    if (Number.isFinite(declarado) && declarado > MAX_BYTES + 20_000) return NextResponse.json({ error: "El audio pesa demasiado (máximo 4 MB)" }, { status: 413 });
    const f = await req.formData();
    const archivo = f.get("archivo");
    const datos = f.get("datos");
    const marca = f.get("marca");
    if (!(archivo instanceof File)) return NextResponse.json({ error: "Falta el audio" }, { status: 400 });
    if (typeof datos !== "string" || !marcaDeTextoValida(datos, marca)) return NextResponse.json({ error: "La frase no fue emitida por este servidor: pedí una nueva" }, { status: 403 });
    if (!MIMES_AUDIO.includes(archivo.type) || archivo.size === 0 || archivo.size > MAX_BYTES) return NextResponse.json({ error: "Audio no admitido (formato o tamaño, máximo 4 MB)" }, { status: 415 });
    const d = JSON.parse(datos) as { palabras: string[]; numero: string; emitidoEn: number };
    if (!Array.isArray(d.palabras) || typeof d.numero !== "string" || typeof d.emitidoEn !== "number") return NextResponse.json({ error: "La frase no tiene el formato esperado" }, { status: 400 });
    const desafio: DesafioVoz = { frase: "", palabras: d.palabras, numero: d.numero };
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const huella = huellaDe(bytes);
    // La firma es opcional en la carga: sin ella, la regla ALC-VOZ-04 deja el audio en rojo.
    let acceso: unknown = null;
    const crudo = f.get("acceso");
    if (typeof crudo === "string" && crudo.length < 5000) { try { acceso = JSON.parse(crudo); } catch { acceso = null; } }
    const atribucion = evidenciaRespaldada(acceso, huella);
    const perito = await peritarAudio(bytes, archivo.type);
    return NextResponse.json({
      ...analizarVoz({ bytes, informe: perito?.informe ?? null, transcripcion: perito?.transcripcion ?? "", desafio, emitidoMs: d.emitidoEn, recibidoMs: Date.now(), atribucion }),
      cuentaQueRespalda: atribucion.firmaValida ? atribucion.cuenta : undefined,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo analizar el audio" }, { status: 400 });
  }
}
