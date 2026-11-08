import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { crearRonda } from "@/lib/datos/ronda";
import { ipDe, leerJson } from "@/lib/servidor/guardas";
import { puedeVerHistorial } from "@/lib/datos/historial";
import { limpiarSiToca } from "@/lib/datos/privacidad";

export const runtime = "nodejs";

/** La distribuidora crea una ronda: un enlace privado por participante para confirmar el mismo documento. Los enlaces se muestran UNA sola vez. */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 20); if (lim) return lim; }
  if (!puedeVerHistorial(req)) return NextResponse.json({ error: "Ingresá con tu billetera para crear los enlaces" }, { status: 401 });
  try {
    const c = (await leerJson(req)) as { documento?: unknown; roles?: unknown };
    await limpiarSiToca();
    const { ronda, tokens } = await crearRonda(c.documento, c.roles);
    const enlaces = Object.fromEntries(Object.entries(tokens).map(([rol, t]) => [rol, `/invitacion/${t}`]));
    return NextResponse.json({ id: ronda.id, enlaces, vence: ronda.vence, huella: ronda.huella }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const ok = e instanceof Error && ["Los datos del documento", "Los participantes", "Tienen que confirmar", "Elegí quiénes", "Se espera JSON", "Pedido de otro sitio", "Cuerpo demasiado"].some((p) => e.message.startsWith(p));
    if (!ok) console.error("rondas/crear:", e);
    return NextResponse.json({ error: ok ? (e as Error).message : "No se pudo crear la ronda" }, { status: 400 });
  }
}
