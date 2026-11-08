import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { leerJson, mensajePublico } from "@/lib/servidor/guardas";
import { leerInvitacion, responderInvitacion } from "@/lib/datos/ronda";
import { registrarError } from "@/lib/servidor/registro";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ token: string }> };
const SIN_CACHE = { "cache-control": "no-store" };

/** Lo que ve cada participante. Leer NUNCA consume el enlace. Enlace mal formado, inexistente o anulado: la misma respuesta. */
export async function GET(req: Request, { params }: Ctx) {
  { const lim = await limitarPedido(req, 60); if (lim) return lim; }
  const { token } = await params;
  const v = await leerInvitacion(token);
  if (!v) return NextResponse.json({ error: "Este enlace no existe" }, { status: 404, headers: SIN_CACHE });
  return NextResponse.json(v, { headers: SIN_CACHE });
}

/** El participante responde "lo recibí así" o "no coincide", con su nombre. Un solo uso. */
export async function POST(req: Request, { params }: Ctx) {
  { const lim = await limitarPedido(req, 10); if (lim) return lim; }
  const { token } = await params;
  try {
    const c = (await leerJson(req)) as { respuesta?: unknown; nombre?: unknown; nota?: unknown };
    const r = await responderInvitacion(token, c.respuesta, c.nombre, c.nota);
    return NextResponse.json(r, { headers: SIN_CACHE });
  } catch (e) {
    const publico = mensajePublico(e, ["Este enlace", "Respuesta no válida", "Escribí tu nombre", "Los datos de esta ronda"], "");
    const ok = publico !== "";
    if (!ok) registrarError("invitacion/responder", e);
    return NextResponse.json({ error: ok ? publico : "No se pudo registrar la respuesta" }, { status: 400, headers: SIN_CACHE });
  }
}
