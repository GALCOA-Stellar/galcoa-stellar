import { NextResponse } from "next/server";
import { leerSesion } from "@/lib/firma";
import { borrarDatosDe, DIAS_CONSERVACION, operacionesDe } from "@/lib/privacidad";
import { ipDe, limitar, verificarOrigen } from "@/lib/guardas";

export const runtime = "nodejs";

/** Derecho de acceso: la persona (con sesión) descarga todo lo que esta instalación guarda sobre ella. */
export async function GET(req: Request) {
  if (!limitar(ipDe(req), 20)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  const s = leerSesion(req.headers.get("x-pase"));
  if (!s) return NextResponse.json({ error: "Ingresá con tu billetera para ver tus datos" }, { status: 401 });
  const operaciones = await operacionesDe(s.identidad);
  return new Response(JSON.stringify({ identidad: s.identidad, cuenta: s.cuenta, conservacionDias: DIAS_CONSERVACION(), operaciones }, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="mis-datos-galcoa.json"' },
  });
}

/** Derecho de supresión: borra de esta instalación todo lo guardado sobre la persona. La huella en Stellar no contiene datos personales. */
export async function DELETE(req: Request) {
  if (!limitar(ipDe(req), 5)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  try { verificarOrigen(req); } catch { return NextResponse.json({ error: "Pedido de otro sitio" }, { status: 403 }); }
  const s = leerSesion(req.headers.get("x-pase"));
  if (!s) return NextResponse.json({ error: "Ingresá con tu billetera para borrar tus datos" }, { status: 401 });
  return NextResponse.json({ borradas: await borrarDatosDe(s.identidad) });
}
