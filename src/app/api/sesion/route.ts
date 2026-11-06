import { NextResponse } from "next/server";
import { abrirSesion, emitirDesafioSesion, cuentaAutorizada, leerSesion } from "@/lib/firma";
import { ipDe, leerJson, limitar } from "@/lib/guardas";

export const runtime = "nodejs";

/** GET: quién soy (según el pase). POST {cuenta}: pide el mensaje a firmar. POST {acceso}: abre la sesión y devuelve el pase. */
export async function GET(req: Request) {
  const s = leerSesion(req.headers.get("x-pase"));
  return s ? NextResponse.json(s) : NextResponse.json({ error: "Sin sesión" }, { status: 401 });
}

export async function POST(req: Request) {
  if (!limitar(ipDe(req), 20)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  try {
    const c = (await leerJson(req)) as { cuenta?: unknown; acceso?: unknown };
    if (c.acceso) {
      const r = abrirSesion(c.acceso);
      return r.ok ? NextResponse.json({ pase: r.pase, cuenta: r.cuenta, identidad: r.identidad }) : NextResponse.json({ error: r.motivo }, { status: 401 });
    }
    if (typeof c.cuenta !== "string" || !cuentaAutorizada(c.cuenta)) return NextResponse.json({ error: "Esa cuenta no está autorizada" }, { status: 403 });
    return NextResponse.json(emitirDesafioSesion(c.cuenta));
  } catch {
    return NextResponse.json({ error: "No se pudo completar" }, { status: 400 });
  }
}
