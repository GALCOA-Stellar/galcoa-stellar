import { NextResponse } from "next/server";
import { listarOperaciones, puedeVerHistorial } from "@/lib/historial";
import { ipDe, limitar } from "@/lib/guardas";
import { limpiarSiToca } from "@/lib/privacidad";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!limitar(ipDe(req), 60)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  if (!puedeVerHistorial(req)) return NextResponse.json({ error: "Ingresá con tu billetera para ver el historial" }, { status: 401 });
  await limpiarSiToca(); // borra lo que ya cumplió su plazo de conservación
  return NextResponse.json({ operaciones: await listarOperaciones() });
}
