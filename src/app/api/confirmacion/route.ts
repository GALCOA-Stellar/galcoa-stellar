import { NextResponse } from "next/server";
import { crear } from "@/lib/confirmacion";
import { ipDe, leerJson, limitar } from "@/lib/guardas";
import { puedeVerHistorial } from "@/lib/historial";
import { limpiarSiToca } from "@/lib/privacidad";

export const runtime = "nodejs";

/** La distribuidora crea el enlace para que el comercio confirme un documento. */
export async function POST(req: Request) {
  if (!limitar(ipDe(req), 20)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  if (!puedeVerHistorial(req)) return NextResponse.json({ error: "Ingresá con tu billetera para crear el enlace" }, { status: 401 });
  try {
    const c = (await leerJson(req)) as { documento?: unknown };
    await limpiarSiToca();
    const conf = await crear(c.documento);
    return NextResponse.json({ id: conf.id, ruta: `/confirmar/${conf.id}`, vence: conf.vence, huella: conf.huella });
  } catch (e) {
    const ok = e instanceof Error && ["Los datos del documento", "Se espera JSON", "Pedido de otro sitio", "Cuerpo demasiado"].some((p) => e.message.startsWith(p));
    if (!ok) console.error("confirmacion/crear:", e);
    return NextResponse.json({ error: ok ? (e as Error).message : "No se pudo crear el enlace" }, { status: 400 });
  }
}
