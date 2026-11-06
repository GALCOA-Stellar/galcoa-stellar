import { NextResponse } from "next/server";
import { previsualizarLote } from "@/lib/lote";
import { armarTxSello } from "@/lib/multifirma";
import { cuentaSelladora2de2, secuenciaDe } from "@/lib/stellar";
import { ipDe, leerJson, limitar } from "@/lib/guardas";

export const runtime = "nodejs";

/** Paso 1 del sello 2 de 2: arma, sin firmar, la transacción que cada persona firmará con su billetera. La huella la calcula el servidor. */
export async function POST(req: Request) {
  if (!limitar(ipDe(req), 20)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  try {
    const cuenta = cuentaSelladora2de2();
    if (!cuenta) return NextResponse.json({ error: "El sello 2 de 2 no está configurado" }, { status: 503 });
    const cuerpo = (await leerJson(req)) as { documentos?: unknown };
    const vista = previsualizarLote(cuerpo.documentos as unknown[]);
    if (!vista.memo) return NextResponse.json({ error: "Ningún documento pasó la verificación: no hay nada para sellar" }, { status: 400 });
    const xdr = armarTxSello(cuenta, await secuenciaDe(cuenta), vista.memo);
    return NextResponse.json({ xdr, memo: vista.memo, cuentaSelladora: cuenta, sellan: vista.sellan, afuera: vista.afuera });
  } catch (e) {
    const permitido = ["Mandá al menos un documento", "Máximo", "Se espera JSON", "Cuerpo demasiado grande", "Pedido de otro sitio"];
    const msg = e instanceof Error && permitido.some((p) => e.message.startsWith(p)) ? e.message : "No se pudo preparar el sello";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
