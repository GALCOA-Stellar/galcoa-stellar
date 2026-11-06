import { NextResponse } from "next/server";
import { armarArchivo, cargadoresDelLote, previsualizarLote, sellarLote } from "@/lib/lote";
import { enviarMemo, urlExplorador } from "@/lib/stellar";
import { ipDe, leerJson, limitar } from "@/lib/guardas";
import { usarCupo } from "@/lib/cupos";
import { identidadDe, verificarAcceso } from "@/lib/firma";
import { operacionPorMemo, registrarOperacion } from "@/lib/historial";
import { liberar, reclamar } from "@/lib/almacen";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!limitar(ipDe(req))) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  // Este modo no puede asegurar los cuatro ojos: quien manda los datos escribe `cargadoPor`. En producción queda apagado (se usa el sello 2 de 2).
  if (process.env.NODE_ENV === "production" && process.env.PERMITIR_UNA_FIRMA !== "1") return NextResponse.json({ error: "Este modo no está habilitado: usá la aprobación de dos personas" }, { status: 403 });
  try {
    const cuerpo = (await leerJson(req)) as { documentos?: unknown; acceso?: unknown };
    // La firma está atada a la huella exacta de este lote: se recalcula acá, sin confiar en lo que diga el navegador.
    const vista = previsualizarLote(cuerpo.documentos as unknown[]);
    const acceso = verificarAcceso(cuerpo.acceso, vista.memo);
    if (!acceso.ok) return NextResponse.json({ error: acceso.motivo }, { status: 401 });
    if (cargadoresDelLote(cuerpo.documentos as unknown[]).includes(identidadDe(acceso.cuenta)))
      return NextResponse.json({ error: "Cuatro ojos: quien aprueba el sello no puede haber cargado documentos de este lote" }, { status: 403 });
    // Un reintento no sella dos veces (ni paga dos comisiones).
    const previa = await operacionPorMemo(vista.memo!);
    if (previa) return NextResponse.json({ error: "Este lote ya se selló: no se vuelve a enviar", yaSellado: { txHash: previa.txHash, ledger: previa.ledger, explorador: urlExplorador(previa.txHash) } }, { status: 409 });
    const clave = vista.memo!.slice(0, 32);
    const cupo = await usarCupo(acceso.cuenta);
    if (!cupo.ok) return NextResponse.json({ error: `Llegaste al límite de ${cupo.max} sellos por día para esta cuenta. Se renueva a las 00:00 UTC.` }, { status: 429 });
    if (!(await reclamar("sellos", clave, "enviando", 10 * 60_000))) return NextResponse.json({ error: "Ya hay un envío en curso para este lote. Esperá unos segundos y revisá el historial." }, { status: 409 });
    let r: Awaited<ReturnType<typeof sellarLote>>;
    try { r = await sellarLote(cuerpo.documentos as unknown[], enviarMemo); } catch (e) { await liberar("sellos", clave, "enviando"); throw e; }
    if (!r.sellado) await liberar("sellos", clave, "enviando");
    const archivo = r.sellado ? { ...armarArchivo(r.sellado, r.comprobantes), firmadoPor: acceso.cuenta } : null;
    if (r.sellado) await registrarOperacion({ txHash: r.sellado.txHash, ledger: r.sellado.ledger, memo: r.sellado.memo, cantidadHojas: r.sellado.cantidadHojas, firmadoPor: acceso.cuenta, modo: "una-firma", archivo });
    return NextResponse.json({
      ...r,
      firmadoPor: acceso.cuenta,
      explorador: r.sellado ? urlExplorador(r.sellado.txHash) : null,
      archivo,
    });
  } catch (e) {
    // Mensajes controlados: no se devuelven detalles internos de la red ni de la configuración.
    const permitido = ["Mandá al menos un documento", "Máximo", "Se espera JSON", "Cuerpo demasiado grande", "Pedido de otro sitio"];
    const msg = e instanceof Error && permitido.some((p) => e.message.startsWith(p)) ? e.message : "No se pudo completar el sellado";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
