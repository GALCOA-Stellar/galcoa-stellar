import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { verificarComprobante, type Comprobante } from "@/lib/aplicacion/lote";
import { pdfDeComprobante } from "@/lib/documentos/pdf";
import { comprobanteRegistrado } from "@/lib/datos/historial";
import { leerJson } from "@/lib/servidor/guardas";
import { registrarError } from "@/lib/servidor/registro";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Devuelve la constancia en PDF de un comprobante. Solo si el comprobante es coherente (la huella y el camino cierran). */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 20); if (lim) return lim; }
  try {
    const c = (await leerJson(req)) as Comprobante;
    if (!c || typeof c !== "object" || !c.manifiesto || typeof c.txHash !== "string") return NextResponse.json({ error: "Eso no parece un comprobante de GALCOA+" }, { status: 400 });
    if (!/^[0-9a-f]{64}$/.test(c.txHash) || !Number.isInteger(c.indice) || c.indice < 0) return NextResponse.json({ error: "El comprobante tiene datos inválidos" }, { status: 400 });
    if (!verificarComprobante(c).coherente) return NextResponse.json({ error: "El comprobante no es coherente: no se genera la constancia" }, { status: 422 });
    if (!(await comprobanteRegistrado(c.txHash, c.manifestHash))) return NextResponse.json({ error: "Esta instalación no selló ese comprobante: no se genera la constancia" }, { status: 403 });
    const pdf = await pdfDeComprobante(c);
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="constancia-${c.txHash.slice(0, 8)}-${c.indice + 1}.pdf"` } });
  } catch (e) {
    registrarError("constancia", e);
    return NextResponse.json({ error: "No se pudo generar la constancia" }, { status: 400 });
  }
}
