import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { armarArchivo, cargadoresDelLote, previsualizarLote, sellarLote } from "@/lib/aplicacion/lote";
import { evaluarSello } from "@/lib/stellar/multifirma";
import { comisionCobrada, cuentaSelladora2de2, enviarSelloFirmado, urlExplorador } from "@/lib/stellar/stellar";
import { cuentasAutorizadas, identidadDe } from "@/lib/stellar/firma";
import { leerJson, mensajePublico } from "@/lib/servidor/guardas";
import { usarCupo } from "@/lib/datos/cupos";
import { operacionPorMemo, registrarOperacion } from "@/lib/datos/historial";
import { liberar, reclamar } from "@/lib/datos/almacen";
import { anotarSiQuedoPendiente, revisarPendiente } from "@/lib/aplicacion/pendiente";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Paso 2: recibe la transacción con las firmas de dos personas, la revisa y, si está bien, la envía. La red vuelve a exigir las dos firmas. */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req); if (lim) return lim; }
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
    // Un intento anterior pudo haber quedado sin confirmar (la red tardó): si ese hash ya entró se completa el registro sin enviar nada.
    const rev = await revisarPendiente(vista.memo);
    if (rev.tipo === "espera") return NextResponse.json({ error: "Un envío anterior de este lote todavía no se confirmó en la red. Esperá un minuto y volvé a intentar: no se envía otra transacción mientras tanto." }, { status: 409 });
    if (rev.tipo === "ninguno" && !(await reclamar("sellos", clave, "enviando", 10 * 60_000))) return NextResponse.json({ error: "Ya hay un envío en curso para este lote. Esperá unos segundos y revisá el historial." }, { status: 409 });

    let comisionPagadaPor: string | null = null;
    let r: Awaited<ReturnType<typeof sellarLote>>;
    try {
      r = await sellarLote(cuerpo.documentos as unknown[], async (memo) => {
        if (memo !== vista.memo) throw new Error("La huella cambió");
        if (rev.tipo === "exito") return rev.tx;
        const s = await enviarSelloFirmado(cuerpo.xdr as string);
        comisionPagadaPor = s.comisionPagadaPor;
        return s;
      });
    } catch (e) {
      if (await anotarSiQuedoPendiente(e, vista.memo, "2de2")) return NextResponse.json({ error: "La red tardó en confirmar. No se perdió nada: volvé a intentar en un minuto y se completa sin enviar otra transacción." }, { status: 202 });
      await liberar("sellos", clave, "enviando"); throw e;
    }
    if (!r.sellado) await liberar("sellos", clave, "enviando");
    const archivo = r.sellado ? { ...armarArchivo(r.sellado, r.comprobantes), firmadoPor: ev.firmantes, personas: ev.identidades, cargaron: cargadoresDelLote(cuerpo.documentos as unknown[]) } : null;
    if (r.sellado) await registrarOperacion({ txHash: r.sellado.txHash, ledger: r.sellado.ledger, memo: r.sellado.memo, cantidadHojas: r.sellado.cantidadHojas, firmadoPor: ev.firmantes, personas: ev.identidades, modo: "2de2", archivo, comisionStroops: comisionCobrada(r.comprobantes[0]?.prueba?.resultXdr) ?? undefined });
    return NextResponse.json({
      ...r,
      firmadoPor: ev.firmantes,
      identidades: ev.identidades,
      comisionPagadaPor,
      explorador: r.sellado ? urlExplorador(r.sellado.txHash) : null,
      archivo,
    });
  } catch (e) {
        const msg = mensajePublico(e, ["Mandá al menos un documento", "Máximo", "Stellar rechazó"], "No se pudo completar el sellado");
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
