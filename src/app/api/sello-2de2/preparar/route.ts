import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { previsualizarLote } from "@/lib/aplicacion/lote";
import { armarTxSello } from "@/lib/stellar/multifirma";
import { cuentaSelladora2de2, secuenciaDe } from "@/lib/stellar/stellar";
import { leerJson } from "@/lib/servidor/guardas";

export const runtime = "nodejs";

/** Paso 1 del sello 2 de 2: arma, sin firmar, la transacción que cada persona firmará con su billetera. La huella la calcula el servidor. */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 20); if (lim) return lim; }
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
