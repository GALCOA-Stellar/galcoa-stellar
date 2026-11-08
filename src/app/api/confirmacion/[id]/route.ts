import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { responder, vistaPublica, type Confirmacion } from "@/lib/datos/confirmacion";
import { idValido, leer } from "@/lib/datos/almacen";
import { leerJson } from "@/lib/servidor/guardas";
import { registrarError } from "@/lib/servidor/registro";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** Estado y datos visibles de una confirmación. Sirve al comercio (ver qué confirma) y a la distribuidora (ver si ya respondió). */
export async function GET(req: Request, { params }: Ctx) {
  { const lim = await limitarPedido(req, 60); if (lim) return lim; }
  const { id } = await params;
  const c = idValido(id) ? await leer<Confirmacion>("confirmaciones", id) : null;
  if (!c) return NextResponse.json({ error: "Este enlace no existe" }, { status: 404 });
  return NextResponse.json({ id, nota: c.nota, ...vistaPublica(c) });
}

/** El comercio responde: "lo recibí así" o "no coincide". Un solo uso. */
export async function POST(req: Request, { params }: Ctx) {
  { const lim = await limitarPedido(req, 10); if (lim) return lim; }
  const { id } = await params;
  if (!idValido(id)) return NextResponse.json({ error: "Este enlace no existe" }, { status: 404 });
  try {
    const c = (await leerJson(req)) as { respuesta?: unknown; nota?: unknown };
    const r = await responder(id, c.respuesta, c.nota);
    return NextResponse.json({ estado: r.estado, respondida: r.respondida });
  } catch (e) {
    const ok = e instanceof Error && ["Este enlace", "Respuesta no válida", "Se espera JSON", "Pedido de otro sitio", "Cuerpo demasiado"].some((p) => e.message.startsWith(p));
    if (!ok) registrarError("confirmacion/responder", e);
    return NextResponse.json({ error: ok ? (e as Error).message : "No se pudo registrar la respuesta" }, { status: 400 });
  }
}
