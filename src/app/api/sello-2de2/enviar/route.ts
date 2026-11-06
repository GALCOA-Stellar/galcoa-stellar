import { NextResponse } from "next/server";
import { armarArchivo, cargadoresDelLote, previsualizarLote, sellarLote } from "@/lib/lote";
import { evaluarSello } from "@/lib/multifirma";
import { cuentaSelladora2de2, enviarSelloFirmado, urlExplorador } from "@/lib/stellar";
import { cuentasAutorizadas, identidadDe } from "@/lib/firma";
import { ipDe, leerJson, limitar } from "@/lib/guardas";
import { usarCupo } from "@/lib/cupos";
import { operacionPorMemo, registrarOperacion } from "@/lib/historial";
import { liberar, reclamar } from "@/lib/almacen";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Paso 2: recibe la transacción con las firmas de dos personas, la revisa y, si está bien, la envía. La red vuelve a exigir las dos firmas. */
export async function POST(req: Request) {
  if (!limitar(ipDe(req))) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  try {
    const cuenta = cuentaSelladora2de2();
    const autorizadas = cuentasAutorizadas();
    if (!cuenta || !autorizadas) return NextResponse.json({ error: "El sello 2 de 2 no está configurado" }, { status: 503 });
    const cuerpo = (await leerJson(req)) as { documentos?: unknown; xdr?: unknown };
    const vista = previsualizarLote(cuerpo.documentos as unknown[]);
    if (!vista.memo) return NextResponse.json({ error: "No hay nada para sellar" }, { status: 400 });
    const ev = evaluarSello(cuerpo.xdr, {
      cuentaSelladora: cuenta,
      memoEsperado: vista.memo,
      autorizadas,
      identidadDe,
      cargadores: cargadoresDelLote(cuerpo.documentos as unknown[]),
    });
    if (!ev.ok) return NextResponse.json({ error: ev.motivo }, { status: 403 });

    // Un reintento no sella dos veces: si ya está sellado o hay un envío en curso, no se vuelve a pagar ni a enviar.
    const previa = await operacionPorMemo(vista.memo);
    if (previa) return NextResponse.json({ error: "Este lote ya se selló: no se vuelve a enviar", yaSellado: { txHash: previa.txHash, ledger: previa.ledger, explorador: urlExplorador(previa.txHash) } }, { status: 409 });
    for (const f of ev.firmantes) {
      const cupo = await usarCupo(f);
      if (!cupo.ok) return NextResponse.json({ error: `Una de las cuentas llegó al límite de ${cupo.max} sellos por día. Se renueva a las 00:00 UTC.` }, { status: 429 });
    }
    const clave = vista.memo.slice(0, 32);
    if (!(await reclamar("sellos", clave, "enviando", 10 * 60_000))) return NextResponse.json({ error: "Ya hay un envío en curso para este lote. Esperá unos segundos y revisá el historial." }, { status: 409 });

    let comisionPagadaPor: string | null = null;
    let r: Awaited<ReturnType<typeof sellarLote>>;
    try {
      r = await sellarLote(cuerpo.documentos as unknown[], async (memo) => {
        if (memo !== vista.memo) throw new Error("La huella cambió");
        const s = await enviarSelloFirmado(cuerpo.xdr as string);
        comisionPagadaPor = s.comisionPagadaPor;
        return s;
      });
    } catch (e) { await liberar("sellos", clave, "enviando"); throw e; }
    if (!r.sellado) await liberar("sellos", clave, "enviando");
    const archivo = r.sellado ? { ...armarArchivo(r.sellado, r.comprobantes), firmadoPor: ev.firmantes, personas: ev.identidades, cargaron: cargadoresDelLote(cuerpo.documentos as unknown[]) } : null;
    if (r.sellado) await registrarOperacion({ txHash: r.sellado.txHash, ledger: r.sellado.ledger, memo: r.sellado.memo, cantidadHojas: r.sellado.cantidadHojas, firmadoPor: ev.firmantes, personas: ev.identidades, modo: "2de2", archivo });
    return NextResponse.json({
      ...r,
      firmadoPor: ev.firmantes,
      identidades: ev.identidades,
      comisionPagadaPor,
      explorador: r.sellado ? urlExplorador(r.sellado.txHash) : null,
      archivo,
    });
  } catch (e) {
    const permitido = ["Mandá al menos un documento", "Máximo", "Se espera JSON", "Cuerpo demasiado grande", "Pedido de otro sitio", "Stellar rechazó"];
    const msg = e instanceof Error && permitido.some((p) => e.message.startsWith(p)) ? e.message : "No se pudo completar el sellado";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
