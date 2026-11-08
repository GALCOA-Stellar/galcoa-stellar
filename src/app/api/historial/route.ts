import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { listarOperaciones, listarOperacionesDe, puedeVerHistorial, resumenComisiones } from "@/lib/datos/historial";
import { demoActivo } from "@/lib/servidor/demo";
import { leerSesion } from "@/lib/stellar/firma";
import { limpiarSiToca } from "@/lib/datos/privacidad";

export const runtime = "nodejs";

export async function GET(req: Request) {
  { const lim = await limitarPedido(req, 60); if (lim) return lim; }
  if (!puedeVerHistorial(req)) return NextResponse.json({ error: "Ingresá con tu billetera para ver el historial" }, { status: 401 });
  await limpiarSiToca(); // borra lo que ya cumplió su plazo de conservación
  const sesion = leerSesion(req.headers.get("x-pase"));
  // Con sesión: solo lo propio. En desarrollo con modo demostración (sin sesión): todo.
  const operaciones = sesion ? await listarOperacionesDe(sesion) : demoActivo() ? await listarOperaciones() : [];
  return NextResponse.json({ operaciones, comisiones: resumenComisiones(operaciones) }, { headers: { "cache-control": "no-store" } });
}
