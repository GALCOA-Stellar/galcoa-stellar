import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { desafioDeVoz } from "@/lib/dominio/voz";
import { limitarPedido } from "@/lib/servidor/limite";
import { verificarOrigen } from "@/lib/servidor/guardas";
import { marcarTexto } from "@/lib/stellar/firma";

export const runtime = "nodejs";

/** Entrega una frase al azar para grabar. Sin estado: la marca HMAC prueba que la emitió este servidor y cuándo. */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 20); if (lim) return lim; }
  try {
    verificarOrigen(req);
    const d = desafioDeVoz(new Uint8Array(randomBytes(6)));
    const datos = JSON.stringify({ palabras: d.palabras, numero: d.numero, emitidoEn: Date.now() });
    return NextResponse.json({ frase: d.frase, datos, marca: marcarTexto(datos) });
  } catch {
    return NextResponse.json({ error: "No se pudo emitir la frase" }, { status: 400 });
  }
}
