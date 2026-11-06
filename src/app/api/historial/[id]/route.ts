import { NextResponse } from "next/server";
import { leerOperacion, puedeVerHistorial } from "@/lib/historial";
import { borrar, idValido } from "@/lib/almacen";
import { leerSesion } from "@/lib/firma";
import { ipDe, limitar, verificarOrigen } from "@/lib/guardas";

export const runtime = "nodejs";

/** Devuelve el archivo del lote guardado (el mismo que se descarga al sellar). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!limitar(ipDe(req), 60)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  if (!puedeVerHistorial(req)) return NextResponse.json({ error: "Ingresá con tu billetera para ver el historial" }, { status: 401 });
  const { id } = await params;
  const op = idValido(id) ? await leerOperacion(id) : null;
  if (!op) return NextResponse.json({ error: "No existe esa operación" }, { status: 404 });
  return NextResponse.json(op.archivo);
}

/** Borra una operación del historial (requiere sesión; el modo demostración no alcanza). La huella en Stellar queda, y no contiene datos personales. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!limitar(ipDe(req), 20)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  try { verificarOrigen(req); } catch { return NextResponse.json({ error: "Pedido de otro sitio" }, { status: 403 }); }
  if (!leerSesion(req.headers.get("x-pase"))) return NextResponse.json({ error: "Ingresá con tu billetera para borrar" }, { status: 401 });
  const { id } = await params;
  if (!idValido(id) || !(await borrar("operaciones", id))) return NextResponse.json({ error: "No existe esa operación" }, { status: 404 });
  return NextResponse.json({ borrada: true });
}
