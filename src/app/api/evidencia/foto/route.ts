import { NextResponse } from "next/server";
import { analizarFoto } from "@/lib/aplicacion/evidencia";
import { MIMES_FOTO, peritarFoto } from "@/lib/agentes/perito";
import { limitarPedido } from "@/lib/servidor/limite";
import { verificarOrigen } from "@/lib/servidor/guardas";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // el límite de cuerpo de las funciones de Vercel es de 4,5 MB
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Foto de evidencia: calcula la huella, lee metadatos y marcas de IA, y pide el informe del perito. El archivo no se guarda. */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 10); if (lim) return lim; }
  try {
    verificarOrigen(req);
    const declarado = Number(req.headers.get("content-length"));
    if (Number.isFinite(declarado) && declarado > MAX_BYTES + 10_000) return NextResponse.json({ error: "La foto pesa demasiado (máximo 4 MB)" }, { status: 413 });
    const f = await req.formData();
    const archivo = f.get("archivo");
    const fechaEntrega = f.get("fechaEntrega");
    const fechaRegistro = f.get("fechaRegistro");
    if (!(archivo instanceof File)) return NextResponse.json({ error: "Falta la foto" }, { status: 400 });
    if (typeof fechaEntrega !== "string" || typeof fechaRegistro !== "string" || !FECHA.test(fechaEntrega) || !FECHA.test(fechaRegistro)) return NextResponse.json({ error: "Faltan las fechas de entrega y de registro (AAAA-MM-DD)" }, { status: 400 });
    if (!MIMES_FOTO.includes(archivo.type)) return NextResponse.json({ error: "Formato no admitido: usá JPG, PNG o WebP" }, { status: 415 });
    if (archivo.size === 0 || archivo.size > MAX_BYTES) return NextResponse.json({ error: "La foto está vacía o pesa más de 4 MB" }, { status: 413 });
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const informe = await peritarFoto(bytes, archivo.type);
    return NextResponse.json(analizarFoto({ bytes, informe, fechaEntrega, fechaRegistro }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error && e.message.startsWith("Pedido de otro sitio") ? e.message : "No se pudo analizar la foto" }, { status: 400 });
  }
}
