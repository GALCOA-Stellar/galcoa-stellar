import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { idValido } from "@/lib/datos/almacen";
import { ipDe, verificarOrigen } from "@/lib/servidor/guardas";
import { puedeVerHistorial } from "@/lib/datos/historial";
import { reemitirInvitacion, revocarInvitacion, ROLES, type Rol } from "@/lib/datos/ronda";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string; rol: string }> };
const rolValido = (r: string): r is Rol => (ROLES as readonly string[]).includes(r);

/** DELETE anula el enlace de un participante que no respondió. POST entrega un enlace nuevo (el anterior queda anulado). */
async function accion(req: Request, { params }: Ctx, que: "revocar" | "reemitir") {
  { const lim = await limitarPedido(req, 20); if (lim) return lim; }
  if (!puedeVerHistorial(req)) return NextResponse.json({ error: "Ingresá con tu billetera" }, { status: 401 });
  const { id, rol } = await params;
  if (!idValido(id) || !rolValido(rol)) return NextResponse.json({ error: "Esa ronda no existe" }, { status: 404 });
  try {
    verificarOrigen(req);
    if (que === "revocar") {
      await revocarInvitacion(id, rol);
      return NextResponse.json({ revocado: true });
    }
    const n = await reemitirInvitacion(id, rol);
    return NextResponse.json({ enlace: `/invitacion/${n.token}`, vence: n.vence }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const ok = e instanceof Error && ["Esa ronda", "Ese participante", "Pedido de otro sitio"].some((p) => e.message.startsWith(p));
    if (!ok) console.error("rondas/accion:", e);
    return NextResponse.json({ error: ok ? (e as Error).message : "No se pudo completar la acción" }, { status: 400 });
  }
}
export const DELETE = (req: Request, ctx: Ctx) => accion(req, ctx, "revocar");
export const POST = (req: Request, ctx: Ctx) => accion(req, ctx, "reemitir");
