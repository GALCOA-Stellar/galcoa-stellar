import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { leerJson } from "@/lib/servidor/guardas";

export const runtime = "nodejs";

/**
 * MODO DEMOSTRACIÓN (solo desarrollo local y testnet): firma el sobre con una de dos claves de prueba que guarda el servidor,
 * para poder probar el 2 de 2 sin billetera. NO es firma real de una persona. Apagado por defecto y siempre apagado en producción.
 */
import { demoActivo } from "@/lib/servidor/demo";
const clave = (rol: string) => (rol === "cargador" ? process.env.DEMO_SECRETO_CARGADOR : rol === "aprobador" ? process.env.DEMO_SECRETO_APROBADOR : undefined);

export async function GET() {
  return NextResponse.json({ activo: demoActivo() });
}

export async function POST(req: Request) {
  if (!demoActivo()) return NextResponse.json({ error: "El modo demostración está apagado" }, { status: 404 });
  { const lim = await limitarPedido(req, 30); if (lim) return lim; }
  try {
    const c = (await leerJson(req)) as { xdr?: unknown; rol?: unknown };
    const secreto = clave(String(c.rol));
    if (!secreto || typeof c.xdr !== "string") return NextResponse.json({ error: "Falta rol o transacción" }, { status: 400 });
    const tx = TransactionBuilder.fromXDR(c.xdr, Networks.TESTNET);
    const kp = Keypair.fromSecret(secreto);
    tx.sign(kp);
    return NextResponse.json({ xdr: tx.toXDR(), cuenta: kp.publicKey(), rol: c.rol });
  } catch {
    return NextResponse.json({ error: "No se pudo firmar" }, { status: 400 });
  }
}
