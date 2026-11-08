import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { esDeLaSesion, leerOperacion, puedeVerHistorial } from "@/lib/datos/historial";
import { demoActivo } from "@/lib/servidor/demo";
import { borrar, idValido } from "@/lib/datos/almacen";
import { leerSesion } from "@/lib/stellar/firma";
import { ipDe, verificarOrigen } from "@/lib/servidor/guardas";

export const runtime = "nodejs";

/** Devuelve el archivo del lote guardado (el mismo que se descarga al sellar). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  { const lim = await limitarPedido(req, 60); if (lim) return lim; }
  if (!puedeVerHistorial(req)) return NextResponse.json({ error: "Ingresá con tu billetera para ver el historial" }, { status: 401 });
  const { id } = await params;
  const op = idValido(id) ? await leerOperacion(id) : null;
  if (!op) return NextResponse.json({ error: "No existe esa operación" }, { status: 404 });
  // Solo quien participó la ve (el modo demostración, que no existe en producción, ve todo).
  const sesion = leerSesion(req.headers.get("x-pase"));
  if (!demoActivo() && !(sesion && esDeLaSesion(op, sesion))) return NextResponse.json({ error: "No existe esa operación" }, { status: 404 });
  return NextResponse.json(op.archivo);
}

/** Borra una operación del historial (requiere sesión; el modo demostración no alcanza). La huella en Stellar queda, y no contiene datos personales. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  { const lim = await limitarPedido(req, 20); if (lim) return lim; }
  try { verificarOrigen(req); } catch { return NextResponse.json({ error: "Pedido de otro sitio" }, { status: 403 }); }
  const sesion = leerSesion(req.headers.get("x-pase"));
  if (!sesion) return NextResponse.json({ error: "Ingresá con tu billetera para borrar" }, { status: 401 });
  const { id } = await params;
  const op = idValido(id) ? await leerOperacion(id) : null;
  if (!op || !esDeLaSesion(op, sesion) || !(await borrar("operaciones", id))) return NextResponse.json({ error: "No existe esa operación" }, { status: 404 });
  return NextResponse.json({ borrada: true });
}
